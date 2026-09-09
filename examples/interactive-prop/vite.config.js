import { defineConfig } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

// HTTPS so headsets on LAN get a secure context (localhost alone is not enough for http://192.168.x.x).
export default defineConfig({
  // es2022: top-level await for the packaged-GLB probe. Quest Browser is Chromium.
  build: { target: "es2022" },
  plugins: [basicSsl()],
  server: {
    host: true,
    port: 5174,
    https: true,
  },
  preview: {
    host: true,
    port: 4174,
    https: true,
  },
});
