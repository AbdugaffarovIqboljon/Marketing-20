import { Timestamp } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import type { TelegramProfile, User } from "../models/user";
import type { UserRepository } from "../repositories/userRepository";
import { describeError, isUserUnreachable } from "../utils/errors";

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

  /** Applies a block or unblock reported by Telegram's my_chat_member update. */
  async setBlocked(userId: number, blocked: boolean): Promise<void> {
    if (await this.users.setBlocked(userId, blocked)) {
      logger.info(blocked ? "User blocked the bot" : "User unblocked the bot", { userId });
    }
  }

  /**
   * The one place a failed send marks the user blocked. Resolves true when
   * the error means the user is unreachable. Never throws, so it is safe in
   * error paths.
   */
  async markIfUnreachable(userId: number, error: unknown): Promise<boolean> {
    if (!isUserUnreachable(error)) {
      return false;
    }
    try {
      await this.users.setBlocked(userId, true);
    } catch (storeError) {
      logger.error("Could not mark an unreachable user as blocked", { userId, error: describeError(storeError) });
    }
    return true;
  }
}
