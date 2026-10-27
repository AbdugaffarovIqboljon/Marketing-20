import type { BotError } from "grammy";
import * as logger from "firebase-functions/logger";
import { texts } from "../config/texts";
import { describeError, isUserUnreachable } from "../utils/errors";
import type { BotContext } from "./context";

/**
 * Terminal error boundary for every update. It must never throw: a rejected
 * handler would turn the webhook response into a 500 and Telegram would retry.
 */
export async function handleBotError({ error, ctx }: BotError<BotContext>): Promise<void> {
  const updateId = ctx.update.update_id;

  if (isUserUnreachable(error)) {
    logger.warn("Update dropped: the user blocked the bot", { updateId });
    return;
  }

  logger.error("Unhandled bot error", { updateId, error: describeError(error) });

  try {
    await ctx.reply(texts.genericError);
  } catch (replyError) {
    logger.warn("Could not deliver the error notice", { updateId, error: describeError(replyError) });
  }
}
