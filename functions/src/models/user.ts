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
  /** Set when the user blocks the bot or Telegram reports them unreachable; cleared when they come back. */
  readonly blocked: boolean;
  readonly blockedAt: Timestamp | null;
  /** How many payment reminders were sent (0, 1 or 2); claimed before sending so none repeats. */
  readonly remindersSent: number;
  /** When reminder 1 was claimed and sent; null until then. Reminder 2 waits reminderMinGapHours after it. */
  readonly firstReminderSentAt: Timestamp | null;
}

/** The shape stored in Firestore: the Telegram user id is the document key. */
export type UserDocument = Omit<User, "id">;

export interface TelegramProfile {
  readonly id: number;
  readonly firstName: string;
  readonly username: string | null;
}
