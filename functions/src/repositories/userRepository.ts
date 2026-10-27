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

  async updateLastActive(id: number, at: Timestamp): Promise<void> {
    await this.users().doc(String(id)).update({ lastActiveAt: at });
  }

  private users() {
    return this.db.collection(USERS_COLLECTION);
  }
}
