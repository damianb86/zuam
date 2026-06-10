import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./data/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#24384A",
        night: "#385A75",
        mist: "#F1ECE3",
        paper: "#F7F5F1",
        surface: "#FFFFFF",
        sand: "#E7DDC6",
        azure: "#D9EAF7",
        violet: "#4B6F8E",
        lavender: "#D9EAF7",
        slateText: "#657487",
        teal: "#6FA7A0",
        brass: "#E7DDC6"
      },
      boxShadow: {
        soft: "0 14px 40px rgba(36, 56, 74, 0.06)",
        button: "0 14px 30px rgba(75, 111, 142, 0.24)"
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif"
        ]
      }
    }
  },
  plugins: []
};

export default config;
