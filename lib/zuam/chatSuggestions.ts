export type ZuamChatSuggestion = {
  label: string;
  prompt: string;
  icon: "sparkle" | "suitcase" | "analytics" | "settings-slider" | "mail";
};

export const ZUAM_CHAT_SUGGESTIONS: ZuamChatSuggestion[] = [
  {
    label: "What does Zuam do?",
    prompt: "What does Zuam do?",
    icon: "sparkle"
  },
  {
    label: "Which Shopify apps does Zuam have?",
    prompt: "Which Shopify apps does Zuam have?",
    icon: "suitcase"
  },
  {
    label: "I need a custom Shopify app",
    prompt: "I need a custom Shopify app. What should we define first?",
    icon: "settings-slider"
  },
  {
    label: "I want to improve store performance",
    prompt: "I want to improve the performance of my Shopify store.",
    icon: "analytics"
  },
  {
    label: "Can Zuam integrate AI into my business?",
    prompt: "Can Zuam integrate AI into my business processes?",
    icon: "sparkle"
  },
  {
    label: "I want to contact Zuam",
    prompt: "I want to contact Zuam about a project.",
    icon: "mail"
  }
];
