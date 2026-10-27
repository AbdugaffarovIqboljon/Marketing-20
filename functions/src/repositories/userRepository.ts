import { Timestamp, type DocumentSnapshot, type Firestore } from "firebase-admin/firestore";
import type { TelegramProfile, User, UserDocument } from "../models/user";

const USERS_COLLECTION = "users";
const FIRST_LESSON = 1;

function toUser(snapshot: DocumentSnapshot): User {
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

  private users() {
    return this.db.collection(USERS_COLLECTION);
  }
}
