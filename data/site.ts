import { ZUAM_APPS } from "@/lib/zuam/apps";
import { ZUAM_CONTACT_EMAIL } from "@/lib/zuam/knowledge";

export const CONTACT_EMAIL = ZUAM_CONTACT_EMAIL;

export const navLinks = [
  { label: "Home", href: "#home" },
  { label: "What we do", href: "#what-we-do" },
  { label: "Shopify", href: "#shopify" },
  { label: "Apps", href: "#apps" },
  { label: "Technologies", href: "#technologies" },
  { label: "Process", href: "#process" },
  { label: "Contact", href: "#contact" }
] as const;

export type ServiceIcon =
  | "shopifyApp"
  | "theme"
  | "launch"
  | "custom"
  | "performance"
  | "conversion"
  | "seo"
  | "automation"
  | "ai";

export type Service = {
  title: string;
  description: string;
  icon: ServiceIcon;
};

export const pillars = [
  {
    title: "Technical clarity",
    description:
      "We turn complex problems into simple, maintainable, and scalable systems."
  },
  {
    title: "Business judgment",
    description:
      "We do not build isolated features. We think through impact, operations, conversion, and growth."
  },
  {
    title: "Applied AI",
    description:
      "We integrate artificial intelligence where it creates real value: automation, analysis, assistance, personalization, and better decisions."
  }
];

export const services: Service[] = [
  {
    title: "Shopify app development",
    description:
      "We build private, public, and custom apps that extend how Shopify stores operate.",
    icon: "shopifyApp"
  },
  {
    title: "Shopify themes from scratch",
    description:
      "We design and implement fast, flexible, custom themes ready to scale.",
    icon: "theme"
  },
  {
    title: "New shop enablement",
    description:
      "We configure stores, structures, catalogs, payments, shipping, integrations, and launch workflows.",
    icon: "launch"
  },
  {
    title: "Custom sections and features",
    description:
      "We develop blocks, components, flows, and specific experiences for each business.",
    icon: "custom"
  },
  {
    title: "Shopify performance",
    description:
      "We audit and optimize speed, Core Web Vitals, asset loading, Liquid, JavaScript, and mobile experience.",
    icon: "performance"
  },
  {
    title: "Conversion and UX",
    description:
      "We identify friction, improve purchase paths, and design experiences focused on conversion.",
    icon: "conversion"
  },
  {
    title: "Technical SEO for Shopify",
    description:
      "We improve structure, indexation, metadata, performance, technical content, and architecture.",
    icon: "seo"
  },
  {
    title: "Automation and AI",
    description:
      "We create intelligent workflows for analysis, support, operations, content, reporting, and tool integration.",
    icon: "automation"
  },
  {
    title: "AI-first consulting",
    description:
      "We help businesses redesign processes and products with practical, secure, measurable AI.",
    icon: "ai"
  }
];

export const shopifyCapabilities = [
  "Custom apps for Shopify",
  "Shopify App Store",
  "Custom themes",
  "Liquid",
  "Hydrogen and headless commerce",
  "Checkout extensibility",
  "External API integrations",
  "Tracking, analytics, and reporting",
  "Operations automation",
  "CRO, SEO, and performance"
];

export const apps = ZUAM_APPS.map((app) => ({
  name: app.name,
  description: app.shortDescription,
  icon: app.icon,
  url: app.url,
  tags: app.tags.slice(0, 3)
}));

export const technologies = [
  "Shopify",
  "React",
  "Next.js",
  "TypeScript",
  "Node.js",
  "GraphQL",
  "PostgreSQL",
  "Supabase",
  "Vercel",
  "AWS",
  "OpenAI",
  "Tailwind CSS",
  "Liquid",
  "Remix",
  "Prisma",
  "Stripe",
  "Google Analytics",
  "Meta Ads tracking"
];

export const metrics = [
  { value: "+X", label: "years of experience" },
  { value: "+X", label: "clients and projects" },
  { value: "+X", label: "mastered technologies" }
];

export const experienceClaims = [
  "Scalable architecture",
  "Maintainable code",
  "Product vision",
  "Real performance",
  "Complex integrations",
  "Clear communication"
];

export const processSteps = [
  {
    title: "Understand",
    description:
      "We analyze the business, the operation, the goals, and the constraints."
  },
  {
    title: "Design",
    description:
      "We define architecture, experience, priorities, and technical scope."
  },
  {
    title: "Build",
    description:
      "We develop with a focus on quality, speed, and maintainability."
  },
  {
    title: "Optimize",
    description:
      "We measure, iterate, and improve performance, conversion, and outcomes."
  }
];

export const aiExamples = [
  "Sales and behavior analysis",
  "Repetitive task automation",
  "Internal assistants for teams",
  "Content generation and improvement",
  "Data classification and enrichment",
  "Recommendations and personalization",
  "Intelligent reporting",
  "Model integration with existing software"
];

export const socialLinks = [
  { label: "LinkedIn", href: "https://www.linkedin.com/" },
  { label: "GitHub", href: "https://github.com/" },
  { label: "Shopify App Store", href: "https://apps.shopify.com/" }
];
