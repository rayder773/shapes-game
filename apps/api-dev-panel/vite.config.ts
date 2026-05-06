import { defineConfig } from "vite";

export default defineConfig({
  server: {
    proxy: {
      "/analytics": "http://127.0.0.1:8787",
      "/dev/api": "http://127.0.0.1:8787",
    },
  },
});
