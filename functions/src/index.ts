import { onRequest } from "firebase-functions/https";
import { botToken, webhookSecret } from "./config/params";
import { handleWebhook } from "./webhook";

export const telegramWebhook = onRequest(
  {
    region: "europe-west4",
    secrets: [botToken, webhookSecret],
    invoker: "public",
    timeoutSeconds: 30,
    maxInstances: 10,
  },
  handleWebhook,
);
