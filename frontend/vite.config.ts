import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// The backend (Person 4) listens on :3000 and allows origin http://localhost:5173.
// Proxying /api keeps the frontend free of hard-coded localhost URLs.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: env.VITE_API_TARGET || "http://localhost:3000",
          changeOrigin: true
        }
      }
    }
  };
});
