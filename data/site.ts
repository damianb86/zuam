import { ZUAM_APPS } from "@/lib/zuam/apps";
import { ZUAM_CONTACT_EMAIL } from "@/lib/zuam/knowledge";

export const CONTACT_EMAIL = ZUAM_CONTACT_EMAIL;

export const navLinks = [
  { label: "Shopify", href: "#shopify" },
  { label: "AI", href: "#ai" },
  { label: "Apps", href: "#apps" },
  { label: "Process", href: "#process" },
  { label: "Contact", href: "#contact" }
] as const;

export const footerLinks = [
  { label: "Shopify Apps", href: "#apps" },
  { label: "Shopify Engineering", href: "#shopify" },
  { label: "Applied AI", href: "#ai" },
  { label: "Integrations", href: "#what-we-build" },
  { label: "Apps by Zuam", href: "#apps" },
  { label: "Contact", href: "#contact" }
] as const;

export type AudienceIcon = "merchant" | "plus" | "agency" | "business";

export type AudienceSegment = {
  title: string;
  description: string;
  icon: AudienceIcon;
};

export type ServiceIcon =
  | "shopifyApp"
  | "shopifyEngineering"
  | "aiCommerce"
  | "integration"
  | "webSystem"
  | "consulting";

export type Service = {
  title: string;
  description: string;
  icon: ServiceIcon;
};

export type ShopifyCapabilityGroup = {
  title: string;
  description: string;
  items: string[];
};

export type AICardIcon =
  | "assistant"
  | "language"
  | "wizard"
  | "reviews"
  | "catalog"
  | "automation"
  | "systems"
  | "providers"
  | "control"
  | "context"
  | "evaluation"
  | "privacy";

export type AICard = {
  title: string;
  description: string;
  icon: AICardIcon;
};

export type AIGroup = {
  title: string;
  cards: AICard[];
};

export type EngagementIcon =
  | "privateApp"
  | "publicApp"
  | "partner"
  | "aiSprint"
  | "workflow"
  | "support"
  | "audit";

export type EngagementModel = {
  title: string;
  description: string;
  icon: EngagementIcon;
};

export type TechnologyGroup = {
  title: string;
  items: string[];
};

export const audienceSegments: AudienceSegment[] = [
  {
    title: "Shopify merchants",
    description:
      "For stores that need custom apps, workflow automation, storefront improvements, integrations, or functionality that standard apps cannot fully solve.",
    icon: "merchant"
  },
  {
    title: "Shopify Plus stores",
    description:
      "For serious commerce operations that need deeper platform work, custom logic, advanced integrations, and maintainable engineering.",
    icon: "plus"
  },
  {
    title: "Shopify and ecommerce agencies",
    description:
      "For agencies that need a senior technical partner to deliver Shopify apps, complex integrations, AI features, or backend-heavy implementation.",
    icon: "agency"
  },
  {
    title: "Startups and business teams",
    description:
      "For startups, SaaS companies, and business teams with meaningful technical needs around custom web systems, applied AI, dashboards, integrations, and automation.",
    icon: "business"
  }
];

export const pillars = [
  {
    title: "Technical depth",
    description:
      "We work close to the platform: APIs, architecture, data models, performance, integrations, and long-term maintainability."
  },
  {
    title: "Commerce focus",
    description:
      "Software must support operations, conversion, customer experience, and growth - not just look good in a demo."
  },
  {
    title: "Applied AI",
    description:
      "We build AI workflows around real data, app functionality, business rules, and human review where the work requires control."
  }
];

export const services: Service[] = [
  {
    title: "Custom Shopify Apps",
    description:
      "Store-specific and public Shopify apps built around real merchant workflows: embedded admin tools, storefront extensions, checkout logic, billing flows, reporting, automation, and external integrations.",
    icon: "shopifyApp"
  },
  {
    title: "Shopify Engineering",
    description:
      "Theme architecture, Liquid development, performance optimization, app blocks, theme app extensions, technical SEO, tracking, headless commerce, and Shopify Plus-oriented extensibility.",
    icon: "shopifyEngineering"
  },
  {
    title: "AI-powered Commerce",
    description:
      "AI commerce assistants, guided wizards, review and brand voice workflows, product analysis, content generation, and natural-language interfaces connected to commerce data.",
    icon: "aiCommerce"
  },
  {
    title: "Custom Integrations",
    description:
      "Shopify integrations and reliable connections between ERPs, CRMs, fulfillment providers, analytics platforms, payment systems, internal dashboards, and third-party APIs.",
    icon: "integration"
  },
  {
    title: "Custom Web Systems",
    description:
      "Web applications, dashboards, admin tools, and backend systems designed around business workflows, data models, and long-term maintainability.",
    icon: "webSystem"
  },
  {
    title: "Technical Consulting",
    description:
      "Architecture, feasibility analysis, Shopify app strategy, AI opportunity mapping, and senior technical guidance before or during implementation.",
    icon: "consulting"
  }
];

export const shopifyCapabilityGroups: ShopifyCapabilityGroup[] = [
  {
    title: "Custom and public apps",
    description:
      "Apps designed around merchant workflows, internal operations, storefront behavior, or productized Shopify App Store opportunities.",
    items: [
      "Custom Shopify apps",
      "Store-specific apps",
      "Public Shopify apps",
      "Shopify App Store apps",
      "Limited visibility listings",
      "Embedded admin apps",
      "App Bridge",
      "Polaris",
      "React Router app architecture",
      "App Store review readiness",
      "Shopify App Pricing",
      "Usage-based billing",
      "Long-term app maintenance"
    ]
  },
  {
    title: "Admin, APIs and data",
    description:
      "Reliable data flows, admin workflows, and integrations built on Shopify's core APIs and event systems.",
    items: [
      "GraphQL Admin API",
      "Storefront API",
      "Webhooks",
      "Bulk operations",
      "Access scopes",
      "API versioning",
      "Background jobs",
      "Data synchronization",
      "External API integrations"
    ]
  },
  {
    title: "Storefront and checkout",
    description:
      "Custom buyer-facing functionality, checkout extensions, and storefront behavior designed around real commerce requirements, plan constraints, and available Shopify surfaces.",
    items: [
      "Theme app extensions",
      "App blocks",
      "Liquid development",
      "Checkout UI Extensions",
      "Shopify Functions",
      "Cart and checkout validation",
      "Discount customizations",
      "Delivery customizations",
      "Payment customizations",
      "Cart Transform",
      "Bundles",
      "Selling plans",
      "Subscriptions"
    ]
  },
  {
    title: "Headless, tracking and commerce architecture",
    description:
      "Technical foundations for stores that need better data modeling, tracking, performance, or headless experiences.",
    items: [
      "Metafields",
      "Metaobjects",
      "Web pixel app extensions",
      "Customer account UI extensions",
      "Hydrogen",
      "Headless commerce",
      "Technical SEO",
      "Analytics integrations",
      "Product and catalog data modeling",
      "Performance optimization"
    ]
  }
];

export const apps = ZUAM_APPS.map((app) => ({
  name: app.name,
  description: app.shortDescription,
  icon: app.icon,
  url: app.url,
  tags: app.tags.slice(0, 3),
  useCases: app.useCases.slice(0, 2),
  status: app.status
}));

export const engagementModels: EngagementModel[] = [
  {
    title: "Custom Shopify App",
    description:
      "For merchants that need a store-specific or workflow-specific Shopify app built around their business rules.",
    icon: "privateApp"
  },
  {
    title: "Public Shopify App",
    description:
      "For products intended to be listed, distributed, or monetized through the Shopify App Store.",
    icon: "publicApp"
  },
  {
    title: "Shopify Engineering Support",
    description:
      "For merchants or agencies that need senior Shopify development support across apps, themes, integrations, and platform extensions.",
    icon: "partner"
  },
  {
    title: "AI Integration Sprint",
    description:
      "For businesses that want to identify, prototype, and implement practical AI use cases inside Shopify, ecommerce operations, or existing business systems.",
    icon: "aiSprint"
  },
  {
    title: "Custom Workflow Build",
    description:
      "For companies that need dashboards, internal tools, automations, or web systems connected to their data and business processes.",
    icon: "workflow"
  },
  {
    title: "Ongoing Technical Support",
    description:
      "For growing teams that need reliable senior development for continuous improvements, maintenance, app evolution, and technical decisions.",
    icon: "support"
  },
  {
    title: "Technical Audit",
    description:
      "For merchants, agencies, or business teams that need a senior review of Shopify architecture, app strategy, integrations, AI workflows, performance, or technical risk.",
    icon: "audit"
  }
];

export const technologyGroups: TechnologyGroup[] = [
  {
    title: "Frontend",
    items: ["JavaScript", "TypeScript", "React", "Liquid", "Hydrogen"]
  },
  {
    title: "Backend",
    items: [
      "Node.js",
      "Ruby on Rails",
      "PHP",
      "API design",
      "Background jobs",
      "Data modeling"
    ]
  },
  {
    title: "Commerce",
    items: [
      "Shopify",
      "Shopify Apps",
      "GraphQL Admin API",
      "Storefront API",
      "Checkout Extensibility",
      "Webhooks",
      "Bulk operations",
      "App Bridge",
      "Polaris",
      "Theme app extensions",
      "Shopify Functions"
    ]
  },
  {
    title: "AI and automation",
    items: [
      "OpenAI",
      "Claude",
      "Gemini",
      "Business-specific assistants",
      "RAG workflows",
      "Natural-language interfaces",
      "Workflow automation"
    ]
  },
  {
    title: "Platforms and systems",
    items: [
      "Drupal",
      "Headless CMS",
      "Custom dashboards",
      "Third-party integrations",
      "Internal tools"
    ]
  }
];

export const metrics = [
  { value: "17+", label: "years building software" },
  { value: "5+", label: "years working deeply with Shopify" },
  { value: "Live", label: "public Shopify apps installable" }
];

export const experienceClaims = [
  "17+ years building software",
  "5+ years working deeply with Shopify",
  "Experience across JavaScript, TypeScript, React, Ruby on Rails, Node.js, PHP, Drupal, and Shopify",
  "Strong focus on maintainable architecture, integrations, performance, and production reliability",
  "Direct communication with the person responsible for technical decisions"
];

export const processSteps = [
  {
    title: "Understand",
    description:
      "We analyze the business goal, current workflow, technical constraints, data sources, users, and success criteria."
  },
  {
    title: "Architect",
    description:
      "We define the right solution: custom app, integration, automation, AI workflow, storefront work, or web system."
  },
  {
    title: "Build",
    description:
      "We implement with clean architecture, maintainable code, platform best practices, and production reliability in mind."
  },
  {
    title: "Launch",
    description:
      "We test, deploy, monitor, and validate the system in the real business environment."
  },
  {
    title: "Improve",
    description:
      "We measure usage, performance, and outcomes, then iterate where the system can create more value."
  }
];

export const aiExamples = [
  "AI chats connected to app data",
  "Guided AI wizards",
  "Review generation and analysis",
  "Brand voice extraction",
  "Product and text analysis",
  "Content generation workflows",
  "OpenAI, Claude, and Gemini integrations",
  "Natural-language business workflows"
];

export const aiGroups: AIGroup[] = [
  {
    title: "What AI can do for your business",
    cards: [
      {
        title: "AI commerce assistants",
        description:
          "Customer-facing assistants, internal copilots, or AI agent interfaces that can answer questions, collect context, guide users, and escalate when needed.",
        icon: "assistant"
      },
      {
        title: "Natural-language app workflows",
        description:
          "Interfaces that let users interact with app features, data, and workflows through plain language instead of complex manual steps.",
        icon: "language"
      },
      {
        title: "AI-guided wizards",
        description:
          "Step-by-step assistants that help users complete complex workflows, configure features, or understand product functionality.",
        icon: "wizard"
      },
      {
        title: "Review and brand voice systems",
        description:
          "AI workflows for review generation, review analysis, response drafting, tone analysis, and brand voice extraction.",
        icon: "reviews"
      },
      {
        title: "Product and catalog intelligence",
        description:
          "AI-assisted analysis of product data, product quality signals, content gaps, catalog issues, and improvement opportunities.",
        icon: "catalog"
      },
      {
        title: "Content and operations automation",
        description:
          "AI workflows for summaries, content generation, classification, reporting, internal operations, and repetitive decision support.",
        icon: "automation"
      }
    ]
  },
  {
    title: "How Zuam makes AI practical",
    cards: [
      {
        title: "Connected to real systems",
        description:
          "AI agents and assistants should work with actual business data, app functionality, APIs, databases, and operational workflows.",
        icon: "systems"
      },
      {
        title: "Multi-provider implementation",
        description:
          "Zuam can work with model providers such as OpenAI, Claude, and Gemini depending on the use case, cost, quality, and integration needs.",
        icon: "providers"
      },
      {
        title: "Human control where needed",
        description:
          "For sensitive workflows, AI outputs can be reviewed, edited, or approved before reaching customers or modifying important data.",
        icon: "control"
      },
      {
        title: "Grounded context",
        description:
          "AI systems should use approved sources, business rules, and relevant context instead of relying on generic responses.",
        icon: "context"
      },
      {
        title: "Evaluation and logging",
        description:
          "Important workflows should be tested, logged, and improved over time so the system becomes more useful and reliable.",
        icon: "evaluation"
      },
      {
        title: "Privacy-aware architecture",
        description:
          "AI integrations should be designed with data boundaries, access control, and operational risk in mind.",
        icon: "privacy"
      }
    ]
  }
];

export const socialLinks: Array<{ label: string; href: string }> = [];
