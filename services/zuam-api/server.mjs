import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import nodemailer from "nodemailer";

const contentUrl = new URL("../../data/zuamContent.json", import.meta.url);
const zuamContent = JSON.parse(await readFile(contentUrl, "utf8"));

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const MAX_BODY_BYTES = Number.parseInt(process.env.MAX_BODY_BYTES || "131072", 10);
const MAX_MESSAGES = 18;
const MAX_MESSAGE_CHARS = 4000;
const DEFAULT_MODEL = "gpt-5.4-nano";
const CONTACT_TOOL_NAME = "send_zuam_contact_email";
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

function getBooleanEnv(name, defaultValue = false) {
  const raw = getOptionalEnv(name);

  if (!raw) {
    return defaultValue;
  }

  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

function getConfiguredModel() {
  return (
    getOptionalEnv("OPENAI_CHAT_MODEL") ||
    getOptionalEnv("NEXT_PUBLIC_OPENAI_CHAT_MODEL") ||
    DEFAULT_MODEL
  );
}

function getContactDeliveryMethod() {
  const value = getOptionalEnv("CONTACT_DELIVERY_METHOD") || "auto";

  return ["auto", "resend", "smtp", "webhook", "both"].includes(value)
    ? value
    : "auto";
}

function normalizeEmailRecipients(value) {
  return [
    ...new Set(
      String(value || "")
        .split(/[,\n;]/)
        .map((item) => item.trim())
        .filter(isValidEmail)
    )
  ];
}

function getContactRecipients() {
  return normalizeEmailRecipients(
    getOptionalEnv("CONTACT_EMAIL_TO") ||
      getOptionalEnv("CONTACT_EMAIL") ||
      CONTACT_EMAIL
  );
}

function getResendConfig() {
  return {
    apiKey: getOptionalEnv("RESEND_API_KEY"),
    from: getOptionalEnv("RESEND_FROM") || "Zuam Website <noreply@zuam.dev>",
    recipients: getContactRecipients(),
    timeoutMs: Number.parseInt(process.env.RESEND_TIMEOUT_MS || "15000", 10)
  };
}

function getMissingResendConfig(resend = getResendConfig()) {
  return [
    ["CONTACT_EMAIL or CONTACT_EMAIL_TO", resend.recipients.length ? "ok" : ""],
    ["RESEND_API_KEY", resend.apiKey],
    ["RESEND_FROM", resend.from]
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
}

function hasResendConfig() {
  return getMissingResendConfig().length === 0;
}

function getSmtpConfig() {
  const port = Number.parseInt(process.env.EMAIL_PORT || "587", 10);
  const secure = getOptionalEnv("EMAIL_SECURE")
    ? getBooleanEnv("EMAIL_SECURE")
    : port === 465;

  return {
    host: getOptionalEnv("EMAIL_HOST"),
    port: Number.isFinite(port) && port > 0 ? port : 587,
    secure,
    user: getOptionalEnv("EMAIL_USER"),
    pass: getOptionalEnv("EMAIL_PASS"),
    from: getOptionalEnv("EMAIL_FROM") || getOptionalEnv("EMAIL_USER"),
    fromName: getOptionalEnv("EMAIL_FROM_NAME") || "Zuam Website",
    recipients: getContactRecipients(),
    timeoutMs: Number.parseInt(process.env.EMAIL_TIMEOUT_MS || "15000", 10)
  };
}

function getMissingSmtpConfig(smtp = getSmtpConfig()) {
  return [
    ["CONTACT_EMAIL or CONTACT_EMAIL_TO", smtp.recipients.length ? "ok" : ""],
    ["EMAIL_HOST", smtp.host],
    ["EMAIL_USER", smtp.user],
    ["EMAIL_PASS", smtp.pass],
    ["EMAIL_FROM or EMAIL_USER", smtp.from]
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
}

function hasSmtpConfig() {
  return getMissingSmtpConfig().length === 0;
}

function hasWebhookConfig() {
  return Boolean(getOptionalEnv("CONTACT_WEBHOOK_URL"));
}

function isChatContactEmailEnabled() {
  return getBooleanEnv("CHAT_CONTACT_EMAIL_ENABLED", true);
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

function cleanOptionalText(value, maxLength) {
  const text = cleanText(value, maxLength);
  return text || null;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function extractEmailFromMessages(messages) {
  for (const message of [...messages].reverse()) {
    const match = message.content.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);

    if (match && isValidEmail(match[0])) {
      return match[0];
    }
  }

  return "";
}

function getUserProvidedContext(messages) {
  return messages
    .filter((message) => message.role === "user")
    .map((message) =>
      message.content.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "").trim()
    )
    .filter(Boolean)
    .join("\n")
    .slice(0, 4000);
}

function countAssistantQuestionSets(messages) {
  return messages.filter(
    (message) => message.role === "assistant" && /\?/.test(message.content)
  ).length;
}

function hasAssistantSentContact(messages) {
  return messages.some(
    (message) =>
      message.role === "assistant" &&
      /\b(contact sent|message was sent|email was sent|mensaje enviado|contacto enviado|zuam received|team received|recibio|recibió)\b/i.test(
        message.content
      )
  );
}

function getLeadFlowRuntimeInstructions(messages) {
  const hasEmail = Boolean(extractEmailFromMessages(messages));
  const hasContext = getUserProvidedContext(messages).length >= 24;
  const contactSent = hasAssistantSentContact(messages);
  const questionSets = countAssistantQuestionSets(messages);

  return `## Current lead-flow state

- Valid reply email already provided: ${hasEmail ? "yes" : "no"}.
- Meaningful project/business context already provided: ${hasContext ? "yes" : "no"}.
- Contact message already sent in this conversation: ${contactSent ? "yes" : "no"}.
- Assistant question sets already asked: ${questionSets}.

Use this state to avoid repeating questions and to enforce the two-question-set limit. If assistant question sets already asked is 2 or more, do not ask any more questions; acknowledge briefly and point to follow-up by email.`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeHeaderValue(value) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim();
}

function formatEmailAddress(name, email) {
  const safeEmail = escapeHeaderValue(email);
  const safeName = escapeHeaderValue(name);

  return safeName ? `"${safeName.replace(/"/g, "'")}" <${safeEmail}>` : safeEmail;
}

function createError(message, status = 500, details = {}) {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, details);
  return error;
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

You are a commercial lead-capture assistant for Zuam. Your primary job is to get enough contact and project information for the Zuam team to follow up. Give brief business-relevant answers only when they help move the visitor toward contact and a concrete commercial next step.

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

You may ask at most two question sets in the entire conversation. A question set is one assistant reply with one to three questions. Never ask a third question set.

Shopify:
${formatList(zuamContent.qualificationQuestions.shopify)}

AI:
${formatList(zuamContent.qualificationQuestions.ai)}

Apps:
${formatList(zuamContent.qualificationQuestions.apps)}

## Contact

Primary contact email: ${CONTACT_EMAIL}

All flows should move toward basic contact capture first. If the user starts with an informational question, answer in one short sentence if useful, then ask for name, reply email, and what they want to build, improve, or automate. Do not spend the conversation on general education.

The first question set should focus only on the minimum viable lead: name, reply email, company/project if any, and the business need. Keep it to one to three questions.

Once the user has provided a valid reply email and meaningful project/business context, use the ${CONTACT_TOOL_NAME} tool immediately. Do not ask for confirmation if the user has already shared the email and project context in this commercial chat. Do not claim the message was sent unless the tool succeeds.

After the tool succeeds, start your next visible reply by telling the user that Zuam already received enough information to contact them and that the message was sent. Then, only if you have asked fewer than two question sets, ask one second optional question set with one to three questions to improve the follow-up. Make clear those extra answers are optional and only help Zuam respond more accurately.

If the user answers the second question set, acknowledge briefly and do not ask more questions. If the user does not answer the second question set, that is fine: the lead was already sent. If delivery fails, say the message could not be sent right now and offer the contact form or ${CONTACT_EMAIL}.

When using the contact tool, include the user's original request, your interpretation, the requested outcome, and recent chat context.

## Scope boundaries

Only answer questions related to Zuam, Shopify, custom software, performance, conversion, SEO, applied AI, automation, integrations, apps, or hiring/contacting Zuam. If the user asks about weather, trivia, unrelated technical support, personal advice, or anything outside Zuam's business scope, politely refuse in one short sentence and redirect to what Zuam can help with. Do not answer the out-of-scope question.

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

function extractFunctionCalls(data) {
  return (data?.output || []).filter(
    (item) => item?.type === "function_call" && item.call_id && item.name
  );
}

function getContactEmailToolDefinition() {
  return {
    type: "function",
    name: CONTACT_TOOL_NAME,
    description:
      "Send a Zuam contact email from this chat. Use as soon as the user has provided a valid reply email and meaningful business/project context, even if they did not explicitly ask to send. Include the user's original request, your interpretation, requested outcome, and relevant context.",
    parameters: {
      type: "object",
      properties: {
        user_confirmed_send: {
          type: "boolean",
          description:
            "True when the user explicitly asked to send the message, confirmed that Zuam should receive it, or has provided a valid reply email plus meaningful business/project context in this commercial lead-capture chat."
        },
        subject: {
          type: "string",
          description: "Short email subject, without the Zuam prefix."
        },
        user_name: {
          type: ["string", "null"],
          description: "The user's name if known."
        },
        reply_email: {
          type: ["string", "null"],
          description: "The user's email address for follow-up. Ask for it before sending if missing."
        },
        company: {
          type: ["string", "null"],
          description: "Company, shop, or project name if known."
        },
        project_type: {
          type: ["string", "null"],
          description: "Short category such as Shopify app, Shopify theme, AI workflow, performance, consulting, or other."
        },
        urgency: {
          type: "string",
          enum: ["low", "normal", "high", "unknown"],
          description: "Urgency inferred from the user's request."
        },
        user_message: {
          type: "string",
          description: "The user's original request or the most relevant user-provided message."
        },
        assistant_interpretation: {
          type: "string",
          description:
            "A concise interpretation of what the user needs, including useful context and assumptions."
        },
        requested_outcome: {
          type: ["string", "null"],
          description: "What the user wants Zuam to do next, if known."
        }
      },
      required: [
        "user_confirmed_send",
        "subject",
        "user_name",
        "reply_email",
        "company",
        "project_type",
        "urgency",
        "user_message",
        "assistant_interpretation",
        "requested_outcome"
      ],
      additionalProperties: false
    },
    strict: true
  };
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

function buildContactEmailText(lead) {
  return [
    "Zuam contact request",
    "",
    "Contact",
    `- Name: ${lead.name || "Not provided"}`,
    `- Email: ${lead.email}`,
    `- Company/project: ${lead.company || "Not provided"}`,
    `- Source: ${lead.source}`,
    `- Submitted at: ${lead.submittedAt}`,
    "",
    "Subject",
    lead.subject,
    "",
    "User message",
    lead.message,
    "",
    lead.assistantInterpretation
      ? ["Assistant interpretation", lead.assistantInterpretation].join("\n")
      : "",
    lead.requestedOutcome
      ? ["Requested outcome", lead.requestedOutcome].join("\n")
      : "",
    lead.projectType ? `Project type: ${lead.projectType}` : "",
    lead.urgency ? `Urgency: ${lead.urgency}` : "",
    lead.transcript ? ["Recent chat transcript", lead.transcript].join("\n") : ""
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildContactEmailHtml(lead) {
  const rows = [
    ["Name", lead.name || "Not provided"],
    ["Email", lead.email],
    ["Company/project", lead.company || "Not provided"],
    ["Source", lead.source],
    ["Submitted at", lead.submittedAt],
    ["Project type", lead.projectType || "Not specified"],
    ["Urgency", lead.urgency || "Not specified"]
  ]
    .map(
      ([label, value]) =>
        `<tr><th align="left" style="padding:6px 12px 6px 0;">${escapeHtml(
          label
        )}</th><td style="padding:6px 0;">${escapeHtml(value)}</td></tr>`
    )
    .join("");

  return `<!doctype html>
<html>
  <body style="font-family:Arial,sans-serif;line-height:1.5;color:#071226;">
    <h2>Zuam contact request</h2>
    <table>${rows}</table>
    <h3>Subject</h3>
    <p>${escapeHtml(lead.subject)}</p>
    <h3>User message</h3>
    <p>${escapeHtml(lead.message).replace(/\n/g, "<br>")}</p>
    ${
      lead.assistantInterpretation
        ? `<h3>Assistant interpretation</h3><p>${escapeHtml(
            lead.assistantInterpretation
          ).replace(/\n/g, "<br>")}</p>`
        : ""
    }
    ${
      lead.requestedOutcome
        ? `<h3>Requested outcome</h3><p>${escapeHtml(
            lead.requestedOutcome
          ).replace(/\n/g, "<br>")}</p>`
        : ""
    }
    ${
      lead.transcript
        ? `<h3>Recent chat transcript</h3><pre style="white-space:pre-wrap;font-family:ui-monospace,Menlo,monospace;">${escapeHtml(
            lead.transcript
          )}</pre>`
        : ""
    }
  </body>
</html>`;
}

function buildContactLead(input) {
  return {
    type: cleanOptionalText(input.type, 80) || "contact_request",
    subject: cleanOptionalText(input.subject, 180) || "Website contact request",
    name: cleanOptionalText(input.name, 120),
    email: cleanText(input.email, 180),
    company: cleanOptionalText(input.company, 160),
    message: cleanText(input.message, 12000),
    source: cleanOptionalText(input.source, 80) || "website",
    assistantInterpretation: cleanOptionalText(input.assistantInterpretation, 4000),
    requestedOutcome: cleanOptionalText(input.requestedOutcome, 1600),
    projectType: cleanOptionalText(input.projectType, 160),
    urgency: cleanOptionalText(input.urgency, 40),
    transcript: cleanOptionalText(input.transcript, 12000),
    submittedAt: input.submittedAt || new Date().toISOString()
  };
}

async function sendContactLeadViaWebhook(lead) {
  const webhookUrl = getOptionalEnv("CONTACT_WEBHOOK_URL");

  if (!webhookUrl) {
    throw createError("Contact webhook is not configured.", 503, {
      missing: ["CONTACT_WEBHOOK_URL"]
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
      ...lead,
      contactEmail: CONTACT_EMAIL,
      text: buildContactEmailText(lead)
    }),
    signal: AbortSignal.timeout(
      Number.parseInt(process.env.CONTACT_WEBHOOK_TIMEOUT_MS || "15000", 10)
    )
  });

  if (!deliveryResponse.ok) {
    throw createError("Contact webhook delivery failed.", 502, {
      channel: "webhook",
      statusCode: deliveryResponse.status
    });
  }

  return { channel: "webhook" };
}

async function sendContactLeadViaResend(lead) {
  const resend = getResendConfig();
  const missing = getMissingResendConfig(resend);

  if (missing.length > 0) {
    throw createError("Resend contact delivery is not configured.", 503, {
      channel: "resend",
      missing
    });
  }

  const timeoutMs = Number.isFinite(resend.timeoutMs) && resend.timeoutMs > 0
    ? resend.timeoutMs
    : 15000;
  const subject = `[Zuam] ${lead.subject}`;
  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resend.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: resend.from,
      to: resend.recipients,
      reply_to: lead.email,
      subject,
      text: buildContactEmailText(lead),
      html: buildContactEmailHtml(lead),
      headers: {
        "X-Zuam-Contact-Source": lead.source,
        "X-Zuam-Contact-Type": lead.type
      },
      tags: [
        {
          name: "source",
          value:
            lead.source.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 256) ||
            "website"
        },
        {
          name: "type",
          value:
            lead.type.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 256) ||
            "contact"
        }
      ]
    }),
    signal: AbortSignal.timeout(timeoutMs)
  });
  const responseBody = await resendResponse.json().catch(() => null);

  if (!resendResponse.ok) {
    throw createError("Resend contact delivery failed.", 502, {
      channel: "resend",
      statusCode: resendResponse.status,
      providerError:
        responseBody?.message ||
        responseBody?.error?.message ||
        responseBody?.error ||
        undefined
    });
  }

  return {
    channel: "resend",
    recipients: resend.recipients,
    id: responseBody?.id
  };
}

async function sendContactLeadViaSmtp(lead) {
  const smtp = getSmtpConfig();
  const missing = getMissingSmtpConfig(smtp);

  if (missing.length > 0) {
    throw createError("SMTP contact delivery is not configured.", 503, {
      channel: "smtp",
      missing
    });
  }

  const timeoutMs = Number.isFinite(smtp.timeoutMs) && smtp.timeoutMs > 0
    ? smtp.timeoutMs
    : 15000;
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: {
      user: smtp.user,
      pass: smtp.pass
    },
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs
  });
  const subject = `[Zuam] ${lead.subject}`;

  await transporter.sendMail({
    from: formatEmailAddress(smtp.fromName, smtp.from),
    to: smtp.recipients,
    replyTo: lead.email,
    subject,
    text: buildContactEmailText(lead),
    html: buildContactEmailHtml(lead),
    headers: {
      "X-Zuam-Contact-Source": lead.source,
      "X-Zuam-Contact-Type": lead.type
    }
  });

  return { channel: "smtp", recipients: smtp.recipients };
}

async function deliverContactLead(lead) {
  const method = getContactDeliveryMethod();
  const resendConfigured = hasResendConfig();
  const smtpConfigured = hasSmtpConfig();
  const webhookConfigured = hasWebhookConfig();

  if (method === "resend") {
    return sendContactLeadViaResend(lead);
  }

  if (method === "smtp") {
    return sendContactLeadViaSmtp(lead);
  }

  if (method === "webhook") {
    return sendContactLeadViaWebhook(lead);
  }

  if (method === "both") {
    const emailDelivery = resendConfigured
      ? sendContactLeadViaResend(lead)
      : sendContactLeadViaSmtp(lead);
    const results = await Promise.all([
      emailDelivery,
      sendContactLeadViaWebhook(lead)
    ]);
    return { channel: "both", results };
  }

  if (resendConfigured) {
    try {
      return await sendContactLeadViaResend(lead);
    } catch (error) {
      if (!smtpConfigured && !webhookConfigured) {
        throw error;
      }

      log("warn", "resend_delivery_failed_using_fallback", {
        status: error.status || 500,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  if (smtpConfigured) {
    try {
      return await sendContactLeadViaSmtp(lead);
    } catch (error) {
      if (!webhookConfigured) {
        throw error;
      }

      log("warn", "smtp_delivery_failed_using_webhook_fallback", {
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  if (webhookConfigured) {
    return sendContactLeadViaWebhook(lead);
  }

  throw createError("Contact delivery is not configured yet.", 503, {
    missing: [
      "RESEND_API_KEY or CONTACT_WEBHOOK_URL or EMAIL_HOST/EMAIL_USER/EMAIL_PASS"
    ]
  });
}

function formatChatTranscript(messages) {
  return messages
    .slice(-10)
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n");
}

async function executeContactToolCall(call, request, messages) {
  if (call.name !== CONTACT_TOOL_NAME) {
    return {
      type: "function_call_output",
      call_id: call.call_id,
      output: JSON.stringify({
        sent: false,
        code: "unknown_tool",
        message: "Unknown tool."
      })
    };
  }

  const ip = getRequestIp(request);

  if (isRateLimited(`chat-contact:${ip}`, contactRateLimit)) {
    return {
      type: "function_call_output",
      call_id: call.call_id,
      output: JSON.stringify({
        sent: false,
        code: "rate_limited",
        message: "Too many contact email requests. Ask the user to wait and try again."
      })
    };
  }

  let args;
  try {
    args = JSON.parse(call.arguments || "{}");
  } catch {
    args = {};
  }

  const replyEmail = cleanText(args.reply_email, 180);
  const userMessage = cleanText(args.user_message, 4000);
  const assistantInterpretation = cleanText(args.assistant_interpretation, 4000);

  if (!args.user_confirmed_send) {
    return {
      type: "function_call_output",
      call_id: call.call_id,
      output: JSON.stringify({
        sent: false,
        code: "missing_confirmation",
        message:
          "Send only after a valid reply email and meaningful project context are available, or ask for the missing contact details."
      })
    };
  }

  if (!isValidEmail(replyEmail)) {
    return {
      type: "function_call_output",
      call_id: call.call_id,
      output: JSON.stringify({
        sent: false,
        code: "missing_reply_email",
        message: "Ask the user for a valid reply email before sending."
      })
    };
  }

  if (userMessage.length < 10 || assistantInterpretation.length < 10) {
    return {
      type: "function_call_output",
      call_id: call.call_id,
      output: JSON.stringify({
        sent: false,
        code: "missing_details",
        message:
          "Ask for a clearer project or contact message before sending the email."
      })
    };
  }

  try {
    const lead = buildContactLead({
      type: "ai_chat_contact",
      subject: cleanText(args.subject, 180) || "AI chat contact request",
      name: cleanOptionalText(args.user_name, 120),
      email: replyEmail,
      company: cleanOptionalText(args.company, 160),
      message: userMessage,
      source: "ai-chat",
      assistantInterpretation,
      requestedOutcome: cleanOptionalText(args.requested_outcome, 1600),
      projectType: cleanOptionalText(args.project_type, 160),
      urgency: cleanOptionalText(args.urgency, 40),
      transcript: formatChatTranscript(messages)
    });
    const delivery = await deliverContactLead(lead);

    log("info", "chat_contact_sent", {
      status: 200,
      channel: delivery.channel
    });

    return {
      type: "function_call_output",
      call_id: call.call_id,
      output: JSON.stringify({
        sent: true,
        channel: delivery.channel,
        message:
          "The contact email was sent to Zuam. Tell the user the team received it and will follow up using the reply email."
      })
    };
  } catch (error) {
    log("error", "chat_contact_failed", {
      status: error.status || 500,
      message: error instanceof Error ? error.message : String(error)
    });

    return {
      type: "function_call_output",
      call_id: call.call_id,
      output: JSON.stringify({
        sent: false,
        code: "delivery_failed",
        message:
          "The contact email could not be sent right now. Ask the user to use the contact form or email address.",
        missing: error.missing || undefined
      })
    };
  }
}

async function requestOpenAiResponse(apiKey, payload, startedAt) {
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

    throw createError("OpenAI could not create a response.", openAiResponse.status, {
      publicBody: {
        error: "OpenAI could not create a response.",
        details: data?.error?.message || `OpenAI returned ${openAiResponse.status}.`
      }
    });
  }

  return data;
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
    instructions: `${getZuamAssistantInstructions()}\n\n${getLeadFlowRuntimeInstructions(messages)}`,
    input: messages,
    parallel_tool_calls: false
  };
  const maxOutputTokens = getPositiveIntegerEnv("OPENAI_CHAT_MAX_OUTPUT_TOKENS");
  const reasoningEffort = getAllowedEnv("OPENAI_CHAT_REASONING_EFFORT", REASONING_EFFORTS);
  const verbosity = getAllowedEnv("OPENAI_CHAT_VERBOSITY", VERBOSITY_LEVELS);

  if (isChatContactEmailEnabled()) {
    payload.tools = [getContactEmailToolDefinition()];
  }

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
  let data;

  try {
    data = await requestOpenAiResponse(apiKey, payload, startedAt);
  } catch (error) {
    return sendJson(
      request,
      response,
      error.status || 502,
      error.publicBody || { error: "OpenAI could not create a response." }
    );
  }

  let message = extractOutputText(data);
  const toolCalls = extractFunctionCalls(data);
  let contactSent = false;

  if (toolCalls.length > 0) {
    const toolOutputs = [];
    for (const toolCall of toolCalls) {
      const toolOutput = await executeContactToolCall(toolCall, request, messages);
      toolOutputs.push(toolOutput);

      try {
        const parsedOutput = JSON.parse(toolOutput.output || "{}");
        if (parsedOutput.sent) {
          contactSent = true;
        }
      } catch {
        // Ignore malformed tool output metadata; the model still receives it.
      }
    }

    try {
      data = await requestOpenAiResponse(
        apiKey,
        {
          ...payload,
          input: toolOutputs,
          previous_response_id: data.id
        },
        startedAt
      );
      message = extractOutputText(data);
    } catch (error) {
      return sendJson(
        request,
        response,
        error.status || 502,
        error.publicBody || { error: "OpenAI could not create a response." }
      );
    }
  }

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
    response_id: data?.id,
    contact_sent: contactSent,
    contact_message: contactSent
      ? "Mensaje enviado al contacto. Pronto nos comunicaremos."
      : undefined
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
  const message = cleanText(body.message, 12000);
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

  const lead = buildContactLead({
    type: cleanOptionalText(body.type, 80) || "website_contact_form",
    subject:
      cleanOptionalText(body.subject, 180) || `Website contact from ${name}`,
    name,
    email,
    company,
    message,
    source,
    assistantInterpretation: cleanOptionalText(body.assistantInterpretation, 4000),
    requestedOutcome: cleanOptionalText(body.requestedOutcome, 1600),
    projectType: cleanOptionalText(body.projectType, 160),
    urgency: cleanOptionalText(body.urgency, 40),
    transcript: cleanOptionalText(body.transcript, 12000)
  });

  let delivery;
  try {
    delivery = await deliverContactLead(lead);
  } catch (error) {
    const status = error.status || 502;
    return sendJson(request, response, status, {
      error:
        status === 503
          ? "Contact delivery is not configured yet."
          : "Contact delivery failed.",
      contactEmail: CONTACT_EMAIL,
      contactAnchor: "#contact",
      missing: error.missing || undefined
    });
  }

  log("info", "contact_sent", {
    status: 200,
    source,
    channel: delivery.channel
  });
  return sendJson(request, response, 200, {
    ok: true,
    channel: delivery.channel
  });
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
