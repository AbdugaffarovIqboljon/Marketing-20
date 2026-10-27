import { GrammyError } from "grammy";

const UNREACHABLE_USER_DESCRIPTION = /blocked by the user|user is deactivated/i;
const MISSING_COPY_SOURCE_DESCRIPTION = /message to copy not found/i;
const TOO_MANY_REQUESTS = 429;

/** Telegram refuses delivery because the user blocked the bot or deleted their account. */
export function isUserUnreachable(error: unknown): boolean {
  return (
    error instanceof GrammyError &&
    error.error_code === 403 &&
    UNREACHABLE_USER_DESCRIPTION.test(error.description)
  );
}

/** Seconds Telegram asks to wait when flood control hits, or undefined for any other error. */
export function retryAfterSeconds(error: unknown): number | undefined {
  if (error instanceof GrammyError && error.error_code === TOO_MANY_REQUESTS) {
    return error.parameters.retry_after ?? 1;
  }
  return undefined;
}

/** copyMessage failed because the source message was deleted. */
export function isCopySourceMissing(error: unknown): boolean {
  return error instanceof GrammyError && MISSING_COPY_SOURCE_DESCRIPTION.test(error.description);
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
