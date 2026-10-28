# Marketing 20

## Deploy

Run these in order from the repo root. `.firebaserc` already points at `marketing-20`.

1. Log in:

   ```bash
   firebase login
   ```

2. Deploy the security rules and indexes, then wait until every index shows **Enabled** in the Firebase console (Firestore → Indexes). The scheduled jobs fail until they are built.

   ```bash
   firebase deploy --only firestore:rules,firestore:indexes --project marketing-20
   ```

3. Set the secrets (each command prompts for the value):

   ```bash
   firebase functions:secrets:set BOT_TOKEN --project marketing-20
   firebase functions:secrets:set WEBHOOK_SECRET --project marketing-20
   ```

4. Copy `functions/example.env` to `functions/.env` and set the real `ADMIN_GROUP_ID` and `STORAGE_CHANNEL_ID` (negative chat ids).

5. Deploy the functions:

   ```bash
   firebase deploy --only functions --project marketing-20
   ```

6. Point Telegram at the webhook function. `allowed_updates` must include `poll_answer`, or quiz answers never reach the bot.

   ```bash
   curl -s "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{
       "url": "<TELEGRAM_WEBHOOK_FUNCTION_URL>",
       "secret_token": "<WEBHOOK_SECRET>",
       "allowed_updates": ["message", "callback_query", "poll_answer", "my_chat_member"],
       "drop_pending_updates": true
     }'
   ```

7. Add the bot to the admin group and make it an admin.

## Scheduled jobs

`minuteJobs` (every minute) sends the active broadcast; `hourlyJobs` (every hour, Asia/Tashkent) expires stale payments and sends reminders. Both run in europe-west4 and need the Cloud Scheduler API, which `firebase deploy` enables on the first deploy.

## Admin group

`/stats` and `/broadcast` (sent as a reply to the message to broadcast) work only in the admin group. Bot commands reach the bot even with privacy mode on.
