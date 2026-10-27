/** Callback data scheme: `<scope>:<action>:<lessonNumber>` (well under Telegram's 64-byte limit). */
export const callbackData = {
  openLesson: (lessonNumber: number): string => `lesson:open:${lessonNumber}`,
  lessonWatched: (lessonNumber: number): string => `lesson:watched:${lessonNumber}`,
  retryQuiz: (lessonNumber: number): string => `quiz:retry:${lessonNumber}`,
};

export const callbackPatterns = {
  openLesson: /^lesson:open:(\d{1,3})$/,
  lessonWatched: /^lesson:watched:(\d{1,3})$/,
  retryQuiz: /^quiz:retry:(\d{1,3})$/,
};
