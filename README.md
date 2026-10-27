# Marketing 20

## Webhook setup

After deploying, point Telegram at the function. `allowed_updates` must include `poll_answer`, or quiz answers never reach the bot.

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

## Firestore indexes

The scheduled jobs need the composite indexes in `firestore.indexes.json`. Deploy them before the functions and wait until they finish building:

```bash
firebase deploy --only firestore:indexes
```

## Scheduled jobs

`minuteJobs` (every minute) sends the active broadcast; `hourlyJobs` (every hour, Asia/Tashkent) expires stale payments and sends reminders. Both run in europe-west4 and need the Cloud Scheduler API, which `firebase deploy` enables on the first deploy.

## Admin group

`/stats` and `/broadcast` (sent as a reply to the message to broadcast) work only in the admin group. Bot commands reach the bot even with privacy mode on.
