import { Composer } from "grammy";
import { texts } from "../../config/texts";
import type { BotContext } from "../context";

/** Catches whatever no other handler claimed: stale buttons and unrecognised messages. */
export function createFallbackComposer(): Composer<BotContext> {
  const composer = new Composer<BotContext>();

  composer.on("callback_query", async (ctx) => {
    await ctx.answerCallbackQuery({ text: texts.staleCallback });
  });

  composer.on("message", async (ctx) => {
    await ctx.reply(ctx.user === undefined ? texts.startRequired : texts.unknownMessage);
  });

  return composer;
}
