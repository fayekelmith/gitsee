// server/index.ts
import { Octokit } from "@octokit/rest";
var GitSeeCache = class {
  constructor(ttl = 300) {
    this.cache = /* @__PURE__ */ new Map();
    this.ttl = ttl * 1e3;
  }
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }
  set(key, data) {
    this.cache.set(key, {
      data,
      expires: Date.now() + this.ttl
    });
  }
  clear() {
    this.cache.clear();
  }
};
var GitSeeHandler = class {
  constructor(options = {}) {
    this.octokit = new Octokit({
      auth: options.token
    });
    this.cache = new GitSeeCache(options.cache?.ttl);
  }
  async handle(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }
    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }
    try {
      const body = await this.parseRequestBody(req);
      const request = JSON.parse(body);
      const response = await this.processRequest(request);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(response));
    } catch (error) {
      console.error("GitSee handler error:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Internal server error"
        })
      );
    }
  }
  async parseRequestBody(req) {
    return new Promise((resolve, reject) => {
      let body = "";
      req.on("data", (chunk) => body += chunk);
      req.on("end", () => resolve(body));
      req.on("error", reject);
    });
  }
  async processRequest(request) {
    const { owner, repo, data } = request;
    const response = {};
    if (!owner || !repo) {
      throw new Error("Owner and repo are required");
    }
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Data array is required and must not be empty");
    }
    for (const dataType of data) {
      switch (dataType) {
        case "repo_info":
          response.repo = await this.getRepoInfo(owner, repo);
          break;
        case "contributors":
          response.contributors = await this.getContributors(owner, repo);
          break;
        case "icon":
          console.log(`\u{1F50D} Fetching icon for ${owner}/${repo}...`);
          response.icon = await this.getRepoIcon(owner, repo);
          console.log(`\u{1F4F7} Icon result:`, response.icon ? "Found" : "Not found");
          break;
        case "commits":
          response.commits = await this.getCommits(owner, repo);
          break;
        case "branches":
          response.branches = await this.getBranches(owner, repo);
          break;
        default:
          console.warn(`Unknown data type: ${dataType}`);
      }
    }
    return response;
  }
  async getRepoInfo(owner, repo) {
    const cacheKey = `repo:${owner}/${repo}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;
    const response = await this.octokit.rest.repos.get({ owner, repo });
    const data = response.data;
    this.cache.set(cacheKey, data);
    return data;
  }
  async getContributors(owner, repo) {
    const cacheKey = `contributors:${owner}/${repo}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;
    const response = await this.octokit.rest.repos.listContributors({
      owner,
      repo,
      per_page: 50
    });
    const data = response.data;
    this.cache.set(cacheKey, data);
    return data;
  }
  async getCommits(owner, repo) {
    const cacheKey = `commits:${owner}/${repo}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;
    const response = await this.octokit.rest.repos.listCommits({
      owner,
      repo,
      per_page: 50
    });
    const data = response.data;
    this.cache.set(cacheKey, data);
    return data;
  }
  async getBranches(owner, repo) {
    const cacheKey = `branches:${owner}/${repo}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;
    const response = await this.octokit.rest.repos.listBranches({
      owner,
      repo
    });
    const data = response.data;
    this.cache.set(cacheKey, data);
    return data;
  }
  async getRepoIcon(owner, repo) {
    const cacheKey = `icon:${owner}/${repo}`;
    const cached = this.cache.get(cacheKey);
    if (cached !== void 0) {
      console.log(`\u{1F4BE} Cache hit for ${owner}/${repo} icon:`, cached ? "Found" : "Not found");
      console.log(`\u{1F504} Clearing cache to retry (checking for rate limits)...`);
      this.cache.clear();
    }
    console.log(`\u{1F680} Starting fresh icon fetch for ${owner}/${repo}`);
    try {
      console.log(`\u{1F4C1} Getting root contents for ${owner}/${repo}...`);
      const rootContents = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path: ""
      });
      if (!Array.isArray(rootContents.data)) {
        console.log(`\u274C Root contents not an array`);
        this.cache.set(cacheKey, null);
        return null;
      }
      console.log(`\u{1F4C2} Found ${rootContents.data.length} files in root`);
      console.log(`\u{1F4C2} Root files:`, rootContents.data.map((f) => f.name).slice(0, 10));
      const iconFiles = rootContents.data.filter((file) => {
        const name = file.name.toLowerCase();
        const isIcon = name.includes("favicon") || name.includes("logo") || name.includes("icon") || name.startsWith("apple-touch") && name.includes("icon");
        if (isIcon) {
          console.log(`\u{1F3AF} Found potential icon in root: ${file.name}`);
        }
        return isIcon;
      });
      console.log(`\u{1F4CA} Found ${iconFiles.length} icon files in root`);
      const subdirs = ["public", "assets", "static", "images", "img"];
      for (const subdir of subdirs) {
        const subdirExists = rootContents.data.find(
          (item) => item.name === subdir && item.type === "dir"
        );
        if (subdirExists) {
          try {
            const subdirContents = await this.octokit.rest.repos.getContent({
              owner,
              repo,
              path: subdir
            });
            if (Array.isArray(subdirContents.data)) {
              const subdirIcons = subdirContents.data.filter((file) => {
                const name = file.name.toLowerCase();
                return name.includes("favicon") || name.includes("logo") || name.includes("icon");
              });
              iconFiles.push(
                ...subdirIcons.map((f) => ({
                  ...f,
                  path: `${subdir}/${f.name}`
                }))
              );
            }
          } catch (error) {
            continue;
          }
        }
      }
      const sortedIcons = this.sortIconsByResolution(iconFiles);
      for (const iconFile of sortedIcons) {
        try {
          const iconResponse = await this.octokit.rest.repos.getContent({
            owner,
            repo,
            path: iconFile.path || iconFile.name
          });
          if ("content" in iconResponse.data && iconResponse.data.content) {
            const iconData = `data:image/png;base64,${iconResponse.data.content}`;
            this.cache.set(cacheKey, iconData);
            return iconData;
          }
        } catch (error) {
          continue;
        }
      }
      this.cache.set(cacheKey, null);
      return null;
    } catch (error) {
      console.error(`\u{1F4A5} ERROR fetching repo icon for ${owner}/${repo}:`, error);
      if (error.status === 403 || error.message?.includes("rate limit")) {
        console.error(`\u23F1\uFE0F  RATE LIMIT HIT! Error:`, error.message);
        console.error(`\u{1F511} Using token:`, !!this.octokit.auth);
      }
      this.cache.set(cacheKey, null);
      return null;
    }
  }
  sortIconsByResolution(iconFiles) {
    return iconFiles.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const getResolution = (name) => {
        const match = name.match(/(\d+)x\d+/);
        if (match) return parseInt(match[1]);
        if (name.includes("512")) return 512;
        if (name.includes("256")) return 256;
        if (name.includes("192")) return 192;
        if (name.includes("180")) return 180;
        if (name.includes("apple-touch")) return 180;
        if (name.includes("android-chrome")) return 192;
        if (name === "favicon.ico") return 64;
        if (name.includes("logo")) return 100;
        return 50;
      };
      return getResolution(bName) - getResolution(aName);
    });
  }
};
function createGitSeeHandler(options = {}) {
  const handler = new GitSeeHandler(options);
  return (req, res) => handler.handle(req, res);
}
export {
  GitSeeHandler,
  createGitSeeHandler
};
//# sourceMappingURL=index.js.map