import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Build independente (sem Lovable). O nitro detecta o provedor automaticamente
// (Vercel define VERCEL=1); para outro destino use NITRO_PRESET (ex.: node-server).
export default defineConfig(async ({ command }) => {
  const plugins = [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({ server: { entry: "server" } }),
    viteReact(),
  ];
  if (command === "build") {
    const { nitro } = await import("nitro/vite");
    plugins.push(nitro());
  }
  return {
    server: { port: 8080 },
    resolve: { dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-start"] },
    plugins,
  };
});
