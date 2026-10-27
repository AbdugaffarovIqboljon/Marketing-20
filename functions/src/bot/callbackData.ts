/** Callback data scheme: `<scope>:<action>[:<lessonNumber | paymentId>]` (well under Telegram's 64-byte limit). */
export const callbackData = {
  openLesson: (lessonNumber: number): string => `lesson:open:${lessonNumber}`,
  lessonWatched: (lessonNumber: number): string => `lesson:watched:${lessonNumber}`,
  retryQuiz: (lessonNumber: number): string => `quiz:retry:${lessonNumber}`,
  startPayment: "pay:start",
  approvePayment: (paymentId: string): string => `pay:approve:${paymentId}`,
  rejectPayment: (paymentId: string): string => `pay:reject:${paymentId}`,
};

export const callbackPatterns = {
  openLesson: /^lesson:open:(\d{1,3})$/,
  lessonWatched: /^lesson:watched:(\d{1,3})$/,
  retryQuiz: /^quiz:retry:(\d{1,3})$/,
  startPayment: /^pay:start$/,
  decidePayment: /^pay:(approve|reject):([A-Za-z0-9]{1,40})$/,
};
