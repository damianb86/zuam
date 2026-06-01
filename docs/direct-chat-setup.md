# Direct chat setup

This project embeds a floating assistant that talks directly to OpenAI through
the standalone Zuam API service at `POST /api/chat`. The public website is a
static export; the OpenAI key is never bundled into the browser.

## Required configuration

For local development or Docker deployment, copy `.env.example` to `.env` and
fill in the private values:

```bash
OPENAI_API_KEY=sk-...
OPENAI_CHAT_MODEL=gpt-5.4-nano
OPENAI_CHAT_REASONING_EFFORT=low
OPENAI_CHAT_VERBOSITY=low
NEXT_PUBLIC_OPENAI_CHAT_MODEL_LABEL=GPT-5.4 Nano
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
`CONTACT_WEBHOOK_URL`, `CONTACT_WEBHOOK_SECRET`, `EMAIL_HOST`, `EMAIL_USER`,
and `EMAIL_PASS` are server-only variables. Never create
`NEXT_PUBLIC_OPENAI_API_KEY`, `NEXT_PUBLIC_EMAIL_PASS`, or any other
client-visible secret.

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

The assistant can also send a contact email directly from chat through the
server-side `send_zuam_contact_email` tool. It should ask for a valid reply
email and enough project details before sending. The email includes the user's
message, the assistant's interpretation, requested outcome, and recent chat
context.

Disable chat email sending without disabling the normal chat:

```bash
CHAT_CONTACT_EMAIL_ENABLED=false
```

For direct lead delivery from the contact form, configure:

```bash
CONTACT_WEBHOOK_URL=https://your-webhook-or-form-endpoint
CONTACT_WEBHOOK_SECRET=optional-bearer-token
```

For SMTP delivery, configure:

```bash
CONTACT_DELIVERY_METHOD=auto
CONTACT_EMAIL=contact@zuam.com
CONTACT_EMAIL_TO=contact@zuam.com
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-google-account@gmail.com
EMAIL_PASS=your-google-app-password
EMAIL_FROM_NAME=Zuam Website
```

`CONTACT_DELIVERY_METHOD=auto` uses SMTP when SMTP is configured, otherwise it
uses the webhook when configured. You can force one channel with `smtp` or
`webhook`, or send to both with `both`.

If neither webhook nor SMTP is configured, the normal contact form returns a
fallback with the contact email instead of claiming delivery.

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
