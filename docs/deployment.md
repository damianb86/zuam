# Zuam Deployment

Zuam is deployed as two lightweight containers on the shared Qorve Docker
stack:

- `static`: builds the Next app as static files and serves `out/` with Nginx.
- `api`: a small Node service for `POST /api/chat`, `POST /api/contact`, and
  `GET /health`.

The shared `caddy` container routes the same hostname to both containers:

- `/api/*` -> `api`
- everything else -> `static`

No PostgreSQL database is required for the current public landing page. Add a
database only if the product later needs persistent leads, chat history,
analytics, or admin state.

The chat defaults to `gpt-5.4-nano` with low reasoning effort and low verbosity
to keep a public assistant responsive and inexpensive. Override
`OPENAI_CHAT_MODEL`, `OPENAI_CHAT_REASONING_EFFORT`, and
`OPENAI_CHAT_VERBOSITY` in `.env` when you want a different quality, cost, or
latency profile.

Contact delivery runs inside the existing `api` container. No extra mail
container is required. Use SMTP for the simplest setup, or keep using a webhook
if another service should receive leads.

## Local Static Build

```sh
npm run build
```

The static export is written to `out/`.

## Local API

```sh
cp .env.example .env
npm run api:dev
```

`npm run api:dev` listens on port `3001` by default so it can run next to
`npm run dev`. For local split testing, start the frontend with:

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
NEXT_PUBLIC_OPENAI_CHAT_MODEL_LABEL=GPT-5.4 Nano
OPENAI_API_KEY=sk-...
OPENAI_CHAT_MODEL=gpt-5.4-nano
CONTACT_DELIVERY_METHOD=auto
CHAT_CONTACT_EMAIL_ENABLED=true
CONTACT_EMAIL=contact@zuam.com
CONTACT_EMAIL_TO=contact@zuam.com
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-google-account@gmail.com
EMAIL_PASS=your-google-app-password
```

4. Make sure the shared Docker stack is already running and that the shared
network exists:

```sh
docker network inspect shared_apps
docker ps | grep caddy
```

5. Make sure DNS for `APP_HOST` points to this server.

6. If you use Google SMTP, create an app password in the Google account used by
`EMAIL_USER`; do not use the normal account password.

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
