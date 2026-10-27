import type { BotError } from "grammy";
import * as logger from "firebase-functions/logger";
import { texts } from "../config/texts";
import type { UserService } from "../services/userService";
import { describeError } from "../utils/errors";
import { isPrivateChat, type BotContext } from "./context";

/**
 * Terminal error boundary for every update. It must never throw: a rejected
 * handler would turn the webhook response into a 500 and Telegram would retry.
 */
export function createErrorHandler(userService: UserService): (botError: BotError<BotContext>) => Promise<void> {
  return async ({ error, ctx }) => {
    const updateId = ctx.update.update_id;
    // Only private-chat failures are about the person who sent the update.
    const userId = isPrivateChat(ctx) ? (ctx.from ?? ctx.pollAnswer?.user)?.id : undefined;

    if (userId !== undefined && (await userService.markIfUnreachable(userId, error))) {
      logger.warn("Update dropped: the user blocked the bot", { updateId });
      return;
    }

    logger.error("Unhandled bot error", { updateId, error: describeError(error) });

    try {
      await ctx.reply(texts.genericError);
    } catch (replyError) {
      logger.warn("Could not deliver the error notice", { updateId, error: describeError(replyError) });
    }
  };
}
