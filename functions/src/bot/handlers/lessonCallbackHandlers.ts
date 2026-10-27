import { Composer } from "grammy";
import { texts } from "../../config/texts";
import type { LessonService } from "../../services/lessonService";
import { callbackPatterns } from "../callbackData";
import type { UserContext } from "../context";

export function createLessonCallbackComposer(lessonService: LessonService): Composer<UserContext> {
  const composer = new Composer<UserContext>();

  composer.callbackQuery(callbackPatterns.openLesson, async (ctx) => {
    await ctx.answerCallbackQuery();
    await lessonService.deliver(ctx.user, Number(ctx.match[1]));
  });

  composer.callbackQuery(callbackPatterns.lessonWatched, async (ctx) => {
    await ctx.answerCallbackQuery({ text: texts.quizComingSoon });
  });

  return composer;
}
