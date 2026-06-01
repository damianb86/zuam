import zuamContent from "@/data/zuamContent.json";
import { ZUAM_APPS } from "@/lib/zuam/apps";

export const ZUAM_CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_ZUAM_CONTACT_EMAIL || zuamContent.contactEmail;

export const ZUAM_BRAND_PROFILE = zuamContent.brandProfile;
export const ZUAM_SERVICES = zuamContent.services;
export const ZUAM_TECHNOLOGIES = zuamContent.technologies;
export const ZUAM_LIMITATIONS = zuamContent.limitations;
export const ZUAM_FAQS = zuamContent.faqs.map((faq) => ({
  ...faq,
  answer: faq.answer.replace(zuamContent.contactEmail, ZUAM_CONTACT_EMAIL)
}));
export const ZUAM_QUALIFICATION_QUESTIONS = zuamContent.qualificationQuestions;
export const ZUAM_RESPONSE_GUIDELINES = zuamContent.responseGuidelines;
export const ZUAM_CONTACT_TOOLS = zuamContent.contactTools;

export const ZUAM_KNOWLEDGE_BASE = {
  contactEmail: ZUAM_CONTACT_EMAIL,
  brandProfile: ZUAM_BRAND_PROFILE,
  services: ZUAM_SERVICES,
  technologies: ZUAM_TECHNOLOGIES,
  apps: ZUAM_APPS,
  faqs: ZUAM_FAQS,
  limitations: ZUAM_LIMITATIONS,
  qualificationQuestions: ZUAM_QUALIFICATION_QUESTIONS,
  responseGuidelines: ZUAM_RESPONSE_GUIDELINES,
  contactTools: ZUAM_CONTACT_TOOLS
};
