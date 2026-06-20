import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Identidade visual SolicitaFlow
        background: "#FAFAF9",
        surface: "#FFFFFF",
        ink: "#1F2933",
        muted: "#6B7280",
        border: "#E5E7EB",
        bordeaux: {
          DEFAULT: "#7F1D1D",
          dark: "#991B1B",
          hover: "#B91C1C",
        },
        success: "#166534",
        warning: "#B45309",
        danger: "#DC2626",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(31, 41, 51, 0.04), 0 1px 3px 0 rgba(31, 41, 51, 0.06)",
        "card-hover":
          "0 4px 12px -2px rgba(31, 41, 51, 0.08), 0 2px 6px -2px rgba(31, 41, 51, 0.06)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "scale-in": "scale-in 0.15s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
