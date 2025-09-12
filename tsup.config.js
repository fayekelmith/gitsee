import { defineConfig } from "tsup";

export default defineConfig([
  // Server build - bundle all server files
  {
    entry: ["server/index.ts"],
    format: ["esm"],
    outDir: "dist/server",
    external: ["@octokit/rest"], // Keep octokit as external dependency
    dts: true,
    sourcemap: true,
    clean: false,
    splitting: false, // Bundle everything into single file
  },
  // Client build  
  {
    entry: ["client/index.ts"],
    format: ["esm"],
    outDir: "dist",
    noExternal: ["d3", "d3-force", "d3-selection", "d3-zoom"], // Bundle d3 dependencies
    dts: false,
    sourcemap: true,
    clean: true,
    splitting: false,
  }
]);