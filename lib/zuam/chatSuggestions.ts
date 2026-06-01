import zuamContent from "@/data/zuamContent.json";

export type ZuamChatSuggestion = {
  label: string;
  prompt: string;
  icon: "sparkle" | "suitcase" | "analytics" | "settings-slider" | "mail";
};

export const ZUAM_CHAT_SUGGESTIONS =
  zuamContent.chatSuggestions as ZuamChatSuggestion[];
