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
        ink: "#071226",
        night: "#101B3A",
        mist: "#F7F8FC",
        paper: "#FAFAFF",
        violet: "#9B7CFF",
        lavender: "#C9BBFF",
        slateText: "#5D6475",
        teal: "#26B8A6",
        brass: "#B68C3C"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(7, 18, 38, 0.08)",
        button: "0 14px 30px rgba(7, 18, 38, 0.18)"
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
