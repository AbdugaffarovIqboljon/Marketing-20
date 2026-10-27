import { Composer } from "grammy";
import type { QuizService } from "../../services/quizService";
import { callbackPatterns } from "../callbackData";
import type { UserContext } from "../context";

export function createQuizComposer(quizService: QuizService): Composer<UserContext> {
  const composer = new Composer<UserContext>();

  composer.callbackQuery([callbackPatterns.lessonWatched, callbackPatterns.retryQuiz], async (ctx) => {
    await ctx.answerCallbackQuery();
    await quizService.start(ctx.user, Number(ctx.match[1]));
  });

  composer.on("poll_answer", async (ctx) => {
    await quizService.handleAnswer(ctx.user.id, ctx.pollAnswer.poll_id, ctx.pollAnswer.option_ids);
  });

  return composer;
}
