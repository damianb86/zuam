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

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [isOpen, isSending, messages]);

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
