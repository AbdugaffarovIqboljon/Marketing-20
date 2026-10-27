import { Bot, Composer } from "grammy";
import { PaymentRepository } from "../repositories/paymentRepository";
import { QuizSessionRepository } from "../repositories/quizSessionRepository";
import { UserRepository } from "../repositories/userRepository";
import { db } from "../repositories/firestore";
import { LessonService } from "../services/lessonService";
import { PaymentService } from "../services/paymentService";
import { QuizService } from "../services/quizService";
import { UserService } from "../services/userService";
import { hasUser, isAdminGroupCallback, isPrivateChat, type BotContext } from "./context";
import { handleBotError } from "./errorHandler";
import { createAdminComposer } from "./handlers/adminHandlers";
import { createFallbackComposer } from "./handlers/fallbackHandlers";
import { createLessonCallbackComposer } from "./handlers/lessonCallbackHandlers";
import { createMenuComposer } from "./handlers/menuHandlers";
import { createPaymentComposer } from "./handlers/paymentHandlers";
import { createQuizComposer } from "./handlers/quizHandlers";
import { createStartComposer } from "./handlers/startHandler";
import { createTrackActivity } from "./middleware/trackActivity";

/** Composition root: wires repositories, services and handlers together. */
export function createBot(token: string): Bot<BotContext> {
  const bot = new Bot<BotContext>(token);
  const userRepository = new UserRepository(db);
  const userService = new UserService(userRepository);
  const lessonService = new LessonService(bot.api);
  const quizService = new QuizService(bot.api, new QuizSessionRepository(db), userRepository, lessonService);
  const paymentService = new PaymentService(bot.api, new PaymentRepository(db), lessonService);

  bot.catch(handleBotError);

  const privateChat = new Composer<BotContext>();
  privateChat.use(createTrackActivity(userService));
  privateChat.use(createStartComposer(userService, lessonService));
  privateChat.filter(
    hasUser,
    createMenuComposer(lessonService),
    createLessonCallbackComposer(lessonService),
    createQuizComposer(quizService),
    createPaymentComposer(paymentService),
  );
  privateChat.use(createFallbackComposer());
  bot.filter(isPrivateChat, privateChat);
  bot.filter(isAdminGroupCallback, createAdminComposer(paymentService));

  return bot;
}
