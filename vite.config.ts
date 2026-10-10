import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative asset paths, so the build works under any path, e.g. GitHub Pages' /vaatekaappi/.
  base: "./",
  plugins: [react()],
});
