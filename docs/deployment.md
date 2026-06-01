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

The chat defaults to `gpt-5.5` with low reasoning effort and low verbosity to
keep a public assistant responsive and inexpensive. Override
`OPENAI_CHAT_MODEL`, `OPENAI_CHAT_REASONING_EFFORT`, and
`OPENAI_CHAT_VERBOSITY` in `.env` when you want a different quality/cost
profile.

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

Then it validates `docker-compose.yml`, builds both images, and starts
`static` and `api` on the shared `shared_apps` network.

## Add To Shared Deploy-All

Add this app path to `shared-docker/apps.txt`:

```text
../zuam
```

The shared `deploy-all.sh` script can then update Zuam with the rest of the
apps.
