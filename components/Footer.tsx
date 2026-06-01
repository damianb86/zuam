import Image from "next/image";
import { CONTACT_EMAIL, navLinks } from "@/data/site";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-ink py-10 text-white">
      <div className="section-shell">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <a
              href="#home"
              className="inline-flex items-center gap-3 rounded-full focus:outline-none focus:ring-2 focus:ring-lavender focus:ring-offset-2 focus:ring-offset-ink"
              aria-label="Zuam home"
            >
              <span className="brand-mark-shell grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-white">
                <Image
                  src="/logo.png"
                  alt="Zuam logo"
                  width={40}
                  height={40}
                  className="logo-image h-9 w-9 object-contain"
                />
              </span>
              <span className="text-lg font-semibold tracking-wide">Zuam</span>
            </a>
            <p className="mt-4 max-w-sm text-sm leading-6 text-white/70">
              Software, Shopify, and applied intelligence.
            </p>
          </div>

          <div className="flex flex-col gap-5 lg:items-end">
            <nav className="flex flex-wrap gap-3" aria-label="Footer navigation">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="rounded-full px-3 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-lavender focus:ring-offset-2 focus:ring-offset-ink"
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <div className="flex flex-col gap-2 text-sm text-white/60 sm:flex-row sm:gap-5">
              <span>&copy; {year} Zuam. All rights reserved.</span>
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-white transition hover:text-lavender">
                {CONTACT_EMAIL}
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
