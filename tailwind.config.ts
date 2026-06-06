import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        cf: {
          newbie: "#808080",
          pupil: "#008000",
          specialist: "#03a89e",
          expert: "#0000ff",
          "candidate-master": "#aa00aa",
          master: "#ff8c00",
          "international-master": "#ff8c00",
          grandmaster: "#ff0000",
        },
        surface: {
          DEFAULT: "#ffffff",
          dark: "#0f0f0f",
          card: "#f7f7f8",
          "card-dark": "#1a1a1e",
          border: "#e5e5e5",
          "border-dark": "#2a2a2e",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
}

export default config
