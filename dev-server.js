import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";
import { GitSeeHandler } from "./dist/server/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create the GitSee handler directly (like your external server)
const gitSeeHandler = new GitSeeHandler({
  token: process.env.GITHUB_TOKEN,
  cache: { ttl: 300 },
  visualization: {
    nodeDelay: 1200, // 1.2 seconds between nodes (contributors, files, etc.)
  },
});

// Simple static file server
const mimeTypes = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".woff": "application/font-woff",
  ".ttf": "application/font-ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".otf": "application/font-otf",
  ".wasm": "application/wasm",
};

// Extend the GitSee server to also handle static files
const server = http.createServer(async (req, res) => {
  console.log(`=====> ${req.method} ${req.url}`);

  // Handle GitSee API routes (with URL parameters)
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === "/api/gitsee" && req.method === "POST") {
    // Log URL parameters if present
    if (url.search) {
      console.log(`📝 URL parameters:`, Object.fromEntries(url.searchParams));
    }
    try {
      return await gitSeeHandler.handle(req, res);
    } catch (error) {
      console.error("GitSee API error:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Failed to handle GitSee request" }));
    }
    return;
  }

  // Handle GitSee SSE routes (with URL parameters)
  if (url.pathname.startsWith("/api/gitsee/events/")) {
    const match = url.pathname.match(/\/api\/gitsee\/events\/([^\/]+)\/([^\/]+)/);
    if (match && req.method === "GET") {
      const [, owner, repo] = match;
      console.log(`📡 SSE connection for ${owner}/${repo}`);
      try {
        return await gitSeeHandler.handleEvents(req, res, owner, repo);
      } catch (error) {
        console.error("GitSee SSE error:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Failed to handle SSE connection" }));
      }
    }
    return;
  }

  // Handle static files
  let filePath = req.url === "/" ? "/index.html" : req.url;
  const fullPath = path.join(__dirname, filePath);

  try {
    const data = fs.readFileSync(fullPath);
    const ext = path.extname(fullPath);
    const mimeType = mimeTypes[ext] || "text/plain";

    res.writeHead(200, { "Content-Type": mimeType });
    res.end(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    } else {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Server Error");
    }
  }
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 GitSee dev server running on http://localhost:${PORT}`);
  console.log(
    `📝 Set GITHUB_TOKEN environment variable for full functionality`
  );
  console.log(`🔗 Try: http://localhost:${PORT}/?repo=stakwork/hive`);
});
