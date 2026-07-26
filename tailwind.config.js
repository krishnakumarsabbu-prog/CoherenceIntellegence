/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Single accent: clean mid-blue
        accent: {
          50: "#EEF3FB",
          100: "#D6E2F5",
          200: "#ADC4EB",
          300: "#7FA2DE",
          400: "#4F7FCE",
          500: "#2E5AAC",
          600: "#274D91",
          700: "#1F3D72",
          800: "#172C54",
          900: "#0F1D3A",
        },
        // Neutral canvas grays (off-white base)
        canvas: {
          50: "#F7F8FA",
          100: "#F1F3F6",
          200: "#E5E8ED",
          300: "#D3D8E0",
          400: "#A9B0BD",
          500: "#737B8C",
          600: "#525968",
          700: "#3A3F4B",
          800: "#262A33",
          900: "#161920",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)",
        "card-hover":
          "0 4px 12px rgba(16,24,40,0.08), 0 2px 6px rgba(16,24,40,0.06)",
        nav: "0 1px 0 rgba(16,24,40,0.06)",
      },
    },
  },
  plugins: [],
};
