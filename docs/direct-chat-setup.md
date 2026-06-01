# Direct chat setup

This project embeds a floating assistant that talks directly to OpenAI through
the standalone Zuam API service at `POST /api/chat`. The public website is a
static export; the OpenAI key is never bundled into the browser.

## Required configuration

For local development or Docker deployment, copy `.env.example` to `.env` and
fill in the private values:

```bash
OPENAI_API_KEY=sk-...
OPENAI_CHAT_MODEL=gpt-5.5
OPENAI_CHAT_REASONING_EFFORT=low
OPENAI_CHAT_VERBOSITY=low
NEXT_PUBLIC_OPENAI_CHAT_MODEL_LABEL=GPT-5.5
NEXT_PUBLIC_OPENAI_CHAT_ASSISTANT_NAME=Zuam AI Assistant
NEXT_PUBLIC_ZUAM_CONTACT_EMAIL=contact@zuam.com
```

Restart the API service after changing server-side environment values. Rebuild
the static site after changing `NEXT_PUBLIC_*` values.

For local frontend development, run the API on its default development port and
point the browser bundle at it:

```bash
npm run api:dev
NEXT_PUBLIC_ZUAM_API_BASE_URL=http://127.0.0.1:3001/api npm run dev
```

`OPENAI_API_KEY`, `OPENAI_CHAT_MODEL`, `OPENAI_CHAT_MAX_OUTPUT_TOKENS`,
`CONTACT_WEBHOOK_URL`, and `CONTACT_WEBHOOK_SECRET` are server-only variables.
Never create `NEXT_PUBLIC_OPENAI_API_KEY`.

## Assistant behavior

The API service keeps `OPENAI_API_KEY` server-side, sends the current chat
messages to the OpenAI Responses API, and returns only the assistant text to
the browser.

The assistant instructions and editable business knowledge live in:

- `data/zuamContent.json`
- `lib/zuam/apps.ts`
- `lib/zuam/knowledge.ts`
- `lib/zuam/assistantInstructions.ts`
- `lib/zuam/chatSuggestions.ts`
- `services/zuam-api/server.mjs`

`data/zuamContent.json` is the shared source of truth used by both the static
frontend and the API service.

## Contact from chat

The chat UI exposes contact actions in the header:

- Open the page contact form.
- Open the user's email client with Zuam's address.

For direct lead delivery from the contact form, configure:

```bash
CONTACT_WEBHOOK_URL=https://your-webhook-or-form-endpoint
CONTACT_WEBHOOK_SECRET=optional-bearer-token
```

If `CONTACT_WEBHOOK_URL` is empty, the normal contact form returns a fallback
with the contact email instead of claiming delivery.

## Optional limits

```bash
OPENAI_CHAT_MAX_OUTPUT_TOKENS=800
OPENAI_CHAT_REASONING_EFFORT=low
OPENAI_CHAT_VERBOSITY=low
CHAT_RATE_LIMIT_PER_MINUTE=12
CONTACT_RATE_LIMIT_PER_MINUTE=5
```

The API also limits request body size, trims individual message content, and
only forwards recent conversation turns to OpenAI.
