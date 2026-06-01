import Image from "next/image";

export function DecorativeZ() {
  return (
    <div
      className="hero-panel hero-logo-panel relative min-h-[460px] overflow-hidden rounded-[8px] border border-ink/10 shadow-soft"
      data-visual="interactive-logo"
    >
      <div className="hero-panel-aura pointer-events-none absolute inset-0" />

      <div className="hero-logo-orbit absolute inset-0 grid place-items-center p-10 sm:p-14">
        <div className="hero-logo-pulse relative grid aspect-square w-full max-w-[360px] place-items-center">
          <div className="hero-logo-glow absolute inset-[6%] rounded-full" aria-hidden="true" />
          <Image
            src="/logo.png"
            alt="Zuam logo"
            width={520}
            height={520}
            priority
            className="hero-logo-mark logo-image relative h-full w-full object-contain"
          />
        </div>
      </div>
    </div>
  );
}
