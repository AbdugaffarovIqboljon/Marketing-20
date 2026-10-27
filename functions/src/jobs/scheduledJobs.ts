import { Api } from "grammy";
import * as logger from "firebase-functions/logger";
import { config } from "../config/config";
import { botToken } from "../config/params";
import { createServices, type Services } from "../services/createServices";
import { describeError } from "../utils/errors";

// Secrets only exist at runtime, so services are built on the first run and reused while the instance is warm.
let cachedServices: Services | undefined;

function services(): Services {
  cachedServices ??= createServices(new Api(botToken.value()));
  return cachedServices;
}

/** Runs one job so that its failure is logged and does not stop the jobs after it. */
async function runSafely(job: string, run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch (error) {
    logger.error("Scheduled job failed", { job, error: describeError(error) });
  }
}

/** Every minute: continues the active broadcast. */
export async function runMinuteJobs(): Promise<void> {
  const deadline = Date.now() + config.minuteJobBudgetMs;
  await runSafely("broadcast", () => services().broadcastService.processActive(deadline));
}

/** Every hour: expires stale payments, then sends due reminders. */
export async function runHourlyJobs(): Promise<void> {
  const deadline = Date.now() + config.hourlyJobBudgetMs;
  const { paymentService, reminderService } = services();
  await runSafely("payment expiry", () => paymentService.expireStale(deadline));
  await runSafely("reminders", () => reminderService.sendDue(deadline));
}
