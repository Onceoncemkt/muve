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
        once: {
          whitesmoke: "#f2f2f2",
          violet: "#f07df2",
          midnight: "#000326",
          dodger: "#1E64F2",
        },
      },
      fontFamily: {
        brand: ["var(--font-brand)", "var(--font-body)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        card: "var(--shadow-card)",
      },
      spacing: {
        4.5: "1.125rem",
        18: "4.5rem",
      },
    },
  },
  plugins: [],
};
export default config;
