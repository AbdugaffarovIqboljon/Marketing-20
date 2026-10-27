import type { Api } from "grammy";
import * as logger from "firebase-functions/logger";
import { lessonWatchedKeyboard } from "../bot/keyboards/lessonKeyboards";
import { config } from "../config/config";
import { texts } from "../config/texts";
import { getLesson, lessons, type Lesson } from "../content/lessons";
import type { User } from "../models/user";
import { describeError, isUserUnreachable } from "../utils/errors";

type Access = "granted" | "locked" | "not_reached";

export interface Progress {
  readonly passed: number;
  readonly total: number;
}

function resolveAccess(user: User, lessonNumber: number): Access {
  if (lessonNumber > config.freeLessonCount && !user.paid) {
    return "locked";
  }
  if (lessonNumber > user.currentLesson) {
    return "not_reached";
  }
  return "granted";
}

export class LessonService {
  constructor(private readonly api: Api) {}

  /** Sends the lesson video, or a user-facing explanation when it cannot be opened. */
  async deliver(user: User, lessonNumber: number): Promise<void> {
    try {
      await this.sendLesson(user, lessonNumber);
    } catch (error) {
      await this.handleDeliveryFailure(error, user, lessonNumber);
    }
  }

  getUnlockedLessons(user: User): readonly Lesson[] {
    return lessons.filter((lesson) => resolveAccess(user, lesson.number) === "granted");
  }

  getProgress(user: User): Progress {
    return { passed: user.passedLessons.length, total: config.lessonCount };
  }

  private async sendLesson(user: User, lessonNumber: number): Promise<void> {
    const lesson = getLesson(lessonNumber);
    if (lesson === undefined) {
      await this.api.sendMessage(user.id, texts.lessonNotFound);
      return;
    }

    switch (resolveAccess(user, lessonNumber)) {
      case "locked":
        await this.api.sendMessage(user.id, texts.lessonLocked(lessonNumber));
        return;
      case "not_reached":
        await this.api.sendMessage(user.id, texts.lessonNotReached(lessonNumber));
        return;
      case "granted":
        await this.api.copyMessage(user.id, config.storageChannelId, lesson.storageMessageId, {
          caption: texts.lessonLabel(lesson.number, lesson.title),
          protect_content: true,
          reply_markup: lessonWatchedKeyboard(lesson.number),
        });
    }
  }

  private async handleDeliveryFailure(error: unknown, user: User, lessonNumber: number): Promise<void> {
    if (isUserUnreachable(error)) {
      logger.warn("Lesson not delivered: the user blocked the bot", { userId: user.id, lessonNumber });
      return;
    }

    logger.error("Lesson delivery failed", {
      userId: user.id,
      lessonNumber,
      storageChannelId: config.storageChannelId,
      storageMessageId: getLesson(lessonNumber)?.storageMessageId,
      error: describeError(error),
    });
    await this.api.sendMessage(user.id, texts.lessonUnavailable);
  }
}
