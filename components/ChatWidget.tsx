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
  type ReactNode,
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
const WELCOME_MESSAGE_ID = "zuam-welcome-message";
const CHAT_SESSION_STORAGE_KEY = "zuam_chat_session_v1";
const CONTACT_INITIAL_CAPTURE_DELAY_MS = getPositivePublicInteger(
  process.env.NEXT_PUBLIC_CHAT_CONTACT_INITIAL_CAPTURE_DELAY_MS,
  180_000
);
const CONTACT_FOLLOWUP_CAPTURE_DELAY_MS = getPositivePublicInteger(
  process.env.NEXT_PUBLIC_CHAT_CONTACT_FOLLOWUP_CAPTURE_DELAY_MS,
  180_000
);
const CONTACT_TOAST_DURATION_MS = 4_500;
const CONTACT_MIN_CONTEXT_CHARS = 24;
const CONTACT_FOLLOWUP_MIN_NEW_CONTEXT_CHARS = 40;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const CONTACT_INTENT_PATTERN =
  /\b(contact|contactar|contacten|contactame|contáctame|hablar|equipo|team|send|enviar|mandar|mail|email|e-mail|mensaje|message|cotizar|quote|proposal|propuesta|presupuesto|reunion|meeting|call|llamada|contratar|hire|project|proyecto)\b/i;
const CONTACT_OPT_OUT_PATTERN =
  /\b(no envies|no envíes|no mandes|no enviar|don't send|do not send|cancel|cancelar|forget it|olvidalo|olvídalo)\b/i;
const CONTACT_SENT_PATTERN =
  /\b(zuam received|team received|message was sent|email was sent|contact sent|received your message|recibio el mensaje|recibio tu mensaje|mensaje fue enviado|email fue enviado|contacto enviado|mensaje enviado)\b/i;

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
  contact_sent?: boolean;
  contact_message?: string;
};

type ChatSession = {
  id: string;
  startedAt: number;
};

type ContactCaptureState = {
  contactFlowStarted: boolean;
  email: string | null;
  meaningfulContext: string;
  transcript: string;
  fingerprint: string;
  optedOut: boolean;
  contactAlreadySent: boolean;
  contactSentCount: number;
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

function createChatSession(): ChatSession {
  const randomBytes = new Uint8Array(18);
  if (window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(randomBytes);
  } else {
    randomBytes.forEach((_, index) => {
      randomBytes[index] = Math.floor(Math.random() * 256);
    });
  }
  const id = Array.from(randomBytes, (byte) => byte.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 48);

  return {
    id,
    startedAt: Date.now()
  };
}

function getChatSession() {
  try {
    const stored = window.localStorage.getItem(CHAT_SESSION_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) as Partial<ChatSession> : null;

    if (
      parsed?.id &&
      /^[a-zA-Z0-9_-]{24,80}$/.test(parsed.id) &&
      typeof parsed.startedAt === "number"
    ) {
      return {
        id: parsed.id,
        startedAt: parsed.startedAt
      };
    }
  } catch {
    // A new ephemeral session is fine when storage is unavailable.
  }

  const session = createChatSession();

  try {
    window.localStorage.setItem(CHAT_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage failures; the in-memory session still protects this tab.
  }

  return session;
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

function getApiMessagesWithContactCaptureMarkers(
  messages: ChatMessage[],
  initialCaptureSent: boolean,
  followupCaptureSent: boolean
) {
  const apiMessages = getApiMessages(messages);
  const sentCount = countAssistantContactSentConfirmations(
    apiMessages.map((message, index) => ({
      id: `api-message-${index}`,
      role: message.role,
      content: message.content
    }))
  );

  if (initialCaptureSent && sentCount === 0) {
    apiMessages.push({
      role: "assistant",
      content: "Mensaje enviado al contacto. Pronto nos comunicaremos."
    });
  }

  if (followupCaptureSent && sentCount < 2) {
    apiMessages.push({
      role: "assistant",
      content: "Información agregada al contacto enviado."
    });
  }

  return apiMessages;
}

function renderInlineMarkdown(text: string) {
  const pattern = /(`[^`]+`|\*\*[^*]+?\*\*|__[^_]+?__|\*[^*\s][^*]*?\*|_[^_\s][^_]*?_)/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    const token = match[0];

    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(
        <strong key={`${match.index}-strong`}>{token.slice(2, -2)}</strong>
      );
    } else if (token.startsWith("__") && token.endsWith("__")) {
      nodes.push(
        <strong key={`${match.index}-strong-underscore`}>
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(
        <code
          key={`${match.index}-code`}
          className="rounded bg-ink/10 px-1 py-0.5 text-[0.92em]"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else {
      nodes.push(
        <em key={`${match.index}-emphasis`}>{token.slice(1, -1)}</em>
      );
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length ? nodes : text;
}

function renderMarkdown(content: string) {
  const lines = content.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      blocks.push(<div key={`space-${index}`} className="h-2" />);
      index += 1;
      continue;
    }

    const heading = line.match(/^\s{0,3}(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push(
        <p
          key={`heading-${index}`}
          className="font-semibold"
        >
          {renderInlineMarkdown(heading[2])}
        </p>
      );
      index += 1;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*]\s+/, ""));
        index += 1;
      }

      blocks.push(
        <ul key={`ul-${index}`} className="list-disc space-y-1 pl-5">
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, ""));
        index += 1;
      }

      blocks.push(
        <ol key={`ol-${index}`} className="list-decimal space-y-1 pl-5">
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    blocks.push(
      <p key={`p-${index}`} className="whitespace-pre-wrap break-words">
        {renderInlineMarkdown(line)}
      </p>
    );
    index += 1;
  }

  return blocks;
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

function hasUserMessage(messages: ChatMessage[]) {
  return messages.some((message) => message.role === "user");
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
  return countAssistantContactSentConfirmations(messages) > 0;
}

function countAssistantContactSentConfirmations(messages: ChatMessage[]) {
  return messages.filter((message) => {
    if (message.role !== "assistant") {
      return false;
    }

    return CONTACT_SENT_PATTERN.test(normalizeContactText(message.content));
  }).length;
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
    contactFlowStarted: hasUserMessage(messages) || hasContactIntent(messages),
    email: extractEmail(messages),
    meaningfulContext,
    transcript,
    fingerprint: `${meaningfulContext}\n\n${transcript}`,
    optedOut: hasContactOptOut(messages),
    contactAlreadySent: hasAssistantContactSentConfirmation(messages),
    contactSentCount: countAssistantContactSentConfirmations(messages)
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
    !state.optedOut &&
      state.email &&
      state.meaningfulContext.length >= CONTACT_MIN_CONTEXT_CHARS
  );
}

function hasMaterialContactUpdate(previousContext: string, nextContext: string) {
  const previous = previousContext.trim();
  const next = nextContext.trim();

  if (!previous) {
    return next.length >= CONTACT_FOLLOWUP_MIN_NEW_CONTEXT_CHARS;
  }

  if (normalizeContactText(previous) === normalizeContactText(next)) {
    return false;
  }

  if (next.startsWith(previous)) {
    return next.slice(previous.length).trim().length >= CONTACT_FOLLOWUP_MIN_NEW_CONTEXT_CHARS;
  }

  return next.length >= previous.length + CONTACT_FOLLOWUP_MIN_NEW_CONTEXT_CHARS;
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
        ? "The visitor provided enough contact and project context, then stopped interacting long enough to trigger the delayed lead safety net."
        : "The visitor added material new information after the initial chat lead capture. This is the single automatic follow-up with the more complete transcript.",
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
        "Hi, I'm Zuam's assistant. To help you quickly and follow up, please share your name, email, and what you want to build, improve, or automate."
    }
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const initialCaptureFingerprintRef = useRef("");
  const initialCaptureContextRef = useRef("");
  const followupCaptureFingerprintRef = useRef("");
  const followupCaptureSentRef = useRef(false);
  const contactCaptureInFlightRef = useRef(false);
  const toastTimerRef = useRef<number | null>(null);
  const chatSessionRef = useRef<ChatSession | null>(null);

  useEffect(() => {
    chatSessionRef.current = chatSessionRef.current || getChatSession();
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [isOpen, isSending, messages]);

  const showContactToast = useCallback((message?: string) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }

    setToastMessage(
      message || "Mensaje enviado al contacto. Pronto nos comunicaremos."
    );
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage("");
      toastTimerRef.current = null;
    }, CONTACT_TOAST_DURATION_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const sendContactCapture = useCallback(async ({
    captureType,
    state
  }: ContactCapturePayload) => {
    if (!state.email || contactCaptureInFlightRef.current) {
      return;
    }

    contactCaptureInFlightRef.current = true;

    try {
      const response = await fetch(getZuamApiUrl("contact"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(
          buildContactCaptureRequestBody({ captureType, state })
        )
      });

      if (response.ok) {
        showContactToast(
          captureType === "initial"
            ? "Mensaje enviado al contacto. Pronto nos comunicaremos."
            : "Información agregada al contacto enviado."
        );
      }
    } catch {
      // This safety net should never interrupt the visible chat flow.
    } finally {
      contactCaptureInFlightRef.current = false;
    }
  }, [showContactToast]);

  useEffect(() => {
    const state = getContactCaptureState(messages);

    if (state.contactAlreadySent && !initialCaptureFingerprintRef.current) {
      initialCaptureFingerprintRef.current = state.fingerprint;
      initialCaptureContextRef.current = state.meaningfulContext;
    }

    if (state.contactSentCount >= 2) {
      followupCaptureSentRef.current = true;
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
          initialCaptureContextRef.current = latestState.meaningfulContext;
          void sendContactCapture({
            captureType: "initial",
            state: latestState
          });
        }
      }, CONTACT_INITIAL_CAPTURE_DELAY_MS);

      return () => window.clearTimeout(timer);
    }

    if (followupCaptureSentRef.current) {
      return;
    }

    if (state.fingerprint === initialCaptureFingerprintRef.current) {
      return;
    }

    if (!hasMaterialContactUpdate(initialCaptureContextRef.current, state.meaningfulContext)) {
      return;
    }

    const timer = window.setTimeout(() => {
      const latestState = getContactCaptureState(messages);

      if (
        canCaptureContactState(latestState) &&
        latestState.fingerprint !== initialCaptureFingerprintRef.current &&
        !followupCaptureSentRef.current &&
        hasMaterialContactUpdate(initialCaptureContextRef.current, latestState.meaningfulContext)
      ) {
        followupCaptureFingerprintRef.current = latestState.fingerprint;
        followupCaptureSentRef.current = true;
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
      initialCaptureContextRef.current = state.meaningfulContext;
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
    chatSessionRef.current = chatSessionRef.current || getChatSession();
    const nextMessages = [
      ...getApiMessagesWithContactCaptureMarkers(
        messages,
        Boolean(initialCaptureFingerprintRef.current),
        followupCaptureSentRef.current
      ),
      userMessage
    ];

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
          session_id: chatSessionRef.current.id,
          session_started_at: chatSessionRef.current.startedAt,
          website: "",
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

      if (data.contact_sent) {
        showContactToast(data.contact_message);
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
    <div className="pointer-events-none fixed inset-0 z-[90]">
      {toastMessage ? (
        <div
          role="status"
          className="pointer-events-auto fixed left-1/2 top-1/2 z-[110] w-[min(360px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[16px] border border-ink/10 bg-violet px-5 py-4 text-center text-sm font-semibold leading-6 text-white shadow-[0_24px_70px_rgba(36,56,74,0.28)]"
        >
          {toastMessage}
        </div>
      ) : null}

      {isOpen ? (
        <section
          className="chat-panel pointer-events-auto fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))] right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] flex flex-col overflow-hidden rounded-[24px] border border-ink/10 bg-white shadow-[0_28px_80px_rgba(36,56,74,0.24)] sm:bottom-6 sm:left-auto sm:right-6 sm:top-auto sm:h-[min(680px,calc(100dvh-3rem))] sm:w-[420px]"
          aria-label={assistantName}
        >
          <header className="chat-panel-header flex items-center gap-2 border-b border-ink/10 bg-white px-3 py-3 sm:gap-3 sm:px-4">
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
            </div>
            <button
              type="button"
              aria-label="Open contact form"
              title="Open contact form"
              onClick={openContactForm}
              className="chat-icon-button grid h-9 w-9 shrink-0 place-items-center rounded-full text-slateText transition hover:bg-mist hover:text-ink focus:outline-none focus:ring-2 focus:ring-violet"
            >
              <MessageSquareText size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Email Zuam"
              title="Email Zuam"
              onClick={openEmailClient}
              className="chat-icon-button grid h-9 w-9 shrink-0 place-items-center rounded-full text-slateText transition hover:bg-mist hover:text-ink focus:outline-none focus:ring-2 focus:ring-violet"
            >
              <Mail size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Close Zuam AI assistant"
              title="Close"
              onClick={() => setIsOpen(false)}
              className="chat-icon-button grid h-9 w-9 shrink-0 place-items-center rounded-full text-slateText transition hover:bg-mist hover:text-ink focus:outline-none focus:ring-2 focus:ring-violet"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </header>

          <div className="chat-messages flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
            <div className="space-y-4" aria-live="polite">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[90%] rounded-[16px] px-4 py-3 text-sm leading-6 sm:max-w-[86%] ${
                      message.role === "user"
                        ? "chat-bubble-user bg-violet text-white"
                        : "chat-bubble-assistant border border-ink/10 bg-white text-ink shadow-soft"
                    }`}
                  >
                    <div className="space-y-2">
                      {renderMarkdown(message.content)}
                    </div>
                  </div>
                </div>
              ))}

              {isSending ? (
                <div className="flex justify-start">
                  <div className="chat-bubble-assistant rounded-[16px] border border-ink/10 bg-white px-4 py-3 text-sm font-medium text-slateText shadow-soft">
                    Thinking...
                  </div>
                </div>
              ) : null}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {showSuggestions ? (
            <div className="chat-suggestions border-t border-ink/10 bg-white px-3 py-3 sm:px-4">
              <div className="grid max-h-[30dvh] gap-2 overflow-y-auto sm:max-h-none sm:grid-cols-2 sm:overflow-visible">
                {ZUAM_CHAT_SUGGESTIONS.map((suggestion) => {
                  const SuggestionIcon = getSuggestionIcon(suggestion.icon);

                  return (
                    <button
                      key={suggestion.prompt}
                      type="button"
                      onClick={() => void sendMessage(suggestion.prompt)}
                      className="chat-suggestion-button flex min-h-11 items-center gap-2 rounded-[10px] border border-ink/10 bg-white px-3 py-2 text-left text-xs font-semibold leading-5 text-ink transition hover:border-violet/50 hover:bg-paper focus:outline-none focus:ring-2 focus:ring-violet"
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
            className="chat-input-bar border-t border-ink/10 bg-white px-3 py-3 sm:px-4"
          >
            {chatError ? (
              <p
                role="alert"
                className="mb-2 rounded-[10px] bg-red-50 px-3 py-2 text-xs font-medium leading-5 text-red-700"
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
                className="chat-input max-h-28 min-h-14 flex-1 resize-none rounded-[10px] border border-ink/15 bg-white px-4 py-3 text-base leading-5 text-ink outline-none transition placeholder:text-slateText/75 focus:border-violet focus:ring-2 focus:ring-violet/20 sm:max-h-32 sm:text-sm"
              />
              <button
                type="submit"
                aria-label="Send message"
                title="Send message"
                disabled={!input.trim() || isSending}
                className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-violet text-white shadow-button transition hover:-translate-y-0.5 hover:bg-night focus:outline-none focus:ring-2 focus:ring-violet focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
              >
                <Send size={18} aria-hidden="true" />
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {!isOpen ? (
        <button
          type="button"
          aria-label="Open Zuam AI assistant"
          aria-expanded={isOpen}
          onClick={() => setIsOpen(true)}
          className="pointer-events-auto group fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] grid h-16 w-16 place-items-center overflow-hidden rounded-full border border-white/20 bg-[#050607] text-white shadow-[0_18px_45px_rgba(5,6,7,0.34)] transition duration-300 hover:-translate-y-1 hover:bg-[#050607] hover:shadow-[0_24px_65px_rgba(5,6,7,0.42)] focus:outline-none focus:ring-2 focus:ring-violet focus:ring-offset-2 sm:bottom-6 sm:right-6"
        >
          <Image
            src="/assets/ai-assistant-icon-gradient.png"
            alt=""
            width={54}
            height={54}
            className="relative z-10 h-12 w-12 object-contain transition duration-300 group-hover:scale-105"
          />
        </button>
      ) : null}
    </div>
  );
}
