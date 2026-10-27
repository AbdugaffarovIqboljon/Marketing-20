import type { Middleware } from "grammy";
import type { UserService } from "../../services/userService";
import type { BotContext } from "../context";

/** Refreshes lastActiveAt on every interaction and exposes the stored user as `ctx.user`. */
export function createTrackActivity(userService: UserService): Middleware<BotContext> {
  return async (ctx, next) => {
    if (ctx.from !== undefined) {
      ctx.user = await userService.touch(ctx.from.id);
    }
    await next();
  };
}
