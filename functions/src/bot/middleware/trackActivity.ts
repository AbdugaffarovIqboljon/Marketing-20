import type { Middleware } from "grammy";
import type { UserService } from "../../services/userService";
import type { BotContext } from "../context";

/** Refreshes lastActiveAt on every interaction and exposes the stored user as `ctx.user`. */
export function createTrackActivity(userService: UserService): Middleware<BotContext> {
  return async (ctx, next) => {
    // grammY's ctx.from does not cover poll_answer, so take the voter explicitly.
    const from = ctx.from ?? ctx.pollAnswer?.user;
    if (from !== undefined) {
      ctx.user = await userService.touch(from.id);
    }
    await next();
  };
}
