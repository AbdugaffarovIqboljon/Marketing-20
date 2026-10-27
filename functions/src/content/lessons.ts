import { config } from "../config/config";
import lessonsData from "./lessons.json";

export interface Lesson {
  readonly number: number;
  readonly title: string;
  readonly storageMessageId: number;
}

export const lessons: readonly Lesson[] = lessonsData;

if (lessons.length !== config.lessonCount || lessons.some((lesson, index) => lesson.number !== index + 1)) {
  throw new Error(`content/lessons.json must hold ${config.lessonCount} lessons numbered 1..${config.lessonCount} in order`);
}

export function getLesson(number: number): Lesson | undefined {
  return lessons[number - 1];
}
