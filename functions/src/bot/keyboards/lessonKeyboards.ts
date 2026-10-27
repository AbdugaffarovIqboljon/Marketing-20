import { InlineKeyboard } from "grammy";
import { texts } from "../../config/texts";
import type { Lesson } from "../../content/lessons";
import { callbackData } from "../callbackData";

export function lessonListKeyboard(lessons: readonly Lesson[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const lesson of lessons) {
    keyboard
      .text(texts.lessonLabel(lesson.number, lesson.title), callbackData.openLesson(lesson.number))
      .row();
  }
  return keyboard;
}

export function lessonWatchedKeyboard(lessonNumber: number): InlineKeyboard {
  return new InlineKeyboard().text(texts.watchedButton, callbackData.lessonWatched(lessonNumber));
}
