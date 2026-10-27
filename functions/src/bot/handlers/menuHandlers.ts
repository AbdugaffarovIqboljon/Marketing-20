import { Composer } from "grammy";
import { texts } from "../../config/texts";
import type { LessonService } from "../../services/lessonService";
import type { UserContext } from "../context";
import { lessonListKeyboard } from "../keyboards/lessonKeyboards";

export function createMenuComposer(lessonService: LessonService): Composer<UserContext> {
  const composer = new Composer<UserContext>();

  composer.hears(texts.menu.lessons, async (ctx) => {
    const unlocked = lessonService.getUnlockedLessons(ctx.user);
    await ctx.reply(texts.lessonsListTitle, { reply_markup: lessonListKeyboard(unlocked) });
  });

  composer.hears(texts.menu.progress, async (ctx) => {
    const { passed, total } = lessonService.getProgress(ctx.user);
    await ctx.reply(texts.progress(passed, total, ctx.user.currentLesson));
  });

  composer.hears(texts.menu.help, async (ctx) => {
    await ctx.reply(texts.help);
  });

  return composer;
}
