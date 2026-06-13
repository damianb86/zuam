import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Bot,
  BrainCircuit,
  ClipboardCheck,
  DatabaseZap,
  FileText,
  ListChecks,
  LockKeyhole,
  MessageSquareText,
  Network,
  Workflow
} from "lucide-react";
import { aiGroups, type AICardIcon } from "@/data/site";
import { SectionHeading } from "@/components/SectionHeading";

const iconMap: Record<AICardIcon, typeof Bot> = {
  assistant: MessageSquareText,
  language: Bot,
  wizard: ListChecks,
  reviews: FileText,
  catalog: BrainCircuit,
  automation: Workflow,
  systems: DatabaseZap,
  providers: Network,
  control: BadgeCheck,
  context: BookOpenCheck,
  evaluation: ClipboardCheck,
  privacy: LockKeyhole
};

export function AISection() {
  return (
    <section id="ai" aria-labelledby="ai-heading" className="section-padding bg-ink text-white">
      <div className="section-shell">
        <SectionHeading
          id="ai-heading"
          eyebrow="AI-powered Shopify & Applied AI"
          title="AI systems designed around real commerce workflows."
          description="Zuam builds AI-powered tools that connect with your data, workflows, and existing systems - helping teams automate repetitive work, guide users, analyze information, and create better customer experiences without relying on generic chatbot experiences."
          align="center"
          tone="dark"
        />

        <div className="mt-14 space-y-8">
          {aiGroups.map((group) => (
            <div
              key={group.title}
              className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 sm:p-6"
            >
              <h3 className="text-2xl font-semibold text-white">{group.title}</h3>
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {group.cards.map((card) => {
                  const Icon = iconMap[card.icon];

                  return (
                    <article
                      key={card.title}
                      className="reveal flex h-full flex-col rounded-[16px] border border-white/10 bg-white/10 p-5 backdrop-blur transition duration-300 hover:border-white/20 hover:bg-white/[0.13]"
                    >
                      <span className="grid h-11 w-11 place-items-center rounded-[10px] bg-white text-ink">
                        <Icon size={20} aria-hidden="true" />
                      </span>
                      <h4 className="mt-5 text-lg font-semibold text-white">
                        {card.title}
                      </h4>
                      <p className="mt-3 flex-1 leading-7 text-white/70">
                        {card.description}
                      </p>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 grid gap-6 border-t border-white/10 pt-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="max-w-3xl text-lg leading-8 text-white/78">
              AI becomes valuable when it is connected to the actual work your
              team needs to do. Zuam designs AI features around specific
              business outcomes, not generic prompts.
            </p>
            <p className="mt-4 max-w-3xl text-sm font-medium leading-6 text-white/55">
              You can also try the AI assistant on this site to see how Zuam
              thinks about practical AI interfaces.
            </p>
          </div>
          <a href="#contact" className="button-primary bg-white text-ink hover:bg-lavender">
            Discuss an AI workflow
            <ArrowRight size={18} aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}
