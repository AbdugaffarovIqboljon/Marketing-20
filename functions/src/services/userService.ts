import { Timestamp } from "firebase-admin/firestore";
import type { TelegramProfile, User } from "../models/user";
import type { UserRepository } from "../repositories/userRepository";

const SOURCE_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export class UserService {
  constructor(private readonly users: UserRepository) {}

  /** Records activity for an existing user; resolves to undefined if they never ran /start. */
  async touch(userId: number): Promise<User | undefined> {
    const user = await this.users.findById(userId);
    if (user === undefined) {
      return undefined;
    }

    const lastActiveAt = Timestamp.now();
    await this.users.updateLastActive(userId, lastActiveAt);
    return { ...user, lastActiveAt };
  }

  /** Registers a new user. If they already exist, the stored user is returned unchanged. */
  register(profile: TelegramProfile, startPayload: string): Promise<User> {
    const source = SOURCE_PATTERN.test(startPayload) ? startPayload : null;
    return this.users.createIfAbsent(profile, source);
  }
}
