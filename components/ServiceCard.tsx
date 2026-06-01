import {
  Bot,
  Blocks,
  Gauge,
  LayoutTemplate,
  MousePointerClick,
  Search,
  ShoppingBag,
  Store,
  Workflow
} from "lucide-react";
import type { Service, ServiceIcon } from "@/data/site";

const iconMap: Record<ServiceIcon, typeof Blocks> = {
  shopifyApp: ShoppingBag,
  theme: LayoutTemplate,
  launch: Store,
  custom: Blocks,
  performance: Gauge,
  conversion: MousePointerClick,
  seo: Search,
  automation: Workflow,
  ai: Bot
};

export function ServiceCard({ service }: { service: Service }) {
  const Icon = iconMap[service.icon];

  return (
    <article className="surface-card reveal flex h-full flex-col p-6">
      <div className="mb-6 grid h-12 w-12 place-items-center rounded-[8px] bg-ink text-white">
        <Icon size={22} aria-hidden="true" />
      </div>
      <h3 className="text-xl font-semibold text-ink">{service.title}</h3>
      <p className="mt-3 flex-1 leading-7 text-slateText">{service.description}</p>
    </article>
  );
}
