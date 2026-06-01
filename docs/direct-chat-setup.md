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
OPENAI_SCOPE_GUARD_ENABLED=true
OPENAI_OUTPUT_GUARD_ENABLED=true
NEXT_PUBLIC_OPENAI_CHAT_MODEL_LABEL=GPT-5.4 Nano
NEXT_PUBLIC_OPENAI_CHAT_ASSISTANT_NAME=Zuam AI Assistant
NEXT_PUBLIC_ZUAM_CONTACT_EMAIL=contact@zuam.com
```

`npm run api:dev` loads `.env` and `.env.local` automatically. Restart the API
service after changing server-side environment values. Rebuild the static site
after changing `NEXT_PUBLIC_*` values.

For local frontend development, run the API on its default development port and
point the browser bundle at it:

```bash
npm run api:dev
NEXT_PUBLIC_ZUAM_API_BASE_URL=http://127.0.0.1:3001/api npm run dev
```

`OPENAI_API_KEY`, `OPENAI_CHAT_MODEL`, `OPENAI_CHAT_MAX_OUTPUT_TOKENS`,
`OPENAI_SCOPE_GUARD_MODEL`,
`RESEND_API_KEY`, `CONTACT_WEBHOOK_URL`, `CONTACT_WEBHOOK_SECRET`,
`EMAIL_HOST`, `EMAIL_USER`, and `EMAIL_PASS` are server-only variables. Never create
`NEXT_PUBLIC_OPENAI_API_KEY`, `NEXT_PUBLIC_EMAIL_PASS`, or any other
client-visible secret.

## Assistant behavior

The API service keeps `OPENAI_API_KEY` server-side, sends the current chat
messages to the OpenAI Responses API, and returns only the assistant text to
the browser.

Before the assistant answers, the API runs a semantic scope classifier with
Structured Outputs. After the assistant drafts a reply, the API runs a second
scope check over that draft. Both guards keep the chat focused on Zuam
commercial intake and concise Zuam-specific information without relying on
topic keyword lists.

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

The browser also has a lead safety net: once the visitor has provided a valid
email plus meaningful project/business context, it sends a preliminary contact lead after
`NEXT_PUBLIC_CHAT_CONTACT_INITIAL_CAPTURE_DELAY_MS`. If the visitor adds more
details later, it sends one follow-up after
`NEXT_PUBLIC_CHAT_CONTACT_FOLLOWUP_CAPTURE_DELAY_MS`. If the visitor leaves the
page before the first timer fires, the browser attempts one last preliminary
capture with `sendBeacon`.

Disable chat email sending without disabling the normal chat:

```bash
CHAT_CONTACT_EMAIL_ENABLED=false
```

For production email delivery with Resend, configure:

```bash
CONTACT_DELIVERY_METHOD=resend
CONTACT_EMAIL=contact@zuam.com
CONTACT_EMAIL_TO=contact@zuam.com
RESEND_API_KEY=re_...
RESEND_FROM=Zuam Website <noreply@zuam.dev>
```

Resend sends the message from `RESEND_FROM` and sets `reply_to` to the
visitor's email address, so replying from the inbox reaches the visitor.

For optional webhook delivery from the contact form, configure:

```bash
CONTACT_WEBHOOK_URL=https://your-webhook-or-form-endpoint
CONTACT_WEBHOOK_SECRET=optional-bearer-token
```

For optional SMTP fallback, configure:

```bash
CONTACT_EMAIL=contact@zuam.com
CONTACT_EMAIL_TO=contact@zuam.com
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-google-account@gmail.com
EMAIL_PASS=your-google-app-password
EMAIL_FROM_NAME=Zuam Website
```

`CONTACT_DELIVERY_METHOD=auto` uses Resend when configured, then SMTP, then the
webhook. You can force one channel with `resend`, `smtp`, or `webhook`, or send
to both email and webhook with `both`. With `both`, the email channel uses
Resend when available and SMTP otherwise.

If neither Resend, webhook, nor SMTP is configured, the normal contact form
returns a fallback with the contact email instead of claiming delivery.

## Optional limits

```bash
OPENAI_CHAT_MAX_OUTPUT_TOKENS=800
OPENAI_CHAT_REASONING_EFFORT=low
OPENAI_CHAT_VERBOSITY=low
OPENAI_SCOPE_GUARD_ENABLED=true
OPENAI_OUTPUT_GUARD_ENABLED=true
OPENAI_SCOPE_GUARD_MODEL=
OPENAI_SCOPE_GUARD_REASONING_EFFORT=low
CHAT_RATE_LIMIT_PER_MINUTE=12
CONTACT_RATE_LIMIT_PER_MINUTE=5
NEXT_PUBLIC_CHAT_CONTACT_INITIAL_CAPTURE_DELAY_MS=1500
NEXT_PUBLIC_CHAT_CONTACT_FOLLOWUP_CAPTURE_DELAY_MS=30000
```

The API also limits request body size, trims individual message content, and
only forwards recent conversation turns to OpenAI.
