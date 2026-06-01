import zuamContent from "@/data/zuamContent.json";

export type ZuamApp = {
  id: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  tags: string[];
  useCases: string[];
  url: string;
  icon: string;
  status: "available-or-in-progress" | "planned" | "private";
  notes?: string[];
};

export const ZUAM_APPS = zuamContent.apps as ZuamApp[];
