import { config } from "../config/config";
import quizzesData from "./quizzes.json";

// Telegram quiz poll limits.
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;
const MAX_QUESTION_LENGTH = 300;
const MAX_OPTION_LENGTH = 100;
const MAX_EXPLANATION_LENGTH = 200;

export interface QuizQuestion {
  readonly text: string;
  readonly options: readonly string[];
  readonly correctIndex: number;
  readonly explanation?: string;
}

export interface LessonQuiz {
  readonly lessonNumber: number;
  readonly questions: readonly QuizQuestion[];
}

const quizzes: readonly LessonQuiz[] = quizzesData;

function questionProblem(question: QuizQuestion): string | undefined {
  if (question.text.length === 0 || question.text.length > MAX_QUESTION_LENGTH) {
    return `text must be 1-${MAX_QUESTION_LENGTH} characters`;
  }
  if (question.options.length < MIN_OPTIONS || question.options.length > MAX_OPTIONS) {
    return `must have ${MIN_OPTIONS}-${MAX_OPTIONS} options`;
  }
  if (question.options.some((option) => option.length === 0 || option.length > MAX_OPTION_LENGTH)) {
    return `every option must be 1-${MAX_OPTION_LENGTH} characters`;
  }
  if (!Number.isInteger(question.correctIndex) || question.correctIndex < 0 || question.correctIndex >= question.options.length) {
    return "correctIndex is out of range";
  }
  if (question.explanation !== undefined && question.explanation.length > MAX_EXPLANATION_LENGTH) {
    return `explanation must be at most ${MAX_EXPLANATION_LENGTH} characters`;
  }
  return undefined;
}

function validate(): void {
  if (quizzes.length !== config.lessonCount || quizzes.some((quiz, index) => quiz.lessonNumber !== index + 1)) {
    throw new Error(`content/quizzes.json must hold ${config.lessonCount} quizzes numbered 1..${config.lessonCount} in order`);
  }
  for (const quiz of quizzes) {
    if (quiz.questions.length === 0) {
      throw new Error(`content/quizzes.json: lesson ${quiz.lessonNumber} has no questions`);
    }
    quiz.questions.forEach((question, index) => {
      const problem = questionProblem(question);
      if (problem !== undefined) {
        throw new Error(`content/quizzes.json: lesson ${quiz.lessonNumber}, question ${index + 1}: ${problem}`);
      }
    });
  }
}

validate();

export function getQuiz(lessonNumber: number): LessonQuiz | undefined {
  return quizzes[lessonNumber - 1];
}
