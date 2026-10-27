import { Bot, Composer } from "grammy";
import { createServices } from "../services/createServices";
import { hasUser, isAdminGroupUpdate, isPrivateChat, type BotContext } from "./context";
import { createErrorHandler } from "./errorHandler";
import { createAdminComposer } from "./handlers/adminHandlers";
import { createFallbackComposer } from "./handlers/fallbackHandlers";
import { createLessonCallbackComposer } from "./handlers/lessonCallbackHandlers";
import { createMembershipComposer } from "./handlers/membershipHandlers";
import { createMenuComposer } from "./handlers/menuHandlers";
import { createPaymentComposer } from "./handlers/paymentHandlers";
import { createQuizComposer } from "./handlers/quizHandlers";
import { createStartComposer } from "./handlers/startHandler";
import { createTrackActivity } from "./middleware/trackActivity";

/** Composition root of the webhook bot: wires services into handlers. */
export function createBot(token: string): Bot<BotContext> {
  const bot = new Bot<BotContext>(token);
  const services = createServices(bot.api);
  const { userService, lessonService } = services;

  bot.catch(createErrorHandler(userService));

  const privateChat = new Composer<BotContext>();
  privateChat.use(createMembershipComposer(userService));
  privateChat.use(createTrackActivity(userService));
  privateChat.use(createStartComposer(userService, lessonService));
  privateChat.filter(
    hasUser,
    createMenuComposer(lessonService),
    createLessonCallbackComposer(lessonService),
    createQuizComposer(services.quizService),
    createPaymentComposer(services.paymentService),
  );
  privateChat.use(createFallbackComposer());
  bot.filter(isPrivateChat, privateChat);
  bot.filter(
    isAdminGroupUpdate,
    createAdminComposer(services.paymentService, services.statsService, services.broadcastService),
  );

  return bot;
}
