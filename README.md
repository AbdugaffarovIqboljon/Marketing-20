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
