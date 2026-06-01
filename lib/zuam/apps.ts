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

export const ZUAM_APPS: ZuamApp[] = [
  {
    id: "product-pulse-ai",
    name: "Product Pulse AI",
    shortDescription:
      "Analyzes products in depth to identify problems, opportunities, and practical improvement actions.",
    longDescription:
      "Product Pulse AI is focused on deep product analysis for Shopify catalogs. It helps merchants review product data, spot weak signals, identify why a product may be underperforming, and prioritize actions that can improve commercial performance.",
    tags: [
      "Shopify",
      "AI",
      "Product analytics",
      "Business intelligence",
      "Commercial performance"
    ],
    useCases: [
      "Identify products with potential issues.",
      "Analyze product information and merchandising signals.",
      "Find improvement opportunities across a catalog.",
      "Prioritize product-level actions for e-commerce teams.",
      "Support better decisions with structured product insight."
    ],
    url: "",
    icon: "",
    status: "available-or-in-progress"
  },
  {
    id: "redirect-mapper-lite",
    name: "Redirect Mapper Lite",
    shortDescription:
      "Archives products in bulk, creates associated redirects, and helps manage or undo those changes.",
    longDescription:
      "Redirect Mapper Lite helps Shopify teams retire products in a controlled way. It lets users select products, archive them in bulk, activate associated redirects, undo actions, and manage catalog retirement from a centralized process.",
    tags: [
      "Shopify",
      "Redirects",
      "Bulk actions",
      "Product management",
      "Technical SEO"
    ],
    useCases: [
      "Retire discontinued products.",
      "Archive products in bulk.",
      "Avoid broken product URLs.",
      "Create redirects to preserve traffic and SEO value.",
      "Manage large catalog changes with a clearer workflow."
    ],
    url: "",
    icon: "",
    status: "available-or-in-progress"
  },
  {
    id: "replypilot",
    name: "ReplyPilot",
    shortDescription:
      "Helps teams respond to reviews in bulk with AI while preserving each brand's voice and tone.",
    longDescription:
      "ReplyPilot is designed to accelerate review responses with AI. It can generate responses that respect a company's brand voice, tone, and response rules, helping teams reduce manual work while keeping replies consistent. It is currently framed around review sources such as Jot.me, with room to connect other review systems depending on API availability and permissions.",
    tags: ["Shopify", "AI", "Reviews", "Brand voice", "Automation"],
    useCases: [
      "Reply to many reviews faster.",
      "Maintain consistent brand tone.",
      "Reduce manual work for support or e-commerce teams.",
      "Automate responses according to rules.",
      "Connect review workflows with external systems when APIs allow it."
    ],
    url: "",
    icon: "",
    status: "available-or-in-progress",
    notes: [
      "TODO: confirm the exact review integration name and whether it is Jot.me, Judge.me, or another source."
    ]
  },
  {
    id: "gifmessagebrightlight",
    name: "GifMessageBrightLight",
    shortDescription:
      "Lets customers add personalized gift messages that can be printed and included with an order.",
    longDescription:
      "GifMessageBrightLight lets customers add a personalized gift message to a product or purchase. The message can then be printed with a regular printer and physically included in the product box, improving gifting, personalization, and unboxing experiences.",
    tags: [
      "Shopify",
      "Gift message",
      "Personalization",
      "Fulfillment",
      "Customer experience"
    ],
    useCases: [
      "Gift shops and seasonal campaigns.",
      "Personalized products.",
      "Messages per product or order.",
      "Improved unboxing experiences.",
      "Emotional value added to a purchase."
    ],
    url: "",
    icon: "",
    status: "available-or-in-progress",
    notes: [
      "TODO: confirm whether the final name stays GifMessageBrightLight or changes to GiftMessage BrightLight."
    ]
  }
];
