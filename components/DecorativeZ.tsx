import Image from "next/image";

export function DecorativeZ() {
  return (
    <div
      className="hero-panel hero-logo-panel relative min-h-[460px] overflow-hidden rounded-[8px] border border-ink/10 shadow-soft"
      data-visual="interactive-logo"
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(7,18,38,0.07)_1px,transparent_1px)] bg-[length:38px_38px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_22%,rgba(38,184,166,0.16),transparent_30%),radial-gradient(circle_at_76%_28%,rgba(155,124,255,0.18),transparent_30%),radial-gradient(circle_at_50%_78%,rgba(23,185,208,0.14),transparent_34%)]" />

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
