import { randomUUID } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import type { Api, InlineKeyboard } from "grammy";
import type { Message } from "grammy/types";
import * as logger from "firebase-functions/logger";
import { broadcastAudienceKeyboard, broadcastConfirmKeyboard } from "../bot/keyboards/broadcastKeyboards";
import { config } from "../config/config";
import { texts } from "../config/texts";
import type { Broadcast, BroadcastAdmin, BroadcastAudience, BroadcastCounters } from "../models/broadcast";
import type { BroadcastRepository } from "../repositories/broadcastRepository";
import type { UserRepository } from "../repositories/userRepository";
import { describeError, isCopySourceMissing } from "../utils/errors";
import { PacedSender } from "./pacedSender";
import type { UserService } from "./userService";

/** The admin-group prompt message and the message it replies to, which is what gets broadcast. */
export interface BroadcastPrompt {
  readonly statusMessageId: number;
  readonly sourceMessageId: number;
}

type RunResult =
  | { readonly kind: "paused"; readonly cursor: string | null; readonly delta: BroadcastCounters }
  | { readonly kind: "finished"; readonly status: "done" | "aborted"; readonly delta: BroadcastCounters }
  | { readonly kind: "lease_lost" };

function leaseUntil(): Timestamp {
  return Timestamp.fromMillis(Date.now() + config.broadcastLeaseMs);
}

export class BroadcastService {
  constructor(
    private readonly api: Api,
    private readonly broadcasts: BroadcastRepository,
    private readonly users: UserRepository,
    private readonly userService: UserService,
  ) {}

  /** Answers /broadcast: checks the replied-to message, then asks for the audience. */
  async prompt(commandMessageId: number, source: Message | undefined, botId: number): Promise<void> {
    const reply = { reply_parameters: { message_id: commandMessageId } };
    // In forum groups a plain message "replies" to the topic's service message.
    if (source === undefined || source.forum_topic_created !== undefined) {
      await this.api.sendMessage(config.adminGroupId, texts.broadcastReplyRequired, reply);
      return;
    }
    if (source.from?.id === botId) {
      await this.api.sendMessage(config.adminGroupId, texts.broadcastOwnMessage, reply);
      return;
    }
    if (await this.broadcasts.hasActive()) {
      await this.api.sendMessage(config.adminGroupId, texts.broadcastBusy, reply);
      return;
    }
    await this.api.sendMessage(config.adminGroupId, texts.broadcastChooseAudience, {
      reply_parameters: { message_id: source.message_id },
      reply_markup: broadcastAudienceKeyboard(),
    });
  }

  /** Shows the recipient count for the chosen audience with confirm and cancel buttons. */
  async preview(prompt: BroadcastPrompt, audience: BroadcastAudience): Promise<void> {
    const count = await this.users.countAudience(audience);
    if (count === 0) {
      await this.editPrompt(prompt, texts.broadcastNoRecipients(audience), broadcastAudienceKeyboard());
      return;
    }
    await this.editPrompt(prompt, texts.broadcastConfirm(audience, count), broadcastConfirmKeyboard(audience));
  }

  /** Queues the broadcast for the every-minute job; resolves to the admin's callback answer. */
  async confirm(prompt: BroadcastPrompt, audience: BroadcastAudience, admin: BroadcastAdmin): Promise<string> {
    const total = await this.users.countAudience(audience);
    if (total === 0) {
      await this.editPrompt(prompt, texts.broadcastNoRecipients(audience), broadcastAudienceKeyboard());
      return texts.broadcastNoRecipients(audience);
    }

    const broadcast = await this.broadcasts.createIfIdle({
      sourceChatId: config.adminGroupId,
      sourceMessageId: prompt.sourceMessageId,
      statusMessageId: prompt.statusMessageId,
      audience,
      total,
      createdBy: admin,
    });
    if (broadcast === undefined) {
      return texts.broadcastBusy;
    }

    logger.info("Broadcast queued", { broadcastId: broadcast.id, audience, total, adminId: admin.id });
    await this.editPrompt(prompt, texts.broadcastQueued(audience, total));
    return texts.broadcastStarted;
  }

  async cancel(prompt: BroadcastPrompt): Promise<void> {
    await this.editPrompt(prompt, texts.broadcastCancelled);
  }

  /** Every-minute job: sends the active broadcast until `deadline`, then saves where it stopped. */
  async processActive(deadline: number): Promise<void> {
    const active = await this.broadcasts.findActive();
    if (active === undefined) {
      return;
    }
    const leaseId = randomUUID();
    const broadcast = await this.broadcasts.acquireLease(active.id, leaseId, leaseUntil());
    if (broadcast === undefined) {
      logger.info("Broadcast run skipped: another run holds the lease", { broadcastId: active.id });
      return;
    }

    const sender = new PacedSender(this.userService, config.broadcastRatePerSecond, deadline);
    const result = await this.send(broadcast, leaseId, sender);
    switch (result.kind) {
      case "lease_lost":
        logger.warn("Broadcast run stopped: the lease was taken over", { broadcastId: broadcast.id });
        return;
      case "paused":
        await this.pause(broadcast, leaseId, result.cursor, result.delta);
        return;
      case "finished":
        await this.finish(broadcast, leaseId, result.status, result.delta);
        return;
    }
  }

  /**
   * Walks recipients in id order. The cursor is saved past each batch before
   * sending it, so a crash can skip part of a batch but never repeat a send.
   */
  private async send(broadcast: Broadcast, leaseId: string, sender: PacedSender): Promise<RunResult> {
    let cursor = broadcast.cursor;
    let delta = { sent: 0, failed: 0, blocked: 0 };

    while (sender.hasTimeLeft) {
      const recipients = await this.users.findAudiencePage(broadcast.audience, cursor, config.broadcastBatchSize);
      const last = recipients.at(-1);
      if (last === undefined) {
        return { kind: "finished", status: "done", delta };
      }
      if (!(await this.broadcasts.checkpoint(broadcast.id, leaseId, String(last.id), delta, leaseUntil()))) {
        return { kind: "lease_lost" };
      }
      delta = { sent: 0, failed: 0, blocked: 0 };

      for (const recipient of recipients) {
        const outcome = await sender.send(recipient.id, () =>
          this.api.copyMessage(recipient.id, broadcast.sourceChatId, broadcast.sourceMessageId),
        );
        if (outcome.kind === "deferred") {
          return { kind: "paused", cursor, delta };
        }
        if (outcome.kind === "failed" && isCopySourceMissing(outcome.error)) {
          return { kind: "finished", status: "aborted", delta };
        }
        delta[outcome.kind] += 1;
        cursor = String(recipient.id);
      }
    }
    return { kind: "paused", cursor, delta };
  }

  private async pause(broadcast: Broadcast, leaseId: string, cursor: string | null, delta: BroadcastCounters): Promise<void> {
    if (!(await this.broadcasts.checkpoint(broadcast.id, leaseId, cursor, delta, null))) {
      logger.warn("Broadcast progress not saved: the lease was taken over", { broadcastId: broadcast.id });
      return;
    }
    const progress: Broadcast = {
      ...broadcast,
      sent: broadcast.sent + delta.sent,
      failed: broadcast.failed + delta.failed,
      blocked: broadcast.blocked + delta.blocked,
    };
    logger.info("Broadcast paused until the next run", { broadcastId: broadcast.id, cursor, ...delta });
    try {
      await this.api.editMessageText(config.adminGroupId, broadcast.statusMessageId, texts.broadcastProgress(progress));
    } catch (error) {
      // "message is not modified" or a deleted prompt must not stop the broadcast.
      logger.debug("Broadcast progress not shown", { broadcastId: broadcast.id, error: describeError(error) });
    }
  }

  private async finish(
    broadcast: Broadcast,
    leaseId: string,
    status: "done" | "aborted",
    delta: BroadcastCounters,
  ): Promise<void> {
    const final = await this.broadcasts.finish(broadcast.id, leaseId, delta, status);
    if (final === undefined) {
      logger.warn("Broadcast not closed: the lease was taken over", { broadcastId: broadcast.id });
      return;
    }
    const log = { broadcastId: final.id, sent: final.sent, failed: final.failed, blocked: final.blocked };
    if (status === "aborted") {
      logger.error("Broadcast aborted: the source message was deleted", log);
    } else {
      logger.info("Broadcast finished", log);
    }
    try {
      await this.api.sendMessage(
        config.adminGroupId,
        status === "aborted" ? texts.broadcastAborted(final) : texts.broadcastFinished(final),
        { reply_parameters: { message_id: final.statusMessageId, allow_sending_without_reply: true } },
      );
    } catch (error) {
      logger.error("Broadcast result not posted to the admin group", { ...log, error: describeError(error) });
    }
  }

  private async editPrompt(prompt: BroadcastPrompt, text: string, keyboard?: InlineKeyboard): Promise<void> {
    await this.api.editMessageText(config.adminGroupId, prompt.statusMessageId, text, {
      reply_markup: keyboard ?? { inline_keyboard: [] },
    });
  }
}
