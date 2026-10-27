import { adminGroupId, storageChannelId } from "./params";

export const config = {
  courseName: "Namuna Kurs",
  priceUzs: 199_000,
  cardNumber: "0000 0000 0000 0000",
  cardHolder: "ISM FAMILIYA",
  supportUsername: "@namuna_support",
  passPercent: 60,
  lessonCount: 20,
  freeLessonCount: 1,
  // Repeated taps on a quiz start button within this window are ignored.
  quizStartDebounceMs: 5_000,
  // Each open payment gets a unique amount: price + 1..paymentAmountTailMax so'm.
  paymentAmountTailMax: 999,
  // An unpaid awaiting_receipt payment older than this is expired and its amount freed.
  paymentExpiryHours: 48,
  // Telegram allows about 30 messages per second; stay below it.
  broadcastRatePerSecond: 25,
  // Recipients loaded and checkpointed together; a crash skips at most one batch, never repeats it.
  broadcastBatchSize: 25,
  // The every-minute job stops sending after this long and resumes on the next run.
  minuteJobBudgetMs: 50_000,
  // A run holds the broadcast lease this long; it must outlast minuteJobBudgetMs.
  broadcastLeaseMs: 90_000,
  hourlyJobBudgetMs: 240_000,
  reminderFirstAfterHours: 24,
  reminderSecondAfterHours: 72,
  // Reminders go out only from reminderFromHour (inclusive) to reminderUntilHour (exclusive), local time.
  reminderFromHour: 10,
  reminderUntilHour: 21,
  reminderBatchSize: 50,
  paymentExpiryBatchSize: 100,
  statsTopSources: 10,
  timeZone: "Asia/Tashkent",
  // Params are resolved at runtime only, so they are exposed as getters.
  get adminGroupId(): number {
    return adminGroupId.value();
  },
  get storageChannelId(): number {
    return storageChannelId.value();
  },
};
