import type { Context } from "grammy";
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

export function isPrivateChat(ctx: BotContext): boolean {
  return ctx.chat?.type === "private";
}
