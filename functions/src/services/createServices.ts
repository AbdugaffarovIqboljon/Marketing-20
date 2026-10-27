import type { Api } from "grammy";
import { BroadcastRepository } from "../repositories/broadcastRepository";
import { db } from "../repositories/firestore";
import { PaymentRepository } from "../repositories/paymentRepository";
import { QuizSessionRepository } from "../repositories/quizSessionRepository";
import { StatsRepository } from "../repositories/statsRepository";
import { UserRepository } from "../repositories/userRepository";
import { BroadcastService } from "./broadcastService";
import { LessonService } from "./lessonService";
import { PaymentService } from "./paymentService";
import { QuizService } from "./quizService";
import { ReminderService } from "./reminderService";
import { StatsService } from "./statsService";
import { UserService } from "./userService";

export interface Services {
  readonly userService: UserService;
  readonly lessonService: LessonService;
  readonly quizService: QuizService;
  readonly paymentService: PaymentService;
  readonly statsService: StatsService;
  readonly broadcastService: BroadcastService;
  readonly reminderService: ReminderService;
}

/** Wires repositories and services; shared by the webhook bot and the scheduled jobs. */
export function createServices(api: Api): Services {
  const userRepository = new UserRepository(db);
  const userService = new UserService(userRepository);
  const lessonService = new LessonService(api, userService);
  return {
    userService,
    lessonService,
    quizService: new QuizService(api, new QuizSessionRepository(db), userRepository, lessonService, userService),
    paymentService: new PaymentService(api, new PaymentRepository(db), lessonService, userService),
    statsService: new StatsService(new StatsRepository(db)),
    broadcastService: new BroadcastService(api, new BroadcastRepository(db), userRepository, userService),
    reminderService: new ReminderService(api, userRepository, userService),
  };
}
