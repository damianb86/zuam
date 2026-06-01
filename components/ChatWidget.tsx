"use client";

import {
  BarChart3,
  BriefcaseBusiness,
  Mail,
  MessageSquareText,
  Send,
  Settings2,
  Sparkles,
  X
} from "lucide-react";
import Image from "next/image";
import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";
import {
  ZUAM_CHAT_SUGGESTIONS,
  type ZuamChatSuggestion
} from "@/lib/zuam/chatSuggestions";
import { getZuamApiUrl } from "@/lib/zuam/api";
import { ZUAM_CONTACT_EMAIL } from "@/lib/zuam/knowledge";

const assistantName =
  process.env.NEXT_PUBLIC_OPENAI_CHAT_ASSISTANT_NAME ||
  "Zuam AI Assistant";
const configuredModelLabel =
  process.env.NEXT_PUBLIC_OPENAI_CHAT_MODEL_LABEL ||
  "GPT-5.4 Nano";
const WELCOME_MESSAGE_ID = "zuam-welcome-message";
const CONTACT_INITIAL_CAPTURE_DELAY_MS = getPositivePublicInteger(
  process.env.NEXT_PUBLIC_CHAT_CONTACT_INITIAL_CAPTURE_DELAY_MS,
  12_000
);
const CONTACT_FOLLOWUP_CAPTURE_DELAY_MS = getPositivePublicInteger(
  process.env.NEXT_PUBLIC_CHAT_CONTACT_FOLLOWUP_CAPTURE_DELAY_MS,
  90_000
);
const CONTACT_MIN_CONTEXT_CHARS = 24;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const CONTACT_INTENT_PATTERN =
  /\b(contact|contactar|contacten|contactame|contáctame|hablar|equipo|team|send|enviar|mandar|mail|email|e-mail|mensaje|message|cotizar|quote|proposal|propuesta|presupuesto|reunion|meeting|call|llamada|contratar|hire|project|proyecto)\b/i;
const CONTACT_OPT_OUT_PATTERN =
  /\b(no envies|no envíes|no mandes|no enviar|don't send|do not send|cancel|cancelar|forget it|olvidalo|olvídalo)\b/i;
const CONTACT_SENT_PATTERN =
  /\b(zuam received|team received|message was sent|email was sent|received your message|recibio el mensaje|recibio tu mensaje|mensaje fue enviado|email fue enviado)\b/i;

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

type ChatApiResponse = {
  message?: string;
  error?: string;
  details?: string;
};

type ContactCaptureState = {
  contactFlowStarted: boolean;
  email: string | null;
  meaningfulContext: string;
  transcript: string;
  fingerprint: string;
  optedOut: boolean;
  contactAlreadySent: boolean;
};

type ContactCapturePayload = {
  captureType: "initial" | "followup";
  state: ContactCaptureState;
};

type ContactCaptureRequestBody = {
  type: string;
  subject: string;
  name: string;
  email: string;
  company: string;
  message: string;
  source: string;
  assistantInterpretation: string;
  requestedOutcome: string;
  projectType: string;
  urgency: string;
  transcript: string;
};

function createMessageId(role: ChatRole) {
  return `${role}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function getChatErrorMessage(data: ChatApiResponse | null) {
  return (
    data?.details ||
    data?.error ||
    "The assistant could not respond. Check the chat configuration."
  );
}

function getPositivePublicInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getSuggestionIcon(icon: ZuamChatSuggestion["icon"]) {
  if (icon === "suitcase") {
    return BriefcaseBusiness;
  }

  if (icon === "analytics") {
    return BarChart3;
  }

  if (icon === "settings-slider") {
    return Settings2;
  }

  if (icon === "mail") {
    return Mail;
  }

  return Sparkles;
}

function getApiMessages(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.id !== WELCOME_MESSAGE_ID)
    .map(({ role, content }) => ({ role, content }));
}

function normalizeContactText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function extractEmail(messages: ChatMessage[]) {
  for (const message of [...messages].reverse()) {
    if (message.role !== "user") {
      continue;
    }

    const match = message.content.match(EMAIL_PATTERN);
    if (match) {
      return match[0];
    }
  }

  return null;
}

function hasContactIntent(messages: ChatMessage[]) {
  return messages.some((message) => {
    if (message.id === WELCOME_MESSAGE_ID) {
      return false;
    }

    return CONTACT_INTENT_PATTERN.test(normalizeContactText(message.content));
  });
}

function hasContactOptOut(messages: ChatMessage[]) {
  return messages.some((message) => {
    if (message.role !== "user") {
      return false;
    }

    return CONTACT_OPT_OUT_PATTERN.test(normalizeContactText(message.content));
  });
}

function hasAssistantContactSentConfirmation(messages: ChatMessage[]) {
  return messages.some((message) => {
    if (message.role !== "assistant") {
      return false;
    }

    return CONTACT_SENT_PATTERN.test(normalizeContactText(message.content));
  });
}

function getMeaningfulUserContext(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.role === "user")
    .map((message) => message.content.replace(EMAIL_PATTERN, "").trim())
    .filter((content) => content.length > 0)
    .join("\n\n")
    .slice(0, 4000);
}

function buildTranscript(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.id !== WELCOME_MESSAGE_ID)
    .slice(-12)
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n")
    .slice(0, 12000);
}

function getContactCaptureState(messages: ChatMessage[]): ContactCaptureState {
  const meaningfulContext = getMeaningfulUserContext(messages);
  const transcript = buildTranscript(messages);

  return {
    contactFlowStarted: hasContactIntent(messages),
    email: extractEmail(messages),
    meaningfulContext,
    transcript,
    fingerprint: `${meaningfulContext}\n\n${transcript}`,
    optedOut: hasContactOptOut(messages),
    contactAlreadySent: hasAssistantContactSentConfirmation(messages)
  };
}

function inferProjectType(value: string) {
  const text = normalizeContactText(value);

  if (/\b(shopify|store|theme|liquid|checkout|app store)\b/.test(text)) {
    return "Shopify";
  }

  if (/\b(ai|ia|automation|automatizacion|assistant|chatbot|workflow)\b/.test(text)) {
    return "AI and automation";
  }

  if (/\b(performance|speed|seo|conversion|cro|analytics)\b/.test(text)) {
    return "Performance and growth";
  }

  return "General project inquiry";
}

function inferUrgency(value: string) {
  const text = normalizeContactText(value);

  if (/\b(urgent|urgente|asap|hoy|today|now|ahora|critical|critico)\b/.test(text)) {
    return "high";
  }

  return "normal";
}

function canCaptureContactState(state: ContactCaptureState) {
  return Boolean(
    state.contactFlowStarted &&
      !state.optedOut &&
      state.email &&
      state.meaningfulContext.length >= CONTACT_MIN_CONTEXT_CHARS
  );
}

function buildContactCaptureRequestBody({
  captureType,
  state
}: ContactCapturePayload): ContactCaptureRequestBody {
  return {
    type: `ai_chat_auto_${captureType}`,
    subject:
      captureType === "initial"
        ? "AI chat contact lead captured"
        : "AI chat contact lead update",
    name: "Chat visitor",
    email: state.email || "",
    company: "",
    message: state.meaningfulContext,
    source: `ai-chat-auto-${captureType}`,
    assistantInterpretation:
      captureType === "initial"
        ? "The visitor started a direct contact flow in chat. This is an automatic preliminary capture to avoid losing the lead."
        : "The visitor added more information after the initial chat lead capture. This is an automatic follow-up with a more complete transcript.",
    requestedOutcome: "Follow up with the visitor by email.",
    projectType: inferProjectType(state.fingerprint),
    urgency: inferUrgency(state.fingerprint),
    transcript: state.transcript
  };
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: WELCOME_MESSAGE_ID,
      role: "assistant",
      content:
        "Hi, I'm Zuam's assistant. I can help you understand our services, Shopify apps, applied AI work, and how to contact the team."
    }
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const initialCaptureFingerprintRef = useRef("");
  const followupCaptureFingerprintRef = useRef("");
  const contactCaptureInFlightRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [isOpen, isSending, messages]);

  const sendContactCapture = useCallback(async ({
    captureType,
    state
  }: ContactCapturePayload) => {
    if (!state.email || contactCaptureInFlightRef.current) {
      return;
    }

    contactCaptureInFlightRef.current = true;

    try {
      await fetch(getZuamApiUrl("contact"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(
          buildContactCaptureRequestBody({ captureType, state })
        )
      });
    } catch {
      // This safety net should never interrupt the visible chat flow.
    } finally {
      contactCaptureInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    const state = getContactCaptureState(messages);

    if (state.contactAlreadySent && !initialCaptureFingerprintRef.current) {
      initialCaptureFingerprintRef.current = state.fingerprint;
    }

    const canCapture = canCaptureContactState(state);

    if (!canCapture) {
      return;
    }

    if (!initialCaptureFingerprintRef.current) {
      const timer = window.setTimeout(() => {
        const latestState = getContactCaptureState(messages);
        if (
          canCaptureContactState(latestState) &&
          !initialCaptureFingerprintRef.current
        ) {
          initialCaptureFingerprintRef.current = latestState.fingerprint;
          void sendContactCapture({
            captureType: "initial",
            state: latestState
          });
        }
      }, CONTACT_INITIAL_CAPTURE_DELAY_MS);

      return () => window.clearTimeout(timer);
    }

    if (state.fingerprint === followupCaptureFingerprintRef.current) {
      return;
    }

    if (state.fingerprint === initialCaptureFingerprintRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      const latestState = getContactCaptureState(messages);

      if (
        canCaptureContactState(latestState) &&
        latestState.fingerprint !== initialCaptureFingerprintRef.current &&
        latestState.fingerprint !== followupCaptureFingerprintRef.current
      ) {
        followupCaptureFingerprintRef.current = latestState.fingerprint;
        void sendContactCapture({
          captureType: "followup",
          state: latestState
        });
      }
    }, CONTACT_FOLLOWUP_CAPTURE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [messages, sendContactCapture]);

  useEffect(() => {
    const handlePageHide = () => {
      const state = getContactCaptureState(messages);

      if (!canCaptureContactState(state) || initialCaptureFingerprintRef.current) {
        return;
      }

      initialCaptureFingerprintRef.current = state.fingerprint;
      const body = JSON.stringify(
        buildContactCaptureRequestBody({
          captureType: "initial",
          state
        })
      );
      const blob = new Blob([body], { type: "application/json" });
      const url = getZuamApiUrl("contact");

      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, blob);
        return;
      }

      void fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body,
        keepalive: true
      }).catch(() => {});
    };

    window.addEventListener("pagehide", handlePageHide);

    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [messages]);

  const openContactForm = () => {
    setIsOpen(false);
    window.setTimeout(() => {
      document.querySelector("#contact")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
      window.history.replaceState(null, "", "#contact");
    }, 80);
  };

  const openEmailClient = () => {
    const subject = encodeURIComponent("Project inquiry for Zuam");
    window.location.href = `mailto:${ZUAM_CONTACT_EMAIL}?subject=${subject}`;
  };

  const sendMessage = async (rawContent: string) => {
    const content = rawContent.trim();

    if (!content || isSending) {
      return;
    }

    const userMessage: ChatMessage = {
      id: createMessageId("user"),
      role: "user",
      content
    };
    const nextMessages = [...getApiMessages(messages), userMessage];

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setChatError("");
    setIsSending(true);

    try {
      const response = await fetch(getZuamApiUrl("chat"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content: messageContent }) => ({
            role,
            content: messageContent
          }))
        })
      });
      const data = (await response.json().catch(() => null)) as ChatApiResponse | null;

      if (!response.ok || !data?.message) {
        throw new Error(getChatErrorMessage(data));
      }

      setMessages((current) => [
        ...current,
        {
          id: createMessageId("assistant"),
          role: "assistant",
          content: data.message || ""
        }
      ]);
    } catch (error) {
      setChatError(
        error instanceof Error
          ? error.message
          : "The assistant could not respond. Please try again."
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(input);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(input);
    }
  };

  const showSuggestions = messages.length === 1 && !isSending;

  return (
    <div className="fixed bottom-5 right-5 z-[90] flex max-w-[calc(100vw-2.5rem)] flex-col items-end gap-4 sm:bottom-6 sm:right-6">
      {isOpen ? (
        <section
          className="relative flex h-[min(680px,calc(100vh-7rem))] w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-[8px] border border-ink/10 bg-white shadow-[0_28px_80px_rgba(7,18,38,0.24)] sm:w-[420px]"
          aria-label={assistantName}
        >
          <header className="flex items-center gap-3 border-b border-ink/10 bg-white px-4 py-3">
            <Image
              src="/assets/ai-assistant-icon-gradient.png"
              alt=""
              width={38}
              height={38}
              className="h-10 w-10 rounded-full bg-ink object-contain"
            />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-semibold text-ink">
                {assistantName}
              </h2>
              <p className="truncate text-xs font-medium text-slateText">
                {configuredModelLabel}
              </p>
            </div>
            <button
              type="button"
              aria-label="Open contact form"
              title="Open contact form"
              onClick={openContactForm}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slateText transition hover:bg-mist hover:text-ink focus:outline-none focus:ring-2 focus:ring-violet"
            >
              <MessageSquareText size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Email Zuam"
              title="Email Zuam"
              onClick={openEmailClient}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slateText transition hover:bg-mist hover:text-ink focus:outline-none focus:ring-2 focus:ring-violet"
            >
              <Mail size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Close Zuam AI assistant"
              title="Close"
              onClick={() => setIsOpen(false)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slateText transition hover:bg-mist hover:text-ink focus:outline-none focus:ring-2 focus:ring-violet"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto bg-mist/50 px-4 py-4">
            <div className="space-y-4" aria-live="polite">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[86%] rounded-[8px] px-4 py-3 text-sm leading-6 ${
                      message.role === "user"
                        ? "bg-ink text-white"
                        : "border border-ink/10 bg-white text-ink shadow-soft"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                  </div>
                </div>
              ))}

              {isSending ? (
                <div className="flex justify-start">
                  <div className="rounded-[8px] border border-ink/10 bg-white px-4 py-3 text-sm font-medium text-slateText shadow-soft">
                    Thinking...
                  </div>
                </div>
              ) : null}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {showSuggestions ? (
            <div className="border-t border-ink/10 bg-white px-4 py-3">
              <div className="grid gap-2 sm:grid-cols-2">
                {ZUAM_CHAT_SUGGESTIONS.map((suggestion) => {
                  const SuggestionIcon = getSuggestionIcon(suggestion.icon);

                  return (
                    <button
                      key={suggestion.prompt}
                      type="button"
                      onClick={() => void sendMessage(suggestion.prompt)}
                      className="flex min-h-11 items-center gap-2 rounded-[8px] border border-ink/10 bg-white px-3 py-2 text-left text-xs font-semibold leading-5 text-ink transition hover:border-violet/50 hover:bg-paper focus:outline-none focus:ring-2 focus:ring-violet"
                    >
                      <SuggestionIcon
                        className="h-4 w-4 shrink-0 text-violet"
                        aria-hidden="true"
                      />
                      <span className="min-w-0">{suggestion.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <form
            onSubmit={handleSubmit}
            className="border-t border-ink/10 bg-white px-4 py-3"
          >
            {chatError ? (
              <p
                role="alert"
                className="mb-2 rounded-[8px] bg-red-50 px-3 py-2 text-xs font-medium leading-5 text-red-700"
              >
                {chatError}
              </p>
            ) : null}
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about Shopify, apps, performance, AI, or custom software..."
                rows={2}
                className="max-h-32 min-h-14 flex-1 resize-none rounded-[8px] border border-ink/15 bg-white px-4 py-3 text-sm leading-5 text-ink outline-none transition placeholder:text-slateText/75 focus:border-violet focus:ring-2 focus:ring-violet/20"
              />
              <button
                type="submit"
                aria-label="Send message"
                title="Send message"
                disabled={!input.trim() || isSending}
                className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-ink text-white shadow-button transition hover:-translate-y-0.5 hover:bg-night focus:outline-none focus:ring-2 focus:ring-violet focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
              >
                <Send size={18} aria-hidden="true" />
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        aria-label={isOpen ? "Close Zuam AI assistant" : "Open Zuam AI assistant"}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((value) => !value)}
        className="group relative grid h-16 w-16 place-items-center overflow-hidden rounded-full border border-white/14 bg-black text-white shadow-[0_18px_45px_rgba(7,18,38,0.3)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_65px_rgba(7,18,38,0.36)] focus:outline-none focus:ring-2 focus:ring-violet focus:ring-offset-2"
      >
        <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_25%,rgba(155,124,255,0.32),transparent_42%)] opacity-90" />
        {isOpen ? (
          <X className="relative z-10" size={26} aria-hidden="true" />
        ) : (
          <Image
            src="/assets/ai-assistant-icon-gradient.png"
            alt=""
            width={54}
            height={54}
            className="relative z-10 h-12 w-12 object-contain transition duration-300 group-hover:scale-105"
          />
        )}
      </button>
    </div>
  );
}
