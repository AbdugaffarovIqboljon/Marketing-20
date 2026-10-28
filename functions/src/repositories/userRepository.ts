import { FieldPath, Timestamp, type DocumentSnapshot, type Firestore, type Query } from "firebase-admin/firestore";
import type { BroadcastAudience } from "../models/broadcast";
import type { TelegramProfile, User, UserDocument } from "../models/user";

export const USERS_COLLECTION = "users";
const FIRST_LESSON = 1;

export function toUser(snapshot: DocumentSnapshot): User {
  return { id: Number(snapshot.id), ...(snapshot.data() as UserDocument) };
}

export class UserRepository {
  constructor(private readonly db: Firestore) {}

  async findById(id: number): Promise<User | undefined> {
    const snapshot = await this.users().doc(String(id)).get();
    return snapshot.exists ? toUser(snapshot) : undefined;
  }

  /**
   * Creates the user atomically, or returns the existing one untouched.
   * `source` and progress are written only on creation, so a repeat /start
   * can never overwrite them.
   */
  async createIfAbsent(profile: TelegramProfile, source: string | null): Promise<User> {
    const ref = this.users().doc(String(profile.id));

    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (snapshot.exists) {
        return toUser(snapshot);
      }

      const now = Timestamp.now();
      const document: UserDocument = {
        firstName: profile.firstName,
        username: profile.username,
        source,
        paid: false,
        currentLesson: FIRST_LESSON,
        passedLessons: [],
        createdAt: now,
        lastActiveAt: now,
        blocked: false,
        blockedAt: null,
        remindersSent: 0,
        firstReminderSentAt: null,
      };
      transaction.create(ref, document);
      return { id: profile.id, ...document };
    });
  }

  /**
   * Marks the lesson passed (idempotently) and unlocks the next one, capped at
   * `lessonCount`. Progress never moves backwards, so retakes are safe.
   */
  async recordLessonPassed(id: number, lessonNumber: number, lessonCount: number): Promise<User> {
    const ref = this.users().doc(String(id));

    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) {
        throw new Error(`User ${id} not found while recording lesson ${lessonNumber} as passed`);
      }

      const user = toUser(snapshot);
      const passedLessons = user.passedLessons.includes(lessonNumber)
        ? user.passedLessons
        : [...user.passedLessons, lessonNumber];
      const currentLesson = Math.min(lessonCount, Math.max(user.currentLesson, lessonNumber + 1));
      transaction.update(ref, { passedLessons, currentLesson });
      return { ...user, passedLessons, currentLesson };
    });
  }

  async updateLastActive(id: number, at: Timestamp): Promise<void> {
    await this.users().doc(String(id)).update({ lastActiveAt: at });
  }

  /** Stores whether the user blocked the bot; resolves false if the user does not exist. */
  async setBlocked(id: number, blocked: boolean): Promise<boolean> {
    const ref = this.users().doc(String(id));

    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) {
        return false;
      }
      if (toUser(snapshot).blocked !== blocked) {
        transaction.update(ref, { blocked, blockedAt: blocked ? Timestamp.now() : null });
      }
      return true;
    });
  }

  async countAudience(audience: BroadcastAudience): Promise<number> {
    const snapshot = await this.audience(audience).count().get();
    return snapshot.data().count;
  }

  /** Next recipients in user-id order, strictly after `afterId`. */
  async findAudiencePage(audience: BroadcastAudience, afterId: string | null, limit: number): Promise<User[]> {
    let query = this.audience(audience).orderBy(FieldPath.documentId()).limit(limit);
    if (afterId !== null) {
      query = query.startAfter(afterId);
    }
    return (await query.get()).docs.map(toUser);
  }

  /** Unpaid, unblocked users created before `createdBefore` who got exactly `remindersSent` reminders. */
  async findDueForReminder(
    remindersSent: number,
    createdBefore: Timestamp,
    after: User | null,
    limit: number,
  ): Promise<User[]> {
    let query = this.users()
      .where("paid", "==", false)
      .where("blocked", "==", false)
      .where("remindersSent", "==", remindersSent)
      .where("createdAt", "<", createdBefore)
      .orderBy("createdAt")
      .orderBy(FieldPath.documentId())
      .limit(limit);
    if (after !== null) {
      query = query.startAfter(after.createdAt, String(after.id));
    }
    return (await query.get()).docs.map(toUser);
  }

  /**
   * Moves remindersSent from `reminder - 1` to `reminder` before the reminder
   * is sent, so it can never go out twice. Claiming reminder 1 also stamps
   * firstReminderSentAt. Resolves false if the user paid,
   * blocked the bot or already got it.
   */
  async claimReminder(id: number, reminder: number): Promise<boolean> {
    const ref = this.users().doc(String(id));

    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) {
        return false;
      }
      const user = toUser(snapshot);
      if (user.paid || user.blocked || user.remindersSent !== reminder - 1) {
        return false;
      }
      transaction.update(
        ref,
        reminder === 1 ? { remindersSent: 1, firstReminderSentAt: Timestamp.now() } : { remindersSent: reminder },
      );
      return true;
    });
  }

  /** Undoes claimReminder when the reminder was not sent, so the next run retries it. */
  async releaseReminder(id: number, reminder: number): Promise<void> {
    const ref = this.users().doc(String(id));

    await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (snapshot.exists && toUser(snapshot).remindersSent === reminder) {
        transaction.update(
          ref,
          reminder === 1 ? { remindersSent: 0, firstReminderSentAt: null } : { remindersSent: reminder - 1 },
        );
      }
    });
  }

  private audience(audience: BroadcastAudience): Query {
    const reachable = this.users().where("blocked", "==", false);
    return audience === "all" ? reachable : reachable.where("paid", "==", audience === "paid");
  }

  private users() {
    return this.db.collection(USERS_COLLECTION);
  }
}
