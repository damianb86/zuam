# Direct chat setup

This project embeds a floating assistant that talks directly to OpenAI through
`POST /api/chat`. It does not use ChatKit sessions or Agent Builder workflows.

## Required configuration

For local development, edit `.env.local`. This file wins over `.env`, so do
not leave `OPENAI_API_KEY=` empty in `.env.local`; either set the real key there
or leave the line commented out so `.env` can provide it.

```bash
OPENAI_API_KEY=sk-...
OPENAI_CHAT_MODEL=gpt-5.5
NEXT_PUBLIC_OPENAI_CHAT_MODEL_LABEL=GPT-5.5
NEXT_PUBLIC_OPENAI_CHAT_ASSISTANT_NAME=Zuam AI Assistant
NEXT_PUBLIC_ZUAM_CONTACT_EMAIL=contact@zuam.com
```

Restart the Next.js server after changing environment values.

For Vercel or another host, add the same variables in the project environment
settings for every target where the chat should work:

- Production
- Preview
- Development, if your platform uses remote development env vars

`OPENAI_API_KEY`, `OPENAI_CHAT_MODEL`, `OPENAI_CHAT_MAX_OUTPUT_TOKENS`,
`CONTACT_WEBHOOK_URL`, and `CONTACT_WEBHOOK_SECRET` are server-only variables.
Never create `NEXT_PUBLIC_OPENAI_API_KEY`.

## Assistant behavior

The server route keeps `OPENAI_API_KEY` server-side, sends the current chat
messages to the OpenAI Responses API, and returns only the assistant text to the
browser.

The assistant instructions and editable business knowledge live in:

- `lib/zuam/apps.ts`
- `lib/zuam/knowledge.ts`
- `lib/zuam/assistantInstructions.ts`
- `lib/zuam/chatSuggestions.ts`

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
```

The endpoint also limits the request body to recent messages and trims individual
message content before forwarding it to OpenAI.
