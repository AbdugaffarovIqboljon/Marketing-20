import { Composer } from "grammy";
import { texts } from "../../config/texts";
import { isBroadcastAudience, type BroadcastAdmin } from "../../models/broadcast";
import type { PaymentDecision } from "../../models/payment";
import type { BroadcastPrompt, BroadcastService } from "../../services/broadcastService";
import type { PaymentService } from "../../services/paymentService";
import type { StatsService } from "../../services/statsService";
import { callbackPatterns } from "../callbackData";
import type { BotContext } from "../context";

function adminOf(ctx: BotContext): BroadcastAdmin | undefined {
  if (ctx.from === undefined) {
    return undefined;
  }
  const { id, first_name: firstName, username } = ctx.from;
  return { id, name: username === undefined ? firstName : `${firstName} (@${username})` };
}

/** The broadcast prompt a button sits on; undefined once Telegram no longer exposes it. */
function promptOf(ctx: BotContext): BroadcastPrompt | undefined {
  const message = ctx.callbackQuery?.message;
  if (message === undefined || !("reply_to_message" in message) || message.reply_to_message === undefined) {
    return undefined;
  }
  return { statusMessageId: message.message_id, sourceMessageId: message.reply_to_message.message_id };
}

/** Admin group: payment decisions, /stats and the /broadcast flow. */
export function createAdminComposer(
  paymentService: PaymentService,
  statsService: StatsService,
  broadcastService: BroadcastService,
): Composer<BotContext> {
  const composer = new Composer<BotContext>();

  composer.callbackQuery(callbackPatterns.decidePayment, async (ctx) => {
    const [, action, paymentId] = ctx.match;
    const admin = adminOf(ctx);
    if (paymentId === undefined || admin === undefined) {
      await ctx.answerCallbackQuery({ text: texts.staleCallback });
      return;
    }
    const decision: PaymentDecision = action === "approve" ? "approved" : "rejected";
    const answer = await paymentService.decide(paymentId, decision, admin);
    await ctx.answerCallbackQuery({ text: answer });
  });

  composer.command("stats", async (ctx) => {
    await ctx.reply(await statsService.buildReport());
  });

  composer.command("broadcast", async (ctx) => {
    if (ctx.message === undefined) {
      return;
    }
    await broadcastService.prompt(ctx.message.message_id, ctx.message.reply_to_message, ctx.me.id);
  });

  composer.callbackQuery(callbackPatterns.broadcastAudience, async (ctx) => {
    const audience = ctx.match[1];
    const prompt = promptOf(ctx);
    if (!isBroadcastAudience(audience) || prompt === undefined) {
      await ctx.answerCallbackQuery({ text: texts.staleCallback });
      return;
    }
    await ctx.answerCallbackQuery();
    await broadcastService.preview(prompt, audience);
  });

  composer.callbackQuery(callbackPatterns.confirmBroadcast, async (ctx) => {
    const audience = ctx.match[1];
    const prompt = promptOf(ctx);
    const admin = adminOf(ctx);
    if (!isBroadcastAudience(audience) || prompt === undefined || admin === undefined) {
      await ctx.answerCallbackQuery({ text: texts.staleCallback });
      return;
    }
    const answer = await broadcastService.confirm(prompt, audience, admin);
    await ctx.answerCallbackQuery({ text: answer });
  });

  composer.callbackQuery(callbackPatterns.cancelBroadcast, async (ctx) => {
    const prompt = promptOf(ctx);
    if (prompt === undefined) {
      await ctx.answerCallbackQuery({ text: texts.staleCallback });
      return;
    }
    await ctx.answerCallbackQuery({ text: texts.broadcastCancelled });
    await broadcastService.cancel(prompt);
  });

  return composer;
}
