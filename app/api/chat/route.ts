import { NextRequest, NextResponse } from "next/server";
import { getZuamAssistantInstructions } from "@/lib/zuam/assistantInstructions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type ResponsesPayload = {
  model: string;
  instructions: string;
  input: ChatMessage[];
  max_output_tokens?: number;
};

type ResponsesApiResponse = {
  id?: string;
  output_text?: unknown;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: unknown;
    }>;
  }>;
  error?: {
    message?: string;
  };
};

const MAX_MESSAGES = 18;
const MAX_MESSAGE_CHARS = 4000;
const DEFAULT_MODEL = "gpt-5.4-nano";

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : null;
}

function getOptionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function getPositiveIntegerEnv(name: string) {
  const raw = getOptionalEnv(name);

  if (!raw) {
    return undefined;
  }

  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function getConfiguredModel() {
  return (
    getOptionalEnv("OPENAI_CHAT_MODEL") ||
    getOptionalEnv("NEXT_PUBLIC_OPENAI_CHAT_MODEL") ||
    DEFAULT_MODEL
  );
}

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return true;
  }

  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

function cleanMessageContent(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, MAX_MESSAGE_CHARS);
}

function parseMessages(body: unknown): ChatMessage[] {
  if (!body || typeof body !== "object" || !("messages" in body)) {
    return [];
  }

  const rawMessages = (body as { messages?: unknown }).messages;

  if (!Array.isArray(rawMessages)) {
    return [];
  }

  return rawMessages
    .map((message) => {
      if (!message || typeof message !== "object") {
        return null;
      }

      const role = (message as { role?: unknown }).role;
      const content = cleanMessageContent((message as { content?: unknown }).content);

      if ((role !== "user" && role !== "assistant") || !content) {
        return null;
      }

      return { role, content };
    })
    .filter((message): message is ChatMessage => Boolean(message))
    .slice(-MAX_MESSAGES);
}

function extractOutputText(data: ResponsesApiResponse | null) {
  if (!data) {
    return "";
  }

  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const parts: string[] = [];

  for (const item of data.output ?? []) {
    for (const content of item.content ?? []) {
      if (
        (content.type === "output_text" || content.type === "text") &&
        typeof content.text === "string" &&
        content.text.trim()
      ) {
        parts.push(content.text.trim());
      }
    }
  }

  return parts.join("\n\n");
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: "Chat requests must come from the same origin." },
      { status: 403 }
    );
  }

  const apiKey = getRequiredEnv("OPENAI_API_KEY");

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "Chat is not configured yet.",
        missing: ["OPENAI_API_KEY"]
      },
      { status: 503 }
    );
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const messages = parseMessages(body);

  if (!messages.some((message) => message.role === "user")) {
    return NextResponse.json(
      { error: "A user message is required." },
      { status: 400 }
    );
  }

  const payload: ResponsesPayload = {
    model: getConfiguredModel(),
    instructions: getZuamAssistantInstructions(),
    input: messages
  };
  const maxOutputTokens = getPositiveIntegerEnv("OPENAI_CHAT_MAX_OUTPUT_TOKENS");

  if (maxOutputTokens) {
    payload.max_output_tokens = maxOutputTokens;
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    cache: "no-store"
  });

  const data = (await response.json().catch(() => null)) as ResponsesApiResponse | null;

  if (!response.ok) {
    return NextResponse.json(
      {
        error: "OpenAI could not create a response.",
        details: data?.error?.message ?? `OpenAI returned ${response.status}.`
      },
      { status: response.status }
    );
  }

  const message = extractOutputText(data);

  if (!message) {
    return NextResponse.json(
      { error: "OpenAI did not return a text response." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    message,
    response_id: data?.id
  });
}
