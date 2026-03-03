import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "fs";
import { resolve } from "path";

const pkg = JSON.parse(readFileSync(resolve(__dirname, "../../package.json"), "utf-8"));

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.APP_VERSION || pkg.version),
  },
  server: {
    port: 3000,
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
});
