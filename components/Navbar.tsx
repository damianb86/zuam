"use client";

import Image from "next/image";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { navLinks } from "@/data/site";
import { ThemeSwitch } from "@/components/ThemeSwitch";

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-50 transition duration-300 ${
        isScrolled
          ? "border-b border-ink/10 bg-paper/80 shadow-[0_12px_40px_rgba(36,56,74,0.08)] backdrop-blur-xl"
          : "bg-paper/60 backdrop-blur-md"
      }`}
    >
      <div className="section-shell flex h-20 items-center justify-between">
        <a
          href="#home"
          className="flex items-center gap-3 rounded-full focus:outline-none focus:ring-2 focus:ring-violet focus:ring-offset-2"
          aria-label="Zuam home"
          onClick={() => setIsOpen(false)}
        >
          <span className="brand-mark-shell grid h-11 w-11 place-items-center overflow-hidden rounded-full border border-ink/10 bg-white">
            <Image
              src="/logo.png"
              alt="Zuam logo"
              width={40}
              height={40}
              priority
              className="logo-image h-9 w-9 object-contain"
            />
          </span>
          <span className="text-lg font-semibold tracking-wide text-ink">
            Zuam
          </span>
        </a>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-slateText transition hover:bg-white hover:text-ink focus:outline-none focus:ring-2 focus:ring-violet focus:ring-offset-2"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <ThemeSwitch />
          <a href="#contact" className="button-primary">
            Discuss a project
            <ArrowUpRight size={17} aria-hidden="true" />
          </a>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <ThemeSwitch />
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-full border border-ink/10 bg-white text-ink shadow-sm transition hover:border-violet/40 focus:outline-none focus:ring-2 focus:ring-violet focus:ring-offset-2"
            aria-label={isOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={isOpen}
            onClick={() => setIsOpen((value) => !value)}
          >
            {isOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div
        className={`border-t border-ink/10 bg-paper/95 px-5 pb-5 pt-2 shadow-soft backdrop-blur-xl transition lg:hidden ${
          isOpen ? "block" : "hidden"
        }`}
      >
        <nav className="mx-auto flex max-w-7xl flex-col gap-1" aria-label="Mobile navigation">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-[10px] px-4 py-3 text-sm font-semibold text-ink transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-violet focus:ring-offset-2"
              onClick={() => setIsOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <a
            href="#contact"
            className="button-primary mt-3 w-full"
            onClick={() => setIsOpen(false)}
          >
            Discuss a project
            <ArrowUpRight size={17} aria-hidden="true" />
          </a>
        </nav>
      </div>
    </header>
  );
}
