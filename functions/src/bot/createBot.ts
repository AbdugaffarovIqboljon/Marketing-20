import { Bot, Composer } from "grammy";
import { UserRepository } from "../repositories/userRepository";
import { db } from "../repositories/firestore";
import { LessonService } from "../services/lessonService";
import { UserService } from "../services/userService";
import { hasUser, isPrivateChat, type BotContext } from "./context";
import { handleBotError } from "./errorHandler";
import { createFallbackComposer } from "./handlers/fallbackHandlers";
import { createLessonCallbackComposer } from "./handlers/lessonCallbackHandlers";
import { createMenuComposer } from "./handlers/menuHandlers";
import { createStartComposer } from "./handlers/startHandler";
import { createTrackActivity } from "./middleware/trackActivity";

/** Composition root: wires repositories, services and handlers together. */
export function createBot(token: string): Bot<BotContext> {
  const bot = new Bot<BotContext>(token);
  const userService = new UserService(new UserRepository(db));
  const lessonService = new LessonService(bot.api);

  bot.catch(handleBotError);

  const privateChat = new Composer<BotContext>();
  privateChat.use(createTrackActivity(userService));
  privateChat.use(createStartComposer(userService, lessonService));
  privateChat.filter(hasUser, createMenuComposer(lessonService), createLessonCallbackComposer(lessonService));
  privateChat.use(createFallbackComposer());
  bot.filter(isPrivateChat, privateChat);

  return bot;
}
