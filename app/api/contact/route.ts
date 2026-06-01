import { NextRequest, NextResponse } from "next/server";
import { ZUAM_CONTACT_EMAIL } from "@/lib/zuam/knowledge";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ContactPayload = {
  name?: unknown;
  email?: unknown;
  company?: unknown;
  message?: unknown;
  source?: unknown;
};

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: "Contact requests must come from the same origin." },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => null)) as ContactPayload | null;

  if (!body) {
    return NextResponse.json(
      { error: "Invalid contact payload." },
      { status: 400 }
    );
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
    return NextResponse.json(
      {
        error: "Missing required contact fields.",
        missing
      },
      { status: 400 }
    );
  }

  const webhookUrl = process.env.CONTACT_WEBHOOK_URL?.trim();

  if (!webhookUrl) {
    return NextResponse.json(
      {
        error: "Contact delivery is not configured yet.",
        contactEmail: ZUAM_CONTACT_EMAIL,
        contactAnchor: "#contact"
      },
      { status: 503 }
    );
  }

  const response = await fetch(webhookUrl, {
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
      contactEmail: ZUAM_CONTACT_EMAIL,
      submittedAt: new Date().toISOString()
    })
  });

  if (!response.ok) {
    return NextResponse.json(
      {
        error: "Contact delivery failed.",
        contactEmail: ZUAM_CONTACT_EMAIL
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
