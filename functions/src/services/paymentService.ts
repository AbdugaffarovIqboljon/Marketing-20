import type { Api } from "grammy";
import * as logger from "firebase-functions/logger";
import { mainMenuKeyboard } from "../bot/keyboards/mainMenuKeyboard";
import { adminDecisionKeyboard, paywallKeyboard } from "../bot/keyboards/paymentKeyboards";
import { config } from "../config/config";
import { texts } from "../config/texts";
import type { Payment, PaymentAdmin, PaymentDecision, Receipt } from "../models/payment";
import type { User } from "../models/user";
import type { PaymentRepository } from "../repositories/paymentRepository";
import { describeError, isUserUnreachable } from "../utils/errors";
import type { LessonService } from "./lessonService";

function adminCaption(payment: Payment, user: User): string {
  return texts.adminReceiptCaption({
    firstName: user.firstName,
    username: user.username,
    userId: user.id,
    source: user.source,
    amount: payment.amount,
    createdAt: payment.createdAt.toDate(),
  });
}

export class PaymentService {
  constructor(
    private readonly api: Api,
    private readonly payments: PaymentRepository,
    private readonly lessonService: LessonService,
  ) {}

  async showPaywall(user: User): Promise<void> {
    if (user.paid) {
      await this.sendAlreadyPaid(user);
      return;
    }
    await this.api.sendMessage(user.id, texts.paywall, { reply_markup: paywallKeyboard() });
  }

  /** Shows the card details with the user's unique amount, reusing their open payment. */
  async startPayment(user: User): Promise<void> {
    if (user.paid) {
      await this.sendAlreadyPaid(user);
      return;
    }

    const payment = await this.payments.openForUser(user.id, config.priceUzs, config.paymentAmountTailMax);
    if (payment === undefined) {
      logger.error("No free unique payment amount left", { userId: user.id, tailMax: config.paymentAmountTailMax });
      await this.api.sendMessage(user.id, texts.paymentUnavailable);
      return;
    }
    if (payment.status === "pending") {
      await this.api.sendMessage(user.id, texts.receiptAlreadyPending);
      return;
    }
    await this.api.sendMessage(user.id, texts.paymentDetails(payment.amount), { parse_mode: "HTML" });
  }

  /** Forwards a receipt to the admin group and marks the payment pending. */
  async receiveReceipt(user: User, messageId: number, receipt: Receipt): Promise<void> {
    if (user.paid) {
      await this.api.sendMessage(user.id, texts.unknownMessage);
      return;
    }

    const payment = await this.payments.findOpenByUserId(user.id);
    if (payment === undefined) {
      await this.api.sendMessage(user.id, texts.receiptNoPayment, { reply_markup: paywallKeyboard() });
      return;
    }
    // A lost claim means a concurrent receipt (e.g. a photo album) already moved it to pending.
    if (payment.status === "pending" || !(await this.payments.claimReceipt(payment.id, receipt))) {
      await this.api.sendMessage(user.id, texts.receiptAlreadyPending);
      return;
    }

    try {
      const card = await this.api.copyMessage(config.adminGroupId, user.id, messageId, {
        caption: adminCaption(payment, user),
        parse_mode: "HTML",
        reply_markup: adminDecisionKeyboard(payment.id),
      });
      await this.payments.setAdminMessageId(payment.id, card.message_id);
    } catch (error) {
      logger.error("Receipt not forwarded to the admin group", {
        userId: user.id,
        paymentId: payment.id,
        adminGroupId: config.adminGroupId,
        error: describeError(error),
      });
      await this.payments.releaseReceipt(payment.id);
      await this.api.sendMessage(user.id, texts.receiptForwardFailed);
      return;
    }

    await this.api.sendMessage(user.id, texts.receiptReceived);
  }

  /** Accepts image and PDF documents as receipts; anything else gets the file-type hint. */
  async receiveDocument(user: User, messageId: number, fileId: string, mimeType: string | undefined): Promise<void> {
    if (mimeType !== undefined && (mimeType.startsWith("image/") || mimeType === "application/pdf")) {
      await this.receiveReceipt(user, messageId, { fileId, type: "document" });
      return;
    }
    await this.rejectFileType(user);
  }

  async rejectFileType(user: User): Promise<void> {
    await this.api.sendMessage(user.id, texts.receiptWrongType);
  }

  /** Applies an admin decision once; resolves to the text for the admin's callback answer. */
  async decide(paymentId: string, decision: PaymentDecision, admin: PaymentAdmin): Promise<string> {
    const result = await this.payments.decide(paymentId, decision, admin);
    switch (result.kind) {
      case "not_pending":
        logger.warn("Payment decision ignored: payment is not pending", { paymentId, adminId: admin.id });
        return texts.staleCallback;
      case "already_decided":
        return texts.adminAlreadyDecided(result.payment.status === "approved", result.payment.decidedBy?.name ?? "—");
      case "decided":
        logger.info("Payment decided", { paymentId, decision, adminId: admin.id, userId: result.user.id });
        await this.markAdminCard(result.payment, result.user, admin);
        await this.notifyUser(result.user, decision);
        return texts.adminDecided(decision === "approved");
    }
  }

  private async markAdminCard(payment: Payment, user: User, admin: PaymentAdmin): Promise<void> {
    if (payment.adminMessageId === null || payment.decidedAt === null) {
      return;
    }
    const decisionLine = texts.adminDecisionLine(payment.status === "approved", admin.name, payment.decidedAt.toDate());
    try {
      await this.api.editMessageCaption(config.adminGroupId, payment.adminMessageId, {
        caption: `${adminCaption(payment, user)}\n\n${decisionLine}`,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [] },
      });
    } catch (error) {
      logger.warn("Admin card not updated after the decision", { paymentId: payment.id, error: describeError(error) });
    }
  }

  private async notifyUser(user: User, decision: PaymentDecision): Promise<void> {
    try {
      if (decision === "rejected") {
        await this.api.sendMessage(user.id, texts.paymentRejected);
        return;
      }
      await this.api.sendMessage(user.id, texts.paymentApproved, { reply_markup: mainMenuKeyboard(true) });
      await this.lessonService.deliver(user, user.currentLesson);
    } catch (error) {
      if (isUserUnreachable(error)) {
        logger.warn("Payment decision saved, but the user blocked the bot", { userId: user.id, decision });
        return;
      }
      logger.error("Payment decision saved, but the user was not notified", {
        userId: user.id,
        decision,
        error: describeError(error),
      });
    }
  }

  private async sendAlreadyPaid(user: User): Promise<void> {
    await this.api.sendMessage(user.id, texts.alreadyPaid, { reply_markup: mainMenuKeyboard(true) });
    await this.lessonService.deliver(user, user.currentLesson);
  }
}
