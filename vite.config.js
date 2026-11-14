import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the built site works from any static-host path
  // (e.g. a GitHub Pages project page) as well as a custom domain.
  base: "./",
  plugins: [react()],
});
