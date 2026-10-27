import { Composer } from "grammy";
import { texts } from "../../config/texts";
import type { PaymentDecision } from "../../models/payment";
import type { PaymentService } from "../../services/paymentService";
import { callbackPatterns } from "../callbackData";
import type { BotContext } from "../context";

/** Admin group side of payments: approve and reject buttons on receipt cards. */
export function createAdminComposer(paymentService: PaymentService): Composer<BotContext> {
  const composer = new Composer<BotContext>();

  composer.callbackQuery(callbackPatterns.decidePayment, async (ctx) => {
    const [, action, paymentId] = ctx.match;
    if (paymentId === undefined) {
      await ctx.answerCallbackQuery({ text: texts.staleCallback });
      return;
    }
    const decision: PaymentDecision = action === "approve" ? "approved" : "rejected";
    const { id, first_name: firstName, username } = ctx.from;
    const name = username === undefined ? firstName : `${firstName} (@${username})`;
    const answer = await paymentService.decide(paymentId, decision, { id, name });
    await ctx.answerCallbackQuery({ text: answer });
  });

  return composer;
}
