import { createHash, timingSafeEqual } from "node:crypto";
import { webhookCallback } from "grammy";
import * as logger from "firebase-functions/logger";
import type { Request, Response } from "firebase-functions/https";
import { createBot } from "./bot/createBot";
import { botToken, webhookSecret } from "./config/params";

const SECRET_HEADER = "x-telegram-bot-api-secret-token";

type UpdateHandler = (req: Request, res: Response) => Promise<void>;

// Secrets only exist at runtime, so the bot is built on the first request and reused while the instance is warm.
let cachedHandler: UpdateHandler | undefined;

function getUpdateHandler(): UpdateHandler {
  // "return" answers 200 if a handler overruns, so Telegram never re-sends the update.
  cachedHandler ??= webhookCallback(createBot(botToken.value()), "express", { onTimeout: "return" });
  return cachedHandler;
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function hasValidSecret(req: Request): boolean {
  const provided = req.get(SECRET_HEADER);
  return provided !== undefined && timingSafeEqual(digest(provided), digest(webhookSecret.value()));
}

export async function handleWebhook(req: Request, res: Response): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).send();
    return;
  }
  if (!hasValidSecret(req)) {
    logger.warn("Webhook request rejected: secret token mismatch");
    res.status(403).send();
    return;
  }
  await getUpdateHandler()(req, res);
}
