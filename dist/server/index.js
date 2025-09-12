// server/handler.ts
import { Octokit } from "@octokit/rest";

// server/utils/cache.ts
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

// server/resources/base.ts
var BaseResource = class {
  constructor(octokit, cache) {
    this.octokit = octokit;
    this.cache = cache;
  }
  getCacheKey(owner, repo, type) {
    return `${type}:${owner}/${repo}`;
  }
  async getCached(owner, repo, type) {
    const cacheKey = this.getCacheKey(owner, repo, type);
    return this.cache.get(cacheKey);
  }
  setCached(owner, repo, type, data) {
    const cacheKey = this.getCacheKey(owner, repo, type);
    this.cache.set(cacheKey, data);
  }
};

// server/resources/contributors.ts
var ContributorsResource = class extends BaseResource {
  async getContributors(owner, repo) {
    const cached = await this.getCached(owner, repo, "contributors");
    if (cached) {
      console.log(`\u{1F4BE} Cache hit for contributors: ${owner}/${repo}`);
      return cached;
    }
    console.log(`\u{1F4E1} Fetching contributors for ${owner}/${repo}...`);
    try {
      const response = await this.octokit.rest.repos.listContributors({
        owner,
        repo,
        per_page: 50
      });
      const contributors = response.data;
      console.log(`\u{1F465} Found ${contributors.length} contributors`);
      this.setCached(owner, repo, "contributors", contributors);
      return contributors;
    } catch (error) {
      console.error(`\u{1F4A5} Error fetching contributors for ${owner}/${repo}:`, error.message);
      if (error.status === 403 || error.message?.includes("rate limit")) {
        console.error(`\u23F1\uFE0F  RATE LIMIT HIT for contributors! Using token:`, !!this.octokit.auth);
      }
      throw error;
    }
  }
};

// server/resources/icons.ts
var IconsResource = class extends BaseResource {
  async getRepoIcon(owner, repo) {
    const cached = await this.getCached(owner, repo, "icon");
    if (cached !== void 0) {
      console.log(
        `\u{1F4BE} Cache hit for ${owner}/${repo} icon:`,
        cached ? "Found" : "Not found"
      );
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
        this.setCached(owner, repo, "icon", null);
        return null;
      }
      console.log(`\u{1F4C2} Found ${rootContents.data.length} files in root`);
      const iconFiles = rootContents.data.filter((file) => {
        const name = file.name.toLowerCase();
        const isIcon = name.includes("favicon") || name.includes("logo") || name.includes("icon") || name.startsWith("apple-touch") && name.includes("icon");
        if (isIcon) {
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
          console.log(`\u{1F4C2} Checking ${subdir}/ directory...`);
          try {
            const subdirContents = await this.octokit.rest.repos.getContent({
              owner,
              repo,
              path: subdir
            });
            if (Array.isArray(subdirContents.data)) {
              const subdirIcons = subdirContents.data.filter((file) => {
                const name = file.name.toLowerCase();
                const isIcon = name.includes("favicon") || name.includes("logo") || name.includes("icon");
                if (isIcon) {
                }
                return isIcon;
              });
              iconFiles.push(
                ...subdirIcons.map((f) => ({
                  ...f,
                  path: `${subdir}/${f.name}`
                }))
              );
            }
          } catch (error) {
            console.log(`\u26A0\uFE0F  Could not access ${subdir}/ directory`);
            continue;
          }
        }
      }
      console.log(`\u{1F4CA} Total icon files found: ${iconFiles.length}`);
      const sortedIcons = this.sortIconsByResolution(iconFiles);
      for (const iconFile of sortedIcons) {
        const filePath = iconFile.path || iconFile.name;
        console.log(`\u{1F4E5} Attempting to fetch: ${filePath}`);
        try {
          const iconResponse = await this.octokit.rest.repos.getContent({
            owner,
            repo,
            path: filePath
          });
          if ("content" in iconResponse.data && iconResponse.data.content) {
            const iconData = `data:image/png;base64,${iconResponse.data.content}`;
            console.log(`\u2705 Successfully loaded icon: ${filePath}`);
            console.log(`\u{1F4CA} Icon data length: ${iconData.length} chars`);
            this.setCached(owner, repo, "icon", iconData);
            return iconData;
          } else {
            console.log(`\u274C No content in response for: ${filePath}`);
          }
        } catch (error) {
          console.log(`\u274C Failed to load: ${filePath}`);
          continue;
        }
      }
      console.log("\u274C No icons could be loaded");
      this.setCached(owner, repo, "icon", null);
      return null;
    } catch (error) {
      console.error(`\u{1F4A5} ERROR fetching repo icon for ${owner}/${repo}:`, error);
      if (error.status === 403 || error.message?.includes("rate limit")) {
        console.error(`\u23F1\uFE0F  RATE LIMIT HIT! Error:`, error.message);
        console.error(`\u{1F511} Using token:`, !!this.octokit.auth);
      }
      this.setCached(owner, repo, "icon", null);
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

// server/resources/repository.ts
var RepositoryResource = class extends BaseResource {
  async getRepoInfo(owner, repo) {
    const cached = await this.getCached(owner, repo, "repo");
    if (cached) {
      console.log(`\u{1F4BE} Cache hit for repo info: ${owner}/${repo}`);
      return cached;
    }
    console.log(`\u{1F4E1} Fetching repository info for ${owner}/${repo}...`);
    try {
      const response = await this.octokit.rest.repos.get({ owner, repo });
      const repoData = response.data;
      console.log(`\u{1F4CB} Repository info loaded: ${repoData.full_name}`);
      this.setCached(owner, repo, "repo", repoData);
      return repoData;
    } catch (error) {
      console.error(`\u{1F4A5} Error fetching repository info for ${owner}/${repo}:`, error.message);
      if (error.status === 403 || error.message?.includes("rate limit")) {
        console.error(`\u23F1\uFE0F  RATE LIMIT HIT for repository! Using token:`, !!this.octokit.auth);
      }
      throw error;
    }
  }
};

// server/resources/commits.ts
var CommitsResource = class extends BaseResource {
  async getCommits(owner, repo) {
    const cached = await this.getCached(owner, repo, "commits");
    if (cached) {
      console.log(`\u{1F4BE} Cache hit for commits: ${owner}/${repo}`);
      return cached;
    }
    console.log(`\u{1F4E1} Fetching commits for ${owner}/${repo}...`);
    try {
      const response = await this.octokit.rest.repos.listCommits({
        owner,
        repo,
        per_page: 50
      });
      const commits = response.data;
      console.log(`\u{1F4DD} Found ${commits.length} commits`);
      this.setCached(owner, repo, "commits", commits);
      return commits;
    } catch (error) {
      console.error(`\u{1F4A5} Error fetching commits for ${owner}/${repo}:`, error.message);
      if (error.status === 403 || error.message?.includes("rate limit")) {
        console.error(`\u23F1\uFE0F  RATE LIMIT HIT for commits! Using token:`, !!this.octokit.auth);
      }
      throw error;
    }
  }
};

// server/resources/branches.ts
var BranchesResource = class extends BaseResource {
  async getBranches(owner, repo) {
    const cached = await this.getCached(owner, repo, "branches");
    if (cached) {
      console.log(`\u{1F4BE} Cache hit for branches: ${owner}/${repo}`);
      return cached;
    }
    console.log(`\u{1F4E1} Fetching branches for ${owner}/${repo}...`);
    try {
      const response = await this.octokit.rest.repos.listBranches({
        owner,
        repo
      });
      const branches = response.data;
      console.log(`\u{1F33F} Found ${branches.length} branches`);
      this.setCached(owner, repo, "branches", branches);
      return branches;
    } catch (error) {
      console.error(`\u{1F4A5} Error fetching branches for ${owner}/${repo}:`, error.message);
      if (error.status === 403 || error.message?.includes("rate limit")) {
        console.error(`\u23F1\uFE0F  RATE LIMIT HIT for branches! Using token:`, !!this.octokit.auth);
      }
      throw error;
    }
  }
};

// server/resources/files.ts
var FilesResource = class extends BaseResource {
  async getKeyFiles(owner, repo) {
    const cached = await this.getCached(owner, repo, "files");
    if (cached) {
      console.log("\u{1F4C1} Using cached files data");
      return cached;
    }
    console.log(`\u{1F50D} Fetching key files for ${owner}/${repo}...`);
    const candidateFiles = [
      // Package managers
      { name: "package.json", type: "package" },
      { name: "Cargo.toml", type: "package" },
      { name: "go.mod", type: "package" },
      { name: "setup.py", type: "package" },
      { name: "requirements.txt", type: "package" },
      { name: "pyproject.toml", type: "package" },
      { name: "pom.xml", type: "package" },
      { name: "build.gradle", type: "package" },
      { name: "build.gradle.kts", type: "package" },
      { name: "composer.json", type: "package" },
      { name: "Gemfile", type: "package" },
      { name: "pubspec.yaml", type: "package" },
      // Documentation
      { name: "README.md", type: "docs" },
      { name: "readme.md", type: "docs" },
      { name: "README.txt", type: "docs" },
      { name: "README.rst", type: "docs" },
      { name: "ARCHITECTURE.md", type: "docs" },
      { name: "CONTRIBUTING.md", type: "docs" },
      { name: "ROADMAP.md", type: "docs" },
      { name: "API.md", type: "docs" },
      { name: "CLAUDE.md", type: "docs" },
      { name: "AGENTS.md", type: "docs" },
      // Configuration files
      { name: ".env.example", type: "config" },
      // Database & schemas
      { name: "schema.prisma", type: "data" },
      { name: "schema.sql", type: "data" },
      { name: "migrations.sql", type: "data" },
      { name: "seeds.sql", type: "data" },
      // Docker & deployment
      { name: "Dockerfile", type: "build" },
      { name: "docker-compose.yml", type: "build" },
      { name: "docker-compose.yaml", type: "build" },
      { name: "Makefile", type: "build" },
      { name: "justfile", type: "build" },
      { name: "CMakeLists.txt", type: "build" },
      // Other important files
      { name: "LICENSE", type: "other" },
      { name: "LICENSE.md", type: "other" },
      { name: "LICENSE.txt", type: "other" },
      { name: ".gitignore", type: "other" },
      { name: ".gitattributes", type: "other" },
      { name: "CODEOWNERS", type: "other" },
      { name: ".github/CODEOWNERS", type: "other" }
    ];
    const foundFiles = [];
    const fileCheckPromises = candidateFiles.map(async (candidate) => {
      try {
        await this.octokit.repos.getContent({
          owner,
          repo,
          path: candidate.name
        });
        console.log(`\u2705 Found file: ${candidate.name}`);
        return {
          name: candidate.name,
          path: candidate.name,
          type: candidate.type
        };
      } catch (error) {
        if (error.status !== 404) {
          console.warn(`\u26A0\uFE0F Error checking ${candidate.name}:`, error.message);
        }
        return null;
      }
    });
    const results = await Promise.all(fileCheckPromises);
    foundFiles.push(...results.filter((file) => file !== null));
    console.log(`\u{1F4C1} Found ${foundFiles.length} key files in ${owner}/${repo}`);
    this.setCached(owner, repo, "files", foundFiles);
    return foundFiles;
  }
};

// server/handler.ts
var GitSeeHandler = class {
  constructor(options = {}) {
    this.options = options;
    this.octokit = new Octokit({
      auth: options.token
    });
    this.cache = new GitSeeCache(options.cache?.ttl);
    this.contributors = new ContributorsResource(this.octokit, this.cache);
    this.icons = new IconsResource(this.octokit, this.cache);
    this.repository = new RepositoryResource(this.octokit, this.cache);
    this.commits = new CommitsResource(this.octokit, this.cache);
    this.branches = new BranchesResource(this.octokit, this.cache);
    this.files = new FilesResource(this.octokit, this.cache);
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
      res.end(JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error"
      }));
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
    if (this.options.visualization) {
      response.options = {
        nodeDelay: this.options.visualization.nodeDelay || 800
      };
    } else {
      response.options = {
        nodeDelay: 800
      };
    }
    if (!owner || !repo) {
      throw new Error("Owner and repo are required");
    }
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Data array is required and must not be empty");
    }
    console.log(`\u{1F50D} Processing request for ${owner}/${repo} with data: [${data.join(", ")}]`);
    for (const dataType of data) {
      try {
        switch (dataType) {
          case "repo_info":
            console.log(`\u{1F50D} Fetching repository info for ${owner}/${repo}...`);
            response.repo = await this.repository.getRepoInfo(owner, repo);
            console.log(`\u{1F4CB} Repository info result: Found`);
            break;
          case "contributors":
            console.log(`\u{1F50D} Fetching contributors for ${owner}/${repo}...`);
            response.contributors = await this.contributors.getContributors(owner, repo);
            console.log(`\u{1F465} Contributors result: ${response.contributors?.length || 0} found`);
            break;
          case "icon":
            console.log(`\u{1F50D} Fetching icon for ${owner}/${repo}...`);
            response.icon = await this.icons.getRepoIcon(owner, repo);
            console.log(`\u{1F4F7} Icon result:`, response.icon ? "Found" : "Not found");
            break;
          case "commits":
            console.log(`\u{1F50D} Fetching commits for ${owner}/${repo}...`);
            response.commits = await this.commits.getCommits(owner, repo);
            console.log(`\u{1F4DD} Commits result: ${response.commits?.length || 0} found`);
            break;
          case "branches":
            console.log(`\u{1F50D} Fetching branches for ${owner}/${repo}...`);
            response.branches = await this.branches.getBranches(owner, repo);
            console.log(`\u{1F33F} Branches result: ${response.branches?.length || 0} found`);
            break;
          case "files":
            console.log(`\u{1F50D} Fetching key files for ${owner}/${repo}...`);
            response.files = await this.files.getKeyFiles(owner, repo);
            console.log(`\u{1F4C1} Files result: ${response.files?.length || 0} found`);
            break;
          default:
            console.warn(`\u26A0\uFE0F  Unknown data type: ${dataType}`);
        }
      } catch (error) {
        console.error(`\u{1F4A5} Error processing ${dataType} for ${owner}/${repo}:`, error);
      }
    }
    return response;
  }
};
function createGitSeeHandler(options = {}) {
  const handler = new GitSeeHandler(options);
  return (req, res) => handler.handle(req, res);
}
export {
  BaseResource,
  BranchesResource,
  CommitsResource,
  ContributorsResource,
  GitSeeCache,
  GitSeeHandler,
  IconsResource,
  RepositoryResource,
  createGitSeeHandler
};
//# sourceMappingURL=index.js.map