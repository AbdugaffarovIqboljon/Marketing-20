import type { Context } from "grammy";
import { config } from "../config/config";
import type { User } from "../models/user";

/** `user` is set by the activity middleware and stays undefined until the person runs /start. */
export interface UserFlavor {
  user?: User;
}

export type BotContext = Context & UserFlavor;
export type UserContext = BotContext & { user: User };

export function hasUser(ctx: BotContext): ctx is UserContext {
  return ctx.user !== undefined;
}

/** poll_answer updates carry no chat, but the bot only sends quiz polls to private chats. */
export function isPrivateChat(ctx: BotContext): boolean {
  return ctx.chat?.type === "private" || ctx.pollAnswer !== undefined;
}

/**
 * The only group traffic the bot looks at: button presses and new messages in
 * the admin group. The admin composer handles just the pay and broadcast
 * buttons and the /stats and /broadcast commands; anything else is ignored.
 */
export function isAdminGroupUpdate(ctx: BotContext): boolean {
  return (
    ctx.callbackQuery?.message?.chat.id === config.adminGroupId ||
    ctx.message?.chat.id === config.adminGroupId
  );
}
