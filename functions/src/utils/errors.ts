import { GrammyError } from "grammy";

const UNREACHABLE_USER_DESCRIPTION = /blocked by the user|user is deactivated/i;

/** Telegram refuses delivery because the user blocked the bot or deleted their account. */
export function isUserUnreachable(error: unknown): boolean {
  return (
    error instanceof GrammyError &&
    error.error_code === 403 &&
    UNREACHABLE_USER_DESCRIPTION.test(error.description)
  );
}

/** Errors do not serialize into structured logs, so flatten them explicitly. */
export function describeError(error: unknown): Record<string, unknown> {
  if (error instanceof GrammyError) {
    return {
      name: error.name,
      method: error.method,
      code: error.error_code,
      description: error.description,
      stack: error.stack,
    };
  }
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { value: String(error) };
}
