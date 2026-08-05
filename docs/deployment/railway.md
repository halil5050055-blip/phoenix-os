# Railway Deployment

Phoenix BOS is deployed as two Railway services built from the root `Dockerfile`: a public backend service and a private Telegram long-polling worker. The backend remains the only owner of business rules and SQLite data.

## Backend Service

1. Create a Railway project and add this GitHub repository as a service.
2. Railway detects the root `Dockerfile`; keep its default start command.
3. Add a persistent Railway volume to the backend service and set its mount path to `/data`.
4. Configure the deployment health-check path as `/health`.
5. Generate a public Railway domain for the backend.
6. Set every required variable through Railway Variables. Never place values in Git.

Required backend variables:

```text
NODE_ENV=production
PORT=<Railway-provided port>
DATABASE_PATH=/data/phoenix-bos.sqlite
JWT_SECRET=<at least 32 random bytes>
INITIAL_ADMIN_EMAIL=<initial administrator email>
INITIAL_ADMIN_PASSWORD=<strong initial administrator password>
INITIAL_ADMIN_NAME=<initial administrator display name>
```

Railway injects `PORT`; the application binds it on `0.0.0.0`. Production validation rejects any database path except `/data/phoenix-bos.sqlite`. The `/data` volume is mounted only at runtime, so migrations run during application startup rather than a build or pre-deploy step.

SQLite requires a single backend service replica attached to this volume. Do not enable horizontal replicas. Back up the volume before destructive operations or migration rollbacks.

Set `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` to at least `15` so Railway gives the process time to handle `SIGTERM` and close HTTP and SQLite cleanly.

Official references:

- [Railway Dockerfiles](https://docs.railway.com/builds/dockerfiles)
- [Railway health checks](https://docs.railway.com/deployments/healthchecks)
- [Railway volumes](https://docs.railway.com/volumes)

## Telegram Worker Service

1. Add a second service from the same GitHub repository.
2. Use the same root `Dockerfile`.
3. Override its start command with `npm run telegram:start`.
4. Do not attach the SQLite volume and do not expose a public domain.
5. Create a dedicated active Phoenix BOS user with the `SALES` role for the worker. Do not reuse an administrator account.
6. Set these variables through Railway Variables:

```text
NODE_ENV=production
TELEGRAM_BOT_TOKEN=<BotFather token>
TELEGRAM_ALLOWED_USER_IDS=<comma-separated numeric Telegram IDs>
PHOENIX_API_URL=https://<backend-domain>
PHOENIX_BOT_EMAIL=<dedicated Phoenix BOS bot user email>
PHOENIX_BOT_PASSWORD=<dedicated Phoenix BOS bot user password>
```

The worker uses long polling, so run exactly one Telegram worker replica. It authenticates to the backend, never accesses SQLite directly, and refuses write execution when the backend audit endpoint is unavailable.

## Deployment Verification

1. Confirm the backend deployment health check returns HTTP 200 from `/health`.
2. Open the public domain and confirm `/` and `/login` display the Phoenix BOS sign-in page over HTTPS.
3. Sign in with `INITIAL_ADMIN_EMAIL` and its configured password; confirm the browser reaches `/dashboard`, shows the administrator name and role, and reports the backend as operational.
4. In a private browser window, request `/dashboard` and confirm it redirects to `/login`.
5. Enter an invalid password and confirm the login page displays a generic authentication error without logging or exposing credentials.
6. Select **Log out**, confirm `/login` loads, and confirm `/dashboard` again redirects to `/login`.
7. Confirm the backend volume is mounted at `/data` and the database survives a redeploy.
8. Confirm Telegram worker logs report that long polling started without printing credentials.
9. From an allowlisted Telegram account, run `/status` and `/help`.
10. From a non-allowlisted account, confirm commands return `Access denied.`
11. Review backend `audit_events` for Telegram command records.
