import {
  BrainCircuit,
  Cable,
  ClipboardCheck,
  Code2,
  ShoppingBag,
  Wrench
} from "lucide-react";
import type { Service, ServiceIcon } from "@/data/site";

const iconMap: Record<ServiceIcon, typeof ShoppingBag> = {
  shopifyApp: ShoppingBag,
  shopifyEngineering: Wrench,
  aiCommerce: BrainCircuit,
  integration: Cable,
  webSystem: Code2,
  consulting: ClipboardCheck
};

export function ServiceCard({ service }: { service: Service }) {
  const Icon = iconMap[service.icon];

  return (
    <article className="surface-card reveal flex h-full flex-col p-6 sm:p-7">
      <div className="icon-box mb-5">
        <Icon size={22} aria-hidden="true" />
      </div>
      <h3 className="text-xl font-semibold leading-snug text-ink">{service.title}</h3>
      <p className="mt-3 flex-1 leading-7 text-slateText">{service.description}</p>
    </article>
  );
}
