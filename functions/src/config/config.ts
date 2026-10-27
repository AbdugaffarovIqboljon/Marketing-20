import { adminGroupId, storageChannelId } from "./params";

export const config = {
  courseName: "Namuna Kurs",
  priceUzs: 199_000,
  cardNumber: "0000 0000 0000 0000",
  cardHolder: "ISM FAMILIYA",
  supportUsername: "@namuna_support",
  passPercent: 70,
  lessonCount: 20,
  freeLessonCount: 1,
  // Repeated taps on a quiz start button within this window are ignored.
  quizStartDebounceMs: 5_000,
  // Params are resolved at runtime only, so they are exposed as getters.
  get adminGroupId(): number {
    return adminGroupId.value();
  },
  get storageChannelId(): number {
    return storageChannelId.value();
  },
};
