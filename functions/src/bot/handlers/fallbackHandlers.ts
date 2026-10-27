import { Composer } from "grammy";
import * as logger from "firebase-functions/logger";
import { texts } from "../../config/texts";
import type { BotContext } from "../context";

/** Catches whatever no other handler claimed: stale buttons, unrecognised messages and stray poll answers. */
export function createFallbackComposer(): Composer<BotContext> {
  const composer = new Composer<BotContext>();

  composer.on("callback_query", async (ctx) => {
    await ctx.answerCallbackQuery({ text: texts.staleCallback });
  });

  composer.on("poll_answer", (ctx) => {
    logger.debug("Poll answer ignored: unknown user", { pollId: ctx.pollAnswer.poll_id, userId: ctx.pollAnswer.user?.id });
  });

  composer.on("message", async (ctx) => {
    await ctx.reply(ctx.user === undefined ? texts.startRequired : texts.unknownMessage);
  });

  return composer;
}
