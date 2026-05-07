import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        grid: {
          50: "#eefdf7",
          100: "#d5faec",
          500: "#1fc982",
          600: "#13a96b",
          900: "#083527"
        }
      }
    }
  },
  plugins: [],
};

export default config;