import { InlineKeyboard } from "grammy";
import { texts } from "../../config/texts";
import { callbackData } from "../callbackData";

export function quizRetryKeyboard(lessonNumber: number): InlineKeyboard {
  return new InlineKeyboard().text(texts.retryQuizButton, callbackData.retryQuiz(lessonNumber));
}
