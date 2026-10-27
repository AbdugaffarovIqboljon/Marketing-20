import { Timestamp } from "firebase-admin/firestore";
import type { Api } from "grammy";
import * as logger from "firebase-functions/logger";
import { paywallKeyboard } from "../bot/keyboards/paymentKeyboards";
import { config } from "../config/config";
import { texts } from "../config/texts";
import type { User } from "../models/user";
import type { UserRepository } from "../repositories/userRepository";
import { hourInTimeZone, hoursToMs } from "../utils/time";
import { PacedSender } from "./pacedSender";
import type { UserService } from "./userService";

interface ReminderStep {
  /** 1 or 2: the value remindersSent takes once this reminder is sent. */
  readonly reminder: number;
  readonly afterHours: number;
  readonly text: string;
}

// The second reminder goes first, so a user who gets the first one in this run cannot also get the second.
const STEPS: readonly ReminderStep[] = [
  { reminder: 2, afterHours: config.reminderSecondAfterHours, text: texts.reminderSecond },
  { reminder: 1, afterHours: config.reminderFirstAfterHours, text: texts.reminderFirst },
];

export class ReminderService {
  constructor(
    private readonly api: Api,
    private readonly users: UserRepository,
    private readonly userService: UserService,
  ) {}

  /** Hourly job: sends due payment reminders to unpaid, unblocked users within the local sending hours. */
  async sendDue(deadline: number): Promise<void> {
    const hour = hourInTimeZone(new Date(), config.timeZone);
    if (hour < config.reminderFromHour || hour >= config.reminderUntilHour) {
      logger.debug("Reminders skipped: outside sending hours", { hour });
      return;
    }

    const sender = new PacedSender(this.userService, config.broadcastRatePerSecond, deadline);
    for (const step of STEPS) {
      if (!(await this.sendStep(step, sender))) {
        logger.info("Reminders paused until the next run: time budget used up", { reminder: step.reminder });
        return;
      }
    }
  }

  /** Resolves false when the run ran out of time before the step was done. */
  private async sendStep(step: ReminderStep, sender: PacedSender): Promise<boolean> {
    const createdBefore = Timestamp.fromMillis(Date.now() - hoursToMs(step.afterHours));
    const counts = { sent: 0, failed: 0, blocked: 0 };
    let after: User | null = null;

    for (;;) {
      const due = await this.users.findDueForReminder(step.reminder - 1, createdBefore, after, config.reminderBatchSize);
      if (due.length === 0) {
        if (counts.sent + counts.failed + counts.blocked > 0) {
          logger.info("Reminders sent", { reminder: step.reminder, ...counts });
        }
        return true;
      }

      for (const user of due) {
        if (!sender.hasTimeLeft) {
          return false;
        }
        after = user;
        if (!(await this.users.claimReminder(user.id, step.reminder))) {
          continue;
        }
        const outcome = await sender.send(user.id, () =>
          this.api.sendMessage(user.id, step.text, { reply_markup: paywallKeyboard() }),
        );
        if (outcome.kind === "deferred") {
          await this.users.releaseReminder(user.id, step.reminder);
          return false;
        }
        counts[outcome.kind] += 1;
      }
    }
  }
}
