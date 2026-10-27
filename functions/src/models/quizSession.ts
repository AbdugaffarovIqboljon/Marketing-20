import type { Timestamp } from "firebase-admin/firestore";

export interface QuizSession {
  readonly userId: number;
  readonly lessonNumber: number;
  /** Index of the question whose poll is currently open (equals the question count once finished). */
  readonly questionIndex: number;
  readonly correctCount: number;
  /** Null while the poll for `questionIndex` is being sent or after its answer was counted. */
  readonly currentPollId: string | null;
  /** Also identifies the session: a restart writes a new value, so stale writers can detect it. */
  readonly startedAt: Timestamp;
}

/** The shape stored in Firestore: the Telegram user id is the document key. */
export type QuizSessionDocument = Omit<QuizSession, "userId">;
