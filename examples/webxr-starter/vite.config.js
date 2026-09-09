import { defineConfig } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

// HTTPS so headsets on LAN get a secure context (localhost alone is not enough for http://192.168.x.x).
export default defineConfig({
  plugins: [basicSsl()],
  server: {
    host: true,
    port: 5173,
    https: true,
  },
  preview: {
    host: true,
    port: 4173,
    https: true,
  },
});
