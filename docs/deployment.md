# Zuam Deployment

Zuam is deployed as two lightweight containers on the shared Qorve Docker
stack:

- `static`: builds the Next app as static files and serves `out/` with Nginx.
- `api`: a small Node service for `POST /api/chat`, `POST /api/contact`, and
  `GET /health`.

The shared `caddy` container routes the same hostname to both containers:

- `/api/*` -> `api`
- everything else -> `static`, including the compiled La Casita PWA at `/truco/`

La Casita does not add another container. Its Vite export is assembled inside
Zuam's `out/truco/` directory and is served by the existing Nginx `static`
container. The Node container remains dedicated to the Zuam API.

No PostgreSQL database is required for the current public landing page. Add a
database only if the product later needs persistent leads, chat history,
analytics, or admin state.

The chat defaults to `gpt-5.6-luna` with low reasoning effort and low verbosity
to keep a public assistant responsive and inexpensive. Override
`OPENAI_CHAT_MODEL`, `OPENAI_CHAT_REASONING_EFFORT`, and
`OPENAI_CHAT_VERBOSITY` in `.env` when you want a different quality, cost, or
latency profile.

The API also runs semantic input and output scope guards using Structured
Outputs. They are enabled by default and use `OPENAI_CHAT_MODEL` unless
`OPENAI_SCOPE_GUARD_MODEL` is set.

Contact delivery runs inside the existing `api` container. No extra mail
container is required. Use Resend for production email delivery, or keep SMTP
and webhook settings as fallbacks if another service should receive leads.

## Local Static Build

```sh
npm run build:with-truco
```

This compiles La Casita from the sibling Truco workspace, refreshes the tracked
bundle in `static-apps/truco/`, builds Zuam and assembles everything into
`out/`. The final entry point is `out/truco/index.html`.

The default Truco source path resolves to `~/Documents/Truco` for the current
repository layout. Override it when necessary:

```sh
TRUCO_APP_DIR=/absolute/path/to/Truco npm run build:with-truco
```

## Local API

```sh
cp .env.example .env
npm run api:dev
```

`npm run api:dev` listens on port `3001` by default so it can run next to
`npm run dev` and loads `.env` plus `.env.local` automatically. For local split
testing, start the frontend with:

```sh
NEXT_PUBLIC_ZUAM_API_BASE_URL=http://127.0.0.1:3001/api npm run dev
```

The production static build should keep `NEXT_PUBLIC_ZUAM_API_BASE_URL=/api`
because Caddy routes `/api/*` to the API container on the same hostname.

## Docker Deploy

From this folder:

```sh
cp .env.example .env
nano .env
./deploy.sh
```

`deploy.sh` reads both:

- the nearest `shared-docker/.env`
- this app's `.env`

Then it pulls the latest GitHub commit, validates `docker-compose.yml`, builds
both images, starts `static` and `api` on the shared `shared_apps` network, and
checks the API health endpoint.

## Deploy from this computer

```sh
./deploy-production.local.sh
```

This is the complete production flow for Zuam plus La Casita. It builds La
Casita with the `/truco/` base path, builds Zuam, verifies
`out/truco/index.html`, uploads the combined `out/` directory over SSH and asks
the server to rebuild the existing precompiled Nginx container. No separate
Truco process, port, Caddy route or environment file is required.

The script intentionally stops before deployment when Docker or Nginx files
have uncommitted changes. The remote checkout updates those files through
`git pull`; uploading only `out/` is not enough to update the container
configuration. Commit and push the Zuam changes first, then run the local
deploy script.

After deployment it checks both `/truco` and `/truco/`. Nginx emits only a
relative trailing-slash redirect, so its internal port `8080` can never leak
into the public URL behind Caddy.

## Server Checklist

1. Clone the repository with Git, not as a ZIP download:

```sh
git clone https://github.com/damianb86/zuam.git
cd zuam
```

2. Create the app env file:

```sh
cp .env.example .env
nano .env
```

3. Set at least:

```sh
COMPOSE_PROJECT_NAME=zuam
SHARED_DOCKER_NETWORK=shared_apps
APP_HOST=your-domain.com
NEXT_PUBLIC_ZUAM_API_BASE_URL=/api
NEXT_PUBLIC_OPENAI_CHAT_MODEL_LABEL=GPT-5.6 Luna
NEXT_PUBLIC_CHAT_CONTACT_INITIAL_CAPTURE_DELAY_MS=180000
NEXT_PUBLIC_CHAT_CONTACT_FOLLOWUP_CAPTURE_DELAY_MS=180000
OPENAI_API_KEY=sk-...
OPENAI_CHAT_MODEL=gpt-5.6-luna
OPENAI_SCOPE_GUARD_ENABLED=true
OPENAI_OUTPUT_GUARD_ENABLED=true
CHAT_RATE_LIMIT_PER_MINUTE=12
CHAT_SESSION_RATE_LIMIT_PER_MINUTE=6
CHAT_SESSION_DAILY_LIMIT=30
CHAT_IP_DAILY_LIMIT=120
CHAT_MIN_SESSION_AGE_MS=1200
CHAT_MAX_MESSAGES_PER_REQUEST=18
CHAT_MAX_LATEST_MESSAGE_CHARS=2000
CONTACT_DELIVERY_METHOD=resend
CHAT_CONTACT_EMAIL_ENABLED=true
CONTACT_EMAIL=contact@zuam.com
CONTACT_EMAIL_TO=contact@zuam.com
RESEND_API_KEY=re_...
RESEND_FROM=Zuam Website <noreply@zuam.dev>
```

4. Make sure the shared Docker stack is already running and that the shared
network exists:

```sh
docker network inspect shared_apps
docker ps | grep caddy
```

5. Make sure DNS for `APP_HOST` points to this server.

6. If you use SMTP as a fallback, configure `EMAIL_HOST`, `EMAIL_PORT`,
`EMAIL_USER`, `EMAIL_PASS`, and `EMAIL_FROM_NAME`. For Google SMTP, create an
app password in the Google account used by `EMAIL_USER`; do not use the normal
account password.

7. Deploy:

```sh
./deploy.sh
```

For emergency deploys from the current files without pulling GitHub, run:

```sh
SKIP_GIT_PULL=1 ./deploy.sh
```

## Add To Shared Deploy-All

Add this app path to `shared-docker/apps.txt`:

```text
../zuam
```

The shared `deploy-all.sh` script can then update Zuam with the rest of the
apps.
