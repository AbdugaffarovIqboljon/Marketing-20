import { Timestamp, type DocumentSnapshot, type Firestore } from "firebase-admin/firestore";
import type { QuizSession, QuizSessionDocument } from "../models/quizSession";

const QUIZ_SESSIONS_COLLECTION = "quizSessions";

function toSession(snapshot: DocumentSnapshot): QuizSession | undefined {
  return snapshot.exists ? { userId: Number(snapshot.id), ...(snapshot.data() as QuizSessionDocument) } : undefined;
}

export class QuizSessionRepository {
  constructor(private readonly db: Firestore) {}

  async findByUserId(userId: number): Promise<QuizSession | undefined> {
    return toSession(await this.sessions().doc(String(userId)).get());
  }

  /**
   * Replaces any existing session with a fresh one. Resolves to undefined when
   * the same quiz was started less than `debounceMs` ago, so rapid repeated
   * taps produce a single quiz.
   */
  async start(userId: number, lessonNumber: number, debounceMs: number): Promise<QuizSession | undefined> {
    const ref = this.sessions().doc(String(userId));

    return this.db.runTransaction(async (transaction) => {
      const existing = toSession(await transaction.get(ref));
      const now = Timestamp.now();
      if (
        existing?.lessonNumber === lessonNumber &&
        existing.questionIndex === 0 &&
        now.toMillis() - existing.startedAt.toMillis() < debounceMs
      ) {
        return undefined;
      }

      const document: QuizSessionDocument = {
        lessonNumber,
        questionIndex: 0,
        correctCount: 0,
        currentPollId: null,
        startedAt: now,
      };
      transaction.set(ref, document);
      return { userId, ...document };
    });
  }

  /** Links the poll just sent to the session; resolves false if the session was replaced meanwhile. */
  async attachPoll(userId: number, startedAt: Timestamp, pollId: string): Promise<boolean> {
    const ref = this.sessions().doc(String(userId));

    return this.db.runTransaction(async (transaction) => {
      const session = toSession(await transaction.get(ref));
      if (session?.startedAt.isEqual(startedAt) !== true) {
        return false;
      }
      transaction.update(ref, { currentPollId: pollId });
      return true;
    });
  }

  /**
   * Counts the answer to `pollId` exactly once and moves to the next question.
   * The session is deleted when `isLast` is set. Resolves to the updated
   * session, or undefined if `pollId` is no longer the open poll.
   */
  async recordAnswer(userId: number, pollId: string, isCorrect: boolean, isLast: boolean): Promise<QuizSession | undefined> {
    const ref = this.sessions().doc(String(userId));

    return this.db.runTransaction(async (transaction) => {
      const session = toSession(await transaction.get(ref));
      if (session?.currentPollId !== pollId) {
        return undefined;
      }

      const questionIndex = session.questionIndex + 1;
      const correctCount = session.correctCount + (isCorrect ? 1 : 0);
      if (isLast) {
        transaction.delete(ref);
      } else {
        transaction.update(ref, { questionIndex, correctCount, currentPollId: null });
      }
      return { ...session, questionIndex, correctCount, currentPollId: null };
    });
  }

  /** Deletes the session unless it was already replaced by a newer one. */
  async deleteIfCurrent(userId: number, startedAt: Timestamp): Promise<void> {
    const ref = this.sessions().doc(String(userId));

    await this.db.runTransaction(async (transaction) => {
      const session = toSession(await transaction.get(ref));
      if (session?.startedAt.isEqual(startedAt) === true) {
        transaction.delete(ref);
      }
    });
  }

  private sessions() {
    return this.db.collection(QUIZ_SESSIONS_COLLECTION);
  }
}
