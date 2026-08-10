/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        risk: {
          low: "#10b981",       // Emerald green
          medium: "#f59e0b",    // Amber
          high: "#f97316",      // Orange
          critical: "#f43f5e"   // Rose red
        },
        dark: {
          bg: "#0b0f17",        // Deep obsidian background
          sidebar: "#111827",   // Slate sidebar
          card: "#1e293b",      // Slate card background
          hover: "#334155",
          border: "#1e293b"
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ping-slow': 'ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite',
      }
    },
  },
  plugins: [],
}
