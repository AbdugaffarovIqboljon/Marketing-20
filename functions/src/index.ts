import { onRequest } from "firebase-functions/https";
import { onSchedule } from "firebase-functions/scheduler";
import { config } from "./config/config";
import { botToken, webhookSecret } from "./config/params";
import { runHourlyJobs, runMinuteJobs } from "./jobs/scheduledJobs";
import { handleWebhook } from "./webhook";

const REGION = "europe-west4";

export const telegramWebhook = onRequest(
  {
    region: REGION,
    secrets: [botToken, webhookSecret],
    invoker: "public",
    timeoutSeconds: 30,
    maxInstances: 10,
  },
  handleWebhook,
);

// Long work never runs in the webhook. One instance each, no retries: every run resumes from saved state.
export const minuteJobs = onSchedule(
  {
    schedule: "every 1 minutes",
    timeZone: config.timeZone,
    region: REGION,
    secrets: [botToken],
    timeoutSeconds: 120,
    maxInstances: 1,
    retryCount: 0,
  },
  runMinuteJobs,
);

export const hourlyJobs = onSchedule(
  {
    schedule: "0 * * * *",
    timeZone: config.timeZone,
    region: REGION,
    secrets: [botToken],
    timeoutSeconds: 300,
    maxInstances: 1,
    retryCount: 0,
  },
  runHourlyJobs,
);
