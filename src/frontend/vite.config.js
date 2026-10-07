// Vite build/dev-server configuration for the Cortex frontend.
// The React plugin enables JSX and fast refresh during development.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
