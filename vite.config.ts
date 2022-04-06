import reactRefresh from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import WindiCSS from "vite-plugin-windicss";

import logseqPlugin from "vite-plugin-logseq";

const reactRefreshPlugin = reactRefresh({
  fastRefresh: false,
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [reactRefreshPlugin, WindiCSS(), logseqPlugin()],
  clearScreen: false,
  build: {
    target: "esnext",
    minify: "esbuild",
  },
});
