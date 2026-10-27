import { Composer } from "grammy";
import { texts } from "../../config/texts";
import type { LessonService } from "../../services/lessonService";
import type { UserService } from "../../services/userService";
import type { BotContext } from "../context";
import { mainMenuKeyboard } from "../keyboards/mainMenuKeyboard";

export function createStartComposer(userService: UserService, lessonService: LessonService): Composer<BotContext> {
  const composer = new Composer<BotContext>();

  composer.command("start", async (ctx) => {
    if (ctx.from === undefined) {
      return;
    }
    const { id, first_name: firstName, username } = ctx.from;
    // An existing user was already loaded by the activity middleware, so only
    // a first-time /start reaches register (and only then is the payload kept).
    const user = ctx.user ?? (await userService.register({ id, firstName, username: username ?? null }, ctx.match));

    await ctx.reply(texts.welcome(user.firstName), { reply_markup: mainMenuKeyboard(user.paid) });
    await lessonService.deliver(user, user.currentLesson);
  });

  return composer;
}
