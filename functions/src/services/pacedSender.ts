import * as logger from "firebase-functions/logger";
import { describeError, retryAfterSeconds } from "../utils/errors";
import { sleep } from "../utils/time";
import type { UserService } from "./userService";

export type SendOutcome =
  | { readonly kind: "sent" }
  | { readonly kind: "blocked" }
  | { readonly kind: "failed"; readonly error: unknown }
  /** Not attempted, or flood control asked to wait past the deadline: retry on a later run. */
  | { readonly kind: "deferred" };

/**
 * Sends bulk messages one at a time, at most `ratePerSecond`, waiting out
 * Telegram's 429 retry_after. Never sends after `deadline` (epoch ms).
 * One instance per job run.
 */
export class PacedSender {
  private nextSendAt = 0;

  constructor(
    private readonly userService: UserService,
    private readonly ratePerSecond: number,
    private readonly deadline: number,
  ) {}

  get hasTimeLeft(): boolean {
    return Math.max(Date.now(), this.nextSendAt) < this.deadline;
  }

  async send(userId: number, deliver: () => Promise<unknown>): Promise<SendOutcome> {
    for (;;) {
      const waitMs = this.nextSendAt - Date.now();
      if (!this.hasTimeLeft) {
        return { kind: "deferred" };
      }
      if (waitMs > 0) {
        await sleep(waitMs);
      }
      this.nextSendAt = Date.now() + 1000 / this.ratePerSecond;

      try {
        await deliver();
        return { kind: "sent" };
      } catch (error) {
        const retryAfter = retryAfterSeconds(error);
        if (retryAfter !== undefined) {
          logger.warn("Flood control hit, waiting before the next send", { userId, retryAfter });
          this.nextSendAt = Date.now() + retryAfter * 1000;
          continue;
        }
        if (await this.userService.markIfUnreachable(userId, error)) {
          return { kind: "blocked" };
        }
        logger.warn("Bulk send failed", { userId, error: describeError(error) });
        return { kind: "failed", error };
      }
    }
  }
}
