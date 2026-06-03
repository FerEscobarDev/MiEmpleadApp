import type { Config } from "tailwindcss";

// Design System de MiEmpleadApp codificado como tema de Tailwind.
// Fuente: docs/03-ux-ui/design_system.md §2. Los colores semánticos se respaldan
// con variables CSS (globals.css) para conmutar entre modo claro y oscuro; los
// colores del calendario y neutrales mantienen su tono (ajustados en .dark).
const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/features/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Marca y semánticos (respaldados por variables CSS para dark mode).
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          hover: "hsl(var(--primary-hover) / <alpha-value>)",
          soft: "hsl(var(--primary-soft) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
          "50": "#F0FDFA",
          "500": "#0D9488",
          "600": "#0F766E",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
          "500": "#475569",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
          "500": "#F59E0B",
        },
        success: "hsl(var(--success) / <alpha-value>)",
        warning: "hsl(var(--warning) / <alpha-value>)",
        error: "hsl(var(--error) / <alpha-value>)",
        info: "hsl(var(--info) / <alpha-value>)",
        // Superficies y texto semánticos (conmutan en dark).
        background: "hsl(var(--background) / <alpha-value>)",
        surface: "hsl(var(--surface) / <alpha-value>)",
        "surface-muted": "hsl(var(--surface-muted) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        "foreground-muted": "hsl(var(--foreground-muted) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        // Neutrales — escala slate del DS (design_system.md §2.2).
        neutral: {
          "0": "#FFFFFF",
          "50": "#F8FAFC",
          "100": "#F1F5F9",
          "200": "#E2E8F0",
          "400": "#94A3B8",
          "600": "#475569",
          "800": "#1E293B",
          "900": "#0F172A",
        },
        // Colores del calendario (design_system.md §2.3). Cada tipo de día.
        cal: {
          trabajado: "#16A34A",
          inasistencia: "#EA580C",
          festivo: "#7C3AED",
          noLaboral: "#94A3B8",
          fueraContrato: "#E2E8F0",
          itemAdicional: "#DB2777",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        // Escala tipográfica del DS (design_system.md §2.4).
        display: ["30px", { lineHeight: "1.2", fontWeight: "700" }],
        h1: ["24px", { lineHeight: "1.25", fontWeight: "700" }],
        h2: ["20px", { lineHeight: "1.3", fontWeight: "600" }],
        h3: ["17px", { lineHeight: "1.35", fontWeight: "600" }],
        body: ["16px", { lineHeight: "1.5", fontWeight: "400" }],
        caption: ["13px", { lineHeight: "1.4", fontWeight: "500" }],
      },
      spacing: {
        // Spacing del DS (design_system.md §2.5).
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "32px",
        "2xl": "48px",
      },
      borderRadius: {
        // Radios del DS (design_system.md §2.6).
        sm: "6px",
        md: "10px",
        lg: "16px",
        full: "9999px",
      },
      boxShadow: {
        // Sombras del DS, incl. anillo de foco visible con primary (§2.6).
        sm: "0 1px 2px 0 rgb(15 23 42 / 0.08)",
        md: "0 4px 12px -2px rgb(15 23 42 / 0.12)",
        lg: "0 12px 32px -4px rgb(15 23 42 / 0.20)",
        focus: "0 0 0 3px hsl(var(--ring) / 0.45)",
      },
      zIndex: {
        dropdown: "100",
        nav: "200",
        modal: "1000",
        toast: "2000",
        tooltip: "3000",
      },
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
