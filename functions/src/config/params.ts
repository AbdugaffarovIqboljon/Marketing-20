import { defineInt, defineSecret } from "firebase-functions/params";

export const botToken = defineSecret("BOT_TOKEN");
export const webhookSecret = defineSecret("WEBHOOK_SECRET");

export const adminGroupId = defineInt("ADMIN_GROUP_ID");
export const storageChannelId = defineInt("STORAGE_CHANNEL_ID");
