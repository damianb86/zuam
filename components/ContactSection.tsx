"use client";

import { FormEvent, useMemo, useState } from "react";
import { Mail, Send } from "lucide-react";
import { CONTACT_EMAIL, socialLinks } from "@/data/site";
import { SectionHeading } from "@/components/SectionHeading";
import { getZuamApiUrl } from "@/lib/zuam/api";

type FormState = {
  name: string;
  email: string;
  company: string;
  message: string;
};

type ContactResponse = {
  ok?: boolean;
  error?: string;
  contactEmail?: string;
};

const initialState: FormState = {
  name: "",
  email: "",
  company: "",
  message: ""
};

export function ContactSection() {
  const [form, setForm] = useState<FormState>(initialState);
  const [status, setStatus] = useState<
    "idle" | "error" | "sent" | "not-configured" | "failed"
  >("idle");

  const isValid = useMemo(() => {
    return (
      form.name.trim().length > 1 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) &&
      form.message.trim().length > 9
    );
  }, [form]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isValid) {
      setStatus("error");
      return;
    }

    const response = await fetch(getZuamApiUrl("contact"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ...form,
        source: "contact-form"
      })
    });
    const data = (await response.json().catch(() => ({}))) as ContactResponse;

    if (response.ok) {
      setStatus("sent");
      setForm(initialState);
      return;
    }

    if (response.status === 503) {
      setStatus("not-configured");
      return;
    }

    setStatus(data.error ? "failed" : "error");
  };

  return (
    <section id="contact" className="section-padding border-t border-ink/10 bg-white/60">
      <div className="section-shell grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <SectionHeading
            eyebrow="Contact"
            title="Let&apos;s talk"
            description="Tell us what you want to build, improve, or automate. We will respond with a technical and strategic perspective."
          />

          <div className="mt-8 space-y-5">
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="inline-flex items-center gap-3 rounded-[10px] border border-ink/10 bg-white px-4 py-3 font-semibold text-ink transition hover:border-violet/40 hover:text-violet focus:outline-none focus:ring-2 focus:ring-violet focus:ring-offset-2"
            >
              <Mail size={18} aria-hidden="true" />
              {CONTACT_EMAIL}
            </a>

            <div className="flex flex-wrap gap-3">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-semibold text-slateText transition hover:border-violet/40 hover:text-ink focus:outline-none focus:ring-2 focus:ring-violet focus:ring-offset-2"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="surface-card p-5 sm:p-6" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-ink">Name</span>
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="mt-2 h-12 w-full rounded-[10px] border border-ink/10 bg-white px-4 text-ink outline-none transition placeholder:text-slateText/50 focus:border-violet focus:ring-4 focus:ring-violet/20"
                placeholder="Your name"
                autoComplete="name"
                required
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-ink">Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                className="mt-2 h-12 w-full rounded-[10px] border border-ink/10 bg-white px-4 text-ink outline-none transition placeholder:text-slateText/50 focus:border-violet focus:ring-4 focus:ring-violet/20"
                placeholder="you@company.com"
                autoComplete="email"
                required
              />
            </label>
          </div>

          <label className="mt-4 block">
            <span className="text-sm font-semibold text-ink">Company</span>
            <input
              value={form.company}
              onChange={(event) => setForm((current) => ({ ...current, company: event.target.value }))}
              className="mt-2 h-12 w-full rounded-[10px] border border-ink/10 bg-white px-4 text-ink outline-none transition placeholder:text-slateText/50 focus:border-violet focus:ring-4 focus:ring-violet/20"
              placeholder="Company or project"
              autoComplete="organization"
            />
          </label>

          <label className="mt-4 block">
            <span className="text-sm font-semibold text-ink">Message</span>
            <textarea
              value={form.message}
              onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
              className="mt-2 min-h-36 w-full resize-y rounded-[10px] border border-ink/10 bg-white px-4 py-3 text-ink outline-none transition placeholder:text-slateText/50 focus:border-violet focus:ring-4 focus:ring-violet/20"
              placeholder="Tell us what you want to build, improve, or automate."
              required
            />
          </label>

          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <button type="submit" className="button-primary">
              Send message
              <Send size={17} aria-hidden="true" />
            </button>
            <p className="min-h-6 text-sm font-medium text-slateText" role="status" aria-live="polite">
              {status === "error" ? "Please add your name, a valid email, and a short message." : null}
              {status === "sent" ? "Thanks. Your message was sent." : null}
              {status === "not-configured" ? `Contact delivery is not configured yet. Please email ${CONTACT_EMAIL}.` : null}
              {status === "failed" ? `We could not send the message. Please email ${CONTACT_EMAIL}.` : null}
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}
