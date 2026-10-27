import type { BroadcastAudience } from "../models/broadcast";

/** Callback data scheme: `<scope>:<action>[:<lessonNumber | paymentId | audience>]` (well under Telegram's 64-byte limit). */
export const callbackData = {
  openLesson: (lessonNumber: number): string => `lesson:open:${lessonNumber}`,
  lessonWatched: (lessonNumber: number): string => `lesson:watched:${lessonNumber}`,
  retryQuiz: (lessonNumber: number): string => `quiz:retry:${lessonNumber}`,
  startPayment: "pay:start",
  approvePayment: (paymentId: string): string => `pay:approve:${paymentId}`,
  rejectPayment: (paymentId: string): string => `pay:reject:${paymentId}`,
  broadcastAudience: (audience: BroadcastAudience): string => `bc:aud:${audience}`,
  confirmBroadcast: (audience: BroadcastAudience): string => `bc:ok:${audience}`,
  cancelBroadcast: "bc:no",
};

export const callbackPatterns = {
  openLesson: /^lesson:open:(\d{1,3})$/,
  lessonWatched: /^lesson:watched:(\d{1,3})$/,
  retryQuiz: /^quiz:retry:(\d{1,3})$/,
  startPayment: /^pay:start$/,
  decidePayment: /^pay:(approve|reject):([A-Za-z0-9]{1,40})$/,
  broadcastAudience: /^bc:aud:(all|unpaid|paid)$/,
  confirmBroadcast: /^bc:ok:(all|unpaid|paid)$/,
  cancelBroadcast: /^bc:no$/,
};
