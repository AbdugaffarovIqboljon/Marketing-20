import type { Timestamp } from "firebase-admin/firestore";

export interface User {
  readonly id: number;
  readonly firstName: string;
  readonly username: string | null;
  readonly source: string | null;
  readonly paid: boolean;
  readonly currentLesson: number;
  readonly passedLessons: readonly number[];
  readonly createdAt: Timestamp;
  readonly lastActiveAt: Timestamp;
}

/** The shape stored in Firestore: the Telegram user id is the document key. */
export type UserDocument = Omit<User, "id">;

export interface TelegramProfile {
  readonly id: number;
  readonly firstName: string;
  readonly username: string | null;
}
