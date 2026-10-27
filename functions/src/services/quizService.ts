import type { Api } from "grammy";
import * as logger from "firebase-functions/logger";
import { quizRetryKeyboard } from "../bot/keyboards/quizKeyboards";
import { config } from "../config/config";
import { texts } from "../config/texts";
import { getQuiz, type LessonQuiz } from "../content/quizzes";
import type { QuizSession } from "../models/quizSession";
import type { User } from "../models/user";
import type { QuizSessionRepository } from "../repositories/quizSessionRepository";
import type { UserRepository } from "../repositories/userRepository";
import { describeError, isUserUnreachable } from "../utils/errors";
import type { LessonService } from "./lessonService";

function requireQuiz(lessonNumber: number): LessonQuiz {
  const quiz = getQuiz(lessonNumber);
  if (quiz === undefined) {
    throw new Error(`No quiz content for lesson ${lessonNumber}`);
  }
  return quiz;
}

export class QuizService {
  constructor(
    private readonly api: Api,
    private readonly sessions: QuizSessionRepository,
    private readonly users: UserRepository,
    private readonly lessonService: LessonService,
  ) {}

  /** Starts the lesson quiz from its first question, replacing any quiz in progress. */
  async start(user: User, lessonNumber: number): Promise<void> {
    try {
      if ((await this.lessonService.ensureAccess(user, lessonNumber)) === undefined) {
        return;
      }

      const session = await this.sessions.start(user.id, lessonNumber, config.quizStartDebounceMs);
      if (session === undefined) {
        logger.debug("Quiz start ignored: the same quiz was started moments ago", { userId: user.id, lessonNumber });
        return;
      }
      await this.sendQuestion(session, requireQuiz(lessonNumber));
    } catch (error) {
      await this.handleFailure(error, user.id, lessonNumber);
    }
  }

  /** Counts an answer to the open quiz poll, then sends the next question or the result. */
  async handleAnswer(userId: number, pollId: string, optionIds: readonly number[]): Promise<void> {
    const session = await this.sessions.findByUserId(userId);
    if (session?.currentPollId !== pollId || optionIds.length === 0) {
      logger.debug("Poll answer ignored: it does not belong to an open quiz", { userId, pollId });
      return;
    }

    const quiz = requireQuiz(session.lessonNumber);
    const isCorrect = optionIds[0] === quiz.questions[session.questionIndex]?.correctIndex;
    const isLast = session.questionIndex + 1 >= quiz.questions.length;
    const answered = await this.sessions.recordAnswer(userId, pollId, isCorrect, isLast);
    if (answered === undefined) {
      logger.debug("Poll answer ignored: it was already counted", { userId, pollId });
      return;
    }

    try {
      await (isLast ? this.finish(answered, quiz.questions.length) : this.sendQuestion(answered, quiz));
    } catch (error) {
      await this.handleFailure(error, userId, session.lessonNumber);
    }
  }

  private async sendQuestion(session: QuizSession, quiz: LessonQuiz): Promise<void> {
    const question = quiz.questions[session.questionIndex];
    if (question === undefined) {
      throw new Error(`Lesson ${session.lessonNumber} has no question ${session.questionIndex + 1}`);
    }

    try {
      const message = await this.api.sendPoll(session.userId, question.text, [...question.options], {
        type: "quiz",
        is_anonymous: false,
        correct_option_ids: [question.correctIndex],
        explanation: question.explanation,
        protect_content: true,
      });
      if (!(await this.sessions.attachPoll(session.userId, session.startedAt, message.poll.id))) {
        logger.debug("Quiz poll superseded by a newer quiz start", { userId: session.userId, pollId: message.poll.id });
      }
    } catch (error) {
      await this.sessions.deleteIfCurrent(session.userId, session.startedAt);
      throw error;
    }
  }

  private async finish(session: QuizSession, total: number): Promise<void> {
    const { userId, lessonNumber, correctCount } = session;
    const percent = Math.round((correctCount / total) * 100);

    if (correctCount * 100 < config.passPercent * total) {
      await this.api.sendMessage(userId, texts.quizFailed(correctCount, total, percent), {
        reply_markup: quizRetryKeyboard(lessonNumber),
      });
      return;
    }

    const user = await this.users.recordLessonPassed(userId, lessonNumber, config.lessonCount);
    await this.api.sendMessage(userId, texts.quizPassed(correctCount, total, percent));
    if (lessonNumber === config.lessonCount) {
      await this.api.sendMessage(userId, texts.courseFinished);
      return;
    }
    // Delivery re-applies the access rules, so an unpaid user gets the locked text here.
    await this.lessonService.deliver(user, lessonNumber + 1);
  }

  private async handleFailure(error: unknown, userId: number, lessonNumber: number): Promise<void> {
    if (isUserUnreachable(error)) {
      logger.warn("Quiz stopped: the user blocked the bot", { userId, lessonNumber });
      return;
    }

    logger.error("Quiz step failed", { userId, lessonNumber, error: describeError(error) });
    await this.api.sendMessage(userId, texts.quizUnavailable);
  }
}
