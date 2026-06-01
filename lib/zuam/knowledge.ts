import { ZUAM_APPS } from "@/lib/zuam/apps";

// TODO: replace this email if Zuam defines a different final contact address.
export const ZUAM_CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_ZUAM_CONTACT_EMAIL || "contact@zuam.com";

export const ZUAM_BRAND_PROFILE = {
  name: "Zuam",
  summary:
    "Zuam is a software, Shopify, and applied artificial intelligence company for digital businesses.",
  positioning:
    "Zuam combines senior technical execution, product judgment, and business clarity to build useful, scalable, well-considered digital systems.",
  brandIdea:
    "The brand is rooted in the idea of thinking in motion: intelligence that reads, orders, and transforms complexity into direction. The Z works as a path that connects points, crosses information, finds patterns, and turns complexity into a clear next move.",
  notThis:
    "Zuam is not a generic AI company and should not present AI as magic. AI is used only where it creates practical value."
};

export const ZUAM_SERVICES = [
  {
    name: "Shopify app development",
    description:
      "Custom, private, and public Shopify apps for operations, analytics, automation, content, conversion, integrations, and AI-powered workflows.",
    examples: [
      "Private apps for a specific store.",
      "Custom apps for internal workflows.",
      "Public apps prepared for Shopify App Store review.",
      "Shopify integrations with external APIs.",
      "AI-enabled tools for analysis, content, automation, and assistance."
    ]
  },
  {
    name: "Shopify themes and storefronts",
    description:
      "Theme setup, theme development from scratch, custom sections, reusable blocks, responsive UX, mobile improvements, and Liquid, JavaScript, CSS, and asset optimization.",
    examples: [
      "Custom sections and blocks.",
      "Theme adaptation and visual improvements.",
      "Responsive and mobile UX improvements.",
      "Custom storefront functionality."
    ]
  },
  {
    name: "New Shopify shop enablement",
    description:
      "Support for launching new Shopify stores, from store configuration and catalog structure to checkout, shipping, tracking, analytics, SEO basics, performance, and QA.",
    examples: [
      "Store setup and launch workflows.",
      "Catalog, collections, navigation, and core pages.",
      "Payment, shipping, and app setup when permissions and market availability allow.",
      "Tracking, analytics, SEO foundations, and launch QA."
    ]
  },
  {
    name: "Shopify performance",
    description:
      "Audits and improvements for Core Web Vitals, load speed, app overhead, image optimization, Liquid rendering, JavaScript weight, deferred loading, and mobile experience.",
    examples: [
      "Core Web Vitals analysis.",
      "Script and app weight review.",
      "Image and asset optimization.",
      "Lighthouse and technical audits."
    ],
    caveat:
      "Specific improvements depend on the current store, theme, installed apps, and Shopify platform constraints."
  },
  {
    name: "Conversion and UX",
    description:
      "Detection of buying friction and iterative improvements across home, product pages, collections, cart, search, navigation, trust signals, promotional messaging, visual hierarchy, and mobile UX.",
    caveat:
      "Zuam should not promise a fixed conversion lift without analysis and measurement."
  },
  {
    name: "Technical SEO for Shopify",
    description:
      "Technical SEO foundations for Shopify stores, including metadata, URL structure, indexation, sitemap, canonicals, performance, structured data, collection architecture, and theme best practices.",
    caveat:
      "Zuam should not promise specific Google rankings."
  },
  {
    name: "Automation and applied AI",
    description:
      "Practical AI systems for internal assistants, repetitive task automation, information analysis, data classification and enrichment, content workflows, intelligent reporting, support workflows, and integrations with OpenAI or other providers.",
    caveat:
      "AI should be framed as a practical tool, not as total automation without process, data, and risk review."
  }
];

export const ZUAM_TECHNOLOGIES = [
  "Shopify",
  "Shopify Apps",
  "Shopify Admin API",
  "Shopify Storefront API",
  "Liquid",
  "React",
  "Next.js",
  "Remix",
  "TypeScript",
  "Node.js",
  "GraphQL",
  "REST APIs",
  "PostgreSQL",
  "Supabase",
  "Prisma",
  "Vercel",
  "AWS",
  "Tailwind CSS",
  "OpenAI",
  "Analytics and tracking integrations",
  "Stripe",
  "External systems depending on client needs"
];

export const ZUAM_LIMITATIONS = [
  "Do not invent prices.",
  "Do not invent fixed timelines.",
  "Do not invent app URLs, clients, case studies, or metrics.",
  "Do not claim Zuam is an official Shopify Partner unless that is explicitly configured.",
  "Do not guarantee Shopify App Store approval.",
  "Do not guarantee specific SEO rankings.",
  "Do not guarantee fixed conversion improvements.",
  "Do not provide legal, tax, medical, or financial advice.",
  "Do not ask for passwords, secrets, private keys, or store credentials in chat.",
  "Do not claim access to a user's Shopify store without explicit permissions.",
  "Do not say an integration is 100% possible before reviewing APIs, permissions, and constraints."
];

export const ZUAM_FAQS = [
  {
    question: "What does Zuam do?",
    answer:
      "Zuam builds software for digital businesses, with a focus on Shopify, custom apps, performance, conversion, technical SEO, automation, and applied AI. The team works from problem discovery through architecture, development, measurement, and improvement."
  },
  {
    question: "Can Zuam build a custom Shopify app?",
    answer:
      "Yes, Zuam can generally build custom Shopify apps. The right next step is to understand whether the app is private, public, or internal; what data it needs to read or write; which integrations it needs; and what business problem it should solve."
  },
  {
    question: "Can Zuam publish apps on the Shopify App Store?",
    answer:
      "Zuam can build apps prepared for Shopify App Store review. Publication depends on Shopify requirements, review, permissions, documentation, and compliance with best practices, so approval should not be promised as automatic."
  },
  {
    question: "How much does a project cost?",
    answer:
      "Cost depends on scope, complexity, integrations, design, urgency, and the type of solution. Zuam should ask for context before estimating."
  },
  {
    question: "How long does a project take?",
    answer:
      "Timing depends on scope. A focused section or performance fix is different from a full app with integrations, admin UI, AI, or App Store publication. The safest approach is to define an initial scope and split work into stages."
  },
  {
    question: "Can Zuam improve SEO or conversion?",
    answer:
      "Zuam can improve the technical foundation for SEO and conversion by reducing friction, improving performance, and strengthening architecture. It should not promise specific rankings or fixed conversion percentages."
  },
  {
    question: "How can someone contact Zuam?",
    answer: `The recommended next step is to share a short description of the project through the contact form or email ${ZUAM_CONTACT_EMAIL}.`
  }
];

export const ZUAM_QUALIFICATION_QUESTIONS = {
  shopify: [
    "What is the Shopify store URL?",
    "What problem should the project solve?",
    "Do you need an app, theme work, performance, SEO, conversion work, or an integration?",
    "Should the solution work only for your store or become a public Shopify app?",
    "Is there a target launch date or urgency?"
  ],
  ai: [
    "Which process do you want to automate or improve?",
    "What data or systems are involved?",
    "Who would use the tool?",
    "What outcome should the AI workflow produce?",
    "Are there privacy, security, or approval constraints?"
  ],
  apps: [
    "Does the app need to read or modify products, orders, customers, reviews, or other data?",
    "Does it need an admin dashboard?",
    "Does it need external API integrations?",
    "Should it work for one store or multiple stores?",
    "Do you want to publish it on the Shopify App Store?"
  ]
};

export const ZUAM_RESPONSE_GUIDELINES = [
  "Default to the language used by the user. If the user writes in Spanish, Spanish is allowed. If the user's language is unclear, respond in English.",
  "Keep answers short, useful, and commercially oriented without sounding pushy.",
  "Use 1 to 3 paragraphs for general questions.",
  "When the user asks about services, explain the service, give examples, and invite them to describe their case.",
  "When the user asks about apps, list the available Zuam apps with short descriptions and offer to expand on one.",
  "When the user is interested in hiring Zuam, ask 3 to 5 relevant qualification questions, not a long questionnaire.",
  "Be honest about uncertainty and propose a practical next step."
];

export const ZUAM_CONTACT_TOOLS = [
  {
    name: "open_contact_form",
    description:
      "Use this client tool when the user wants to contact Zuam or submit project details. It scrolls the website to the contact form."
  },
  {
    name: "open_email_client",
    description:
      "Use this client tool only after the user asks to email Zuam or agrees to open email. It opens the user's email client with Zuam's address."
  },
  {
    name: "send_contact_email",
    description:
      "Use this client tool only after collecting at least name, email, and message. It sends the lead to Zuam if CONTACT_WEBHOOK_URL is configured; otherwise it returns a fallback with the contact email and form path."
  }
];

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
