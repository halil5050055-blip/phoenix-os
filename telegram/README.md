# Telegram Control Interface

The Telegram worker in `src/telegram/` is a separate long-polling interface to Phoenix BOS. It never reads SQLite or implements business transitions; it authenticates as a dedicated Phoenix BOS user and calls the canonical REST API.

## Commands

- `/start` — introduction and command list
- `/status` — backend availability
- `/leads` — up to ten recent leads
- `/lead_new <company>` — propose a new lead, then explicitly confirm or cancel using inline buttons
- `/offers` — up to ten recent commercial offers
- `/tasks` — up to ten open tasks
- `/help` — command list

Every command attempt is sent to the backend audit endpoint, including attempts from denied Telegram IDs. An allowed command fails closed when its audit record cannot be written. Telegram user IDs must appear explicitly in `TELEGRAM_ALLOWED_USER_IDS`.

## Local Startup

1. Start the backend with the variables documented in the root README.
2. As an administrator, create a dedicated active Phoenix BOS `SALES` user for the bot.
3. Set the Telegram variables from `.env.example` in your shell using real local values.
4. Run `npm run telegram:dev`.

To validate configuration without contacting Telegram or sending messages, set `TELEGRAM_DRY_RUN=true` and run `npm run telegram:dev`.

Never paste tokens, passwords, JWTs, or private chat content into source files, logs, or Telegram messages. See [`docs/deployment/railway.md`](../docs/deployment/railway.md) for Railway deployment.
