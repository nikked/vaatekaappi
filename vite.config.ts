import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset paths, so the build works under any path, e.g. GitHub Pages' /vaatekaappi/.
  base: "./",
  plugins: [react()],
});
