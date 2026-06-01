import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const contentUrl = new URL("../../data/zuamContent.json", import.meta.url);
const zuamContent = JSON.parse(await readFile(contentUrl, "utf8"));

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const MAX_BODY_BYTES = Number.parseInt(process.env.MAX_BODY_BYTES || "131072", 10);
const MAX_MESSAGES = 18;
const MAX_MESSAGE_CHARS = 4000;
const DEFAULT_MODEL = "gpt-5.5";
const REASONING_EFFORTS = new Set(["none", "low", "medium", "high", "xhigh"]);
const VERBOSITY_LEVELS = new Set(["low", "medium", "high"]);
const CONTACT_EMAIL =
  process.env.ZUAM_CONTACT_EMAIL ||
  process.env.NEXT_PUBLIC_ZUAM_CONTACT_EMAIL ||
  zuamContent.contactEmail;
const RATE_LIMIT_WINDOW_MS = 60_000;
const chatRateLimit = Number.parseInt(process.env.CHAT_RATE_LIMIT_PER_MINUTE || "12", 10);
const contactRateLimit = Number.parseInt(process.env.CONTACT_RATE_LIMIT_PER_MINUTE || "5", 10);
const buckets = new Map();

function log(level, event, details = {}) {
  console.log(
    JSON.stringify({
      level,
      event,
      service: "zuam-api",
      ...details,
      timestamp: new Date().toISOString()
    })
  );
}

function getOptionalEnv(name) {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function getRequiredEnv(name) {
  return getOptionalEnv(name) || null;
}

function getPositiveIntegerEnv(name) {
  const raw = getOptionalEnv(name);

  if (!raw) {
    return undefined;
  }

  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function getAllowedEnv(name, allowedValues) {
  const value = getOptionalEnv(name);

  return value && allowedValues.has(value) ? value : undefined;
}

function getConfiguredModel() {
  return (
    getOptionalEnv("OPENAI_CHAT_MODEL") ||
    getOptionalEnv("NEXT_PUBLIC_OPENAI_CHAT_MODEL") ||
    DEFAULT_MODEL
  );
}

function getAllowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function getRequestIp(request) {
  const forwardedFor = request.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  return request.socket.remoteAddress || "unknown";
}

function isAllowedOrigin(request) {
  const origin = request.headers.origin;

  if (!origin) {
    return true;
  }

  try {
    const originUrl = new URL(origin);
    const requestHost = request.headers["x-forwarded-host"] || request.headers.host;

    if (originUrl.host === requestHost) {
      return true;
    }

    return getAllowedOrigins().includes(origin);
  } catch {
    return false;
  }
}

function applyCors(request, response) {
  const origin = request.headers.origin;

  if (!origin || !isAllowedOrigin(request)) {
    return;
  }

  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function isRateLimited(key, limit) {
  if (!Number.isFinite(limit) || limit <= 0) {
    return false;
  }

  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  current.count += 1;
  return current.count > limit;
}

function cleanMessageContent(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, MAX_MESSAGE_CHARS);
}

function parseMessages(body) {
  if (!body || typeof body !== "object" || !Array.isArray(body.messages)) {
    return [];
  }

  return body.messages
    .map((message) => {
      if (!message || typeof message !== "object") {
        return null;
      }

      const role = message.role;
      const content = cleanMessageContent(message.content);

      if ((role !== "user" && role !== "assistant") || !content) {
        return null;
      }

      return { role, content };
    })
    .filter(Boolean)
    .slice(-MAX_MESSAGES);
}

function cleanText(value, maxLength) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatList(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

function formatApps() {
  return zuamContent.apps
    .map((app) =>
      [
        `### ${app.name}`,
        app.shortDescription,
        app.longDescription,
        `Tags: ${app.tags.join(", ")}`,
        `Status: ${app.status}`,
        app.url
          ? `URL: ${app.url}`
          : "URL: TODO - add the real Shopify App Store or product URL when available.",
        app.useCases.length ? `Use cases:\n${formatList(app.useCases)}` : "",
        app.notes?.length ? `Notes:\n${formatList(app.notes)}` : ""
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n\n");
}

function formatServices() {
  return zuamContent.services
    .map((service) =>
      [
        `### ${service.name}`,
        service.description,
        service.examples?.length ? `Examples:\n${formatList(service.examples)}` : "",
        service.caveat ? `Caveat: ${service.caveat}` : ""
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n\n");
}

function formatFaqs() {
  return zuamContent.faqs
    .map((faq) => {
      const answer = faq.answer.replace(zuamContent.contactEmail, CONTACT_EMAIL);
      return `Q: ${faq.question}\nA: ${answer}`;
    })
    .join("\n\n");
}

function getZuamAssistantInstructions() {
  return `# Zuam Assistant Instructions

You are the AI assistant for Zuam.

## Language

All configured company knowledge is written in English. Respond in the user's language when it is clear. If the user writes in Spanish, Spanish is allowed. If the user's language is unclear, use English.

## Role

Help visitors understand Zuam, its Shopify work, its own Shopify apps, applied AI services, how Zuam works, and how to contact the company. Be useful, honest, technically credible, and conversion-oriented without sounding pushy.

## Brand profile

Name: ${zuamContent.brandProfile.name}
Summary: ${zuamContent.brandProfile.summary}
Positioning: ${zuamContent.brandProfile.positioning}
Brand idea: ${zuamContent.brandProfile.brandIdea}
Avoid: ${zuamContent.brandProfile.notThis}

## Services

${formatServices()}

## Zuam apps

${formatApps()}

## Technologies

Do not say Zuam works exclusively with these technologies. Say they are part of the usual or possible stack, and that the final stack depends on the project.

${formatList(zuamContent.technologies)}

## FAQs and model answers

${formatFaqs()}

## Qualification questions

When a user seems interested in hiring Zuam, ask only 3 to 5 relevant questions.

Shopify:
${formatList(zuamContent.qualificationQuestions.shopify)}

AI:
${formatList(zuamContent.qualificationQuestions.ai)}

Apps:
${formatList(zuamContent.qualificationQuestions.apps)}

## Contact

Primary contact email: ${CONTACT_EMAIL}

When a user asks how to contact Zuam, offer the contact form and the email address. The website chat UI has separate contact buttons, but you do not have direct browser control from the model response.

Do not claim that an email has been sent from chat. If the user wants to send project details, ask them to use the contact form or email ${CONTACT_EMAIL}.

## Limits

${formatList(zuamContent.limitations)}

## Response style

${formatList(zuamContent.responseGuidelines)}

Avoid "As an AI..." phrasing. Avoid hype. Avoid absolute promises. If something is uncertain, state what must be evaluated and suggest a next step.`;
}

function extractOutputText(data) {
  if (!data) {
    return "";
  }

  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const parts = [];

  for (const item of data.output || []) {
    for (const content of item.content || []) {
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

function sendJson(request, response, status, body) {
  applyCors(request, response);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;

    if (size > MAX_BODY_BYTES) {
      const error = new Error("Request body is too large.");
      error.status = 413;
      throw error;
    }

    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return null;
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function handleChat(request, response) {
  const ip = getRequestIp(request);

  if (isRateLimited(`chat:${ip}`, chatRateLimit)) {
    return sendJson(request, response, 429, {
      error: "Too many chat requests. Please wait a moment and try again."
    });
  }

  const apiKey = getRequiredEnv("OPENAI_API_KEY");

  if (!apiKey) {
    return sendJson(request, response, 503, {
      error: "Chat is not configured yet.",
      missing: ["OPENAI_API_KEY"]
    });
  }

  const body = await readJsonBody(request).catch((error) => {
    error.status = error.status || 400;
    throw error;
  });
  const messages = parseMessages(body);

  if (!messages.some((message) => message.role === "user")) {
    return sendJson(request, response, 400, {
      error: "A user message is required."
    });
  }

  const payload = {
    model: getConfiguredModel(),
    instructions: getZuamAssistantInstructions(),
    input: messages
  };
  const maxOutputTokens = getPositiveIntegerEnv("OPENAI_CHAT_MAX_OUTPUT_TOKENS");
  const reasoningEffort = getAllowedEnv("OPENAI_CHAT_REASONING_EFFORT", REASONING_EFFORTS);
  const verbosity = getAllowedEnv("OPENAI_CHAT_VERBOSITY", VERBOSITY_LEVELS);

  if (maxOutputTokens) {
    payload.max_output_tokens = maxOutputTokens;
  }

  if (reasoningEffort) {
    payload.reasoning = { effort: reasoningEffort };
  }

  if (verbosity) {
    payload.text = { verbosity };
  }

  const startedAt = Date.now();
  const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(
      Number.parseInt(process.env.OPENAI_API_TIMEOUT_MS || "45000", 10)
    )
  });
  const data = await openAiResponse.json().catch(() => null);

  if (!openAiResponse.ok) {
    log("error", "openai_response_failed", {
      status: openAiResponse.status,
      durationMs: Date.now() - startedAt
    });

    return sendJson(request, response, openAiResponse.status, {
      error: "OpenAI could not create a response.",
      details: data?.error?.message || `OpenAI returned ${openAiResponse.status}.`
    });
  }

  const message = extractOutputText(data);

  if (!message) {
    return sendJson(request, response, 502, {
      error: "OpenAI did not return a text response."
    });
  }

  log("info", "chat_response_created", {
    status: 200,
    durationMs: Date.now() - startedAt,
    model: payload.model
  });

  return sendJson(request, response, 200, {
    message,
    response_id: data?.id
  });
}

async function handleContact(request, response) {
  const ip = getRequestIp(request);

  if (isRateLimited(`contact:${ip}`, contactRateLimit)) {
    return sendJson(request, response, 429, {
      error: "Too many contact requests. Please wait a moment and try again."
    });
  }

  const body = await readJsonBody(request).catch((error) => {
    error.status = error.status || 400;
    throw error;
  });

  if (!body || typeof body !== "object") {
    return sendJson(request, response, 400, {
      error: "Invalid contact payload."
    });
  }

  const name = cleanText(body.name, 120);
  const email = cleanText(body.email, 180);
  const company = cleanText(body.company, 160);
  const message = cleanText(body.message, 4000);
  const source = cleanText(body.source, 80) || "website";
  const missing = [
    name.length > 1 ? "" : "name",
    isValidEmail(email) ? "" : "email",
    message.length > 9 ? "" : "message"
  ].filter(Boolean);

  if (missing.length > 0) {
    return sendJson(request, response, 400, {
      error: "Missing required contact fields.",
      missing
    });
  }

  const webhookUrl = process.env.CONTACT_WEBHOOK_URL?.trim();

  if (!webhookUrl) {
    return sendJson(request, response, 503, {
      error: "Contact delivery is not configured yet.",
      contactEmail: CONTACT_EMAIL,
      contactAnchor: "#contact"
    });
  }

  const deliveryResponse = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.CONTACT_WEBHOOK_SECRET
        ? { Authorization: `Bearer ${process.env.CONTACT_WEBHOOK_SECRET}` }
        : {})
    },
    body: JSON.stringify({
      name,
      email,
      company,
      message,
      source,
      contactEmail: CONTACT_EMAIL,
      submittedAt: new Date().toISOString()
    }),
    signal: AbortSignal.timeout(
      Number.parseInt(process.env.CONTACT_WEBHOOK_TIMEOUT_MS || "15000", 10)
    )
  });

  if (!deliveryResponse.ok) {
    return sendJson(request, response, 502, {
      error: "Contact delivery failed.",
      contactEmail: CONTACT_EMAIL
    });
  }

  log("info", "contact_sent", { status: 200, source });
  return sendJson(request, response, 200, { ok: true });
}

const server = createServer(async (request, response) => {
  const startedAt = Date.now();

  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (request.method === "OPTIONS") {
      applyCors(request, response);
      response.writeHead(204);
      response.end();
      return;
    }

    if (request.method === "GET" && path === "/health") {
      return sendJson(request, response, 200, { ok: true });
    }

    if (!isAllowedOrigin(request)) {
      return sendJson(request, response, 403, {
        error: "Requests must come from an allowed origin."
      });
    }

    if (request.method === "POST" && (path === "/chat" || path === "/api/chat")) {
      return await handleChat(request, response);
    }

    if (request.method === "POST" && (path === "/contact" || path === "/api/contact")) {
      return await handleContact(request, response);
    }

    return sendJson(request, response, 404, { error: "Not found." });
  } catch (error) {
    const status = error.status || 500;
    log(status >= 500 ? "error" : "warn", "request_failed", {
      status,
      durationMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : String(error)
    });

    return sendJson(request, response, status, {
      error:
        status === 500
          ? "Unexpected server error."
          : error instanceof Error
            ? error.message
            : "Request failed."
    });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  log("info", "server_started", { port: PORT });
});
