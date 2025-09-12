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
    const cached = await this.getCached(
      owner,
      repo,
      "contributors"
    );
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
      console.error(
        `\u{1F4A5} Error fetching contributors for ${owner}/${repo}:`,
        error.message
      );
      if (error.status === 403 || error.message?.includes("rate limit")) {
        console.error(
          `\u23F1\uFE0F  RATE LIMIT HIT for contributors! Using token:`,
          !!this.octokit.auth
        );
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
      console.error(
        `\u{1F4A5} Error fetching repository info for ${owner}/${repo}:`,
        error.message
      );
      if (error.status === 403 || error.message?.includes("rate limit")) {
        console.error(
          `\u23F1\uFE0F  RATE LIMIT HIT for repository! Using token:`,
          !!this.octokit.auth
        );
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
      console.error(
        `\u{1F4A5} Error fetching commits for ${owner}/${repo}:`,
        error.message
      );
      if (error.status === 403 || error.message?.includes("rate limit")) {
        console.error(
          `\u23F1\uFE0F  RATE LIMIT HIT for commits! Using token:`,
          !!this.octokit.auth
        );
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
      console.error(
        `\u{1F4A5} Error fetching branches for ${owner}/${repo}:`,
        error.message
      );
      if (error.status === 403 || error.message?.includes("rate limit")) {
        console.error(
          `\u23F1\uFE0F  RATE LIMIT HIT for branches! Using token:`,
          !!this.octokit.auth
        );
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
      { name: "prisma/schema.prisma", type: "data" },
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

// server/resources/stats.ts
var StatsResource = class extends BaseResource {
  async getRepoStats(owner, repo) {
    const cached = await this.getCached(owner, repo, "stats");
    if (cached) {
      console.log("\u{1F4CA} Using cached stats data");
      return cached;
    }
    console.log(`\u{1F50D} Fetching stats for ${owner}/${repo}...`);
    try {
      const repoResponse = await this.octokit.rest.repos.get({
        owner,
        repo
      });
      const repoData = repoResponse.data;
      const prsResponse = await this.octokit.rest.search.issuesAndPullRequests({
        q: `repo:${owner}/${repo} type:pr`,
        per_page: 1
        // We only need the count
      });
      const contributorsResponse = await this.octokit.rest.repos.listContributors({
        owner,
        repo,
        per_page: 100
        // Get up to 100 contributors
      });
      const totalCommits = contributorsResponse.data.reduce((sum, contributor) => {
        return sum + (contributor.contributions || 0);
      }, 0);
      const createdDate = new Date(repoData.created_at);
      const now = /* @__PURE__ */ new Date();
      const ageInYears = Math.round((now.getTime() - createdDate.getTime()) / (365.25 * 24 * 60 * 60 * 1e3) * 10) / 10;
      const stats = {
        stars: repoData.stargazers_count,
        totalPRs: prsResponse.data.total_count,
        totalCommits,
        ageInYears
      };
      console.log(`\u{1F4CA} Stats for ${owner}/${repo}:`, {
        stars: stats.stars,
        totalPRs: stats.totalPRs,
        totalCommits: stats.totalCommits,
        ageInYears: stats.ageInYears
      });
      this.setCached(owner, repo, "stats", stats);
      return stats;
    } catch (error) {
      console.error(`\u{1F4A5} Error fetching stats for ${owner}/${repo}:`, error.message);
      if (error.status === 403 || error.message?.includes("rate limit")) {
        console.error(`\u23F1\uFE0F  RATE LIMIT HIT for stats! Using token:`, !!this.octokit.auth);
      }
      throw error;
    }
  }
};

// server/agentic/repo-cloner.ts
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
var RepoCloner = class {
  /**
   * Clone a repository in the background (fire-and-forget)
   */
  static async cloneInBackground(owner, repo) {
    this.cloneRepo(owner, repo).catch((error) => {
      console.error(`\u{1F6A8} Background clone failed for ${owner}/${repo}:`, error.message);
    });
  }
  /**
   * Clone a repository to /tmp/gitsee/{owner}/{repo}
   */
  static async cloneRepo(owner, repo) {
    const startTime = Date.now();
    const repoPath = path.join(this.BASE_PATH, owner, repo);
    const githubUrl = `https://github.com/${owner}/${repo}.git`;
    console.log(`\u{1F4E5} Starting clone of ${owner}/${repo} to ${repoPath}`);
    try {
      if (fs.existsSync(repoPath)) {
        console.log(`\u{1F4C2} Repository ${owner}/${repo} already exists at ${repoPath}`);
        return {
          success: true,
          path: repoPath,
          duration: Date.now() - startTime
        };
      }
      const parentDir = path.dirname(repoPath);
      fs.mkdirSync(parentDir, { recursive: true });
      const result = await this.executeGitClone(githubUrl, repoPath);
      const duration = Date.now() - startTime;
      if (result.success) {
        console.log(`\u2705 Successfully cloned ${owner}/${repo} in ${duration}ms`);
        return {
          success: true,
          path: repoPath,
          duration
        };
      } else {
        console.error(`\u274C Failed to clone ${owner}/${repo}:`, result.error);
        return {
          success: false,
          path: repoPath,
          error: result.error,
          duration
        };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`\u{1F4A5} Clone error for ${owner}/${repo}:`, error.message);
      return {
        success: false,
        path: repoPath,
        error: error.message,
        duration
      };
    }
  }
  /**
   * Execute git clone command with shallow clone and single branch
   */
  static executeGitClone(githubUrl, targetPath) {
    return new Promise((resolve) => {
      const gitProcess = spawn("git", [
        "clone",
        "--depth",
        "1",
        // Shallow clone (only latest commit)
        "--single-branch",
        // Only clone the default branch
        "--no-tags",
        // Skip tags for speed
        githubUrl,
        targetPath
      ]);
      let errorOutput = "";
      gitProcess.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });
      gitProcess.stdout.on("data", (data) => {
        const output = data.toString();
        if (output.includes("Cloning") || output.includes("Receiving")) {
          console.log(`\u{1F4E5} ${output.trim()}`);
        }
      });
      gitProcess.on("close", (code) => {
        if (code === 0) {
          resolve({ success: true });
        } else {
          resolve({
            success: false,
            error: errorOutput || `Git clone exited with code ${code}`
          });
        }
      });
      gitProcess.on("error", (error) => {
        resolve({
          success: false,
          error: `Failed to start git process: ${error.message}`
        });
      });
    });
  }
  /**
   * Check if a repository is already cloned
   */
  static isRepoCloned(owner, repo) {
    const repoPath = path.join(this.BASE_PATH, owner, repo);
    return fs.existsSync(repoPath) && fs.existsSync(path.join(repoPath, ".git"));
  }
  /**
   * Get the local path for a repository
   */
  static getRepoPath(owner, repo) {
    return path.join(this.BASE_PATH, owner, repo);
  }
  /**
   * Clean up old repositories (optional utility)
   */
  static async cleanupOldRepos(maxAgeHours = 24) {
    try {
      if (!fs.existsSync(this.BASE_PATH)) {
        return;
      }
      const cutoffTime = Date.now() - maxAgeHours * 60 * 60 * 1e3;
      const owners = fs.readdirSync(this.BASE_PATH);
      for (const owner of owners) {
        const ownerPath = path.join(this.BASE_PATH, owner);
        if (!fs.statSync(ownerPath).isDirectory()) continue;
        const repos = fs.readdirSync(ownerPath);
        for (const repo of repos) {
          const repoPath = path.join(ownerPath, repo);
          const stats = fs.statSync(repoPath);
          if (stats.isDirectory() && stats.mtime.getTime() < cutoffTime) {
            console.log(`\u{1F5D1}\uFE0F Cleaning up old repo: ${owner}/${repo}`);
            fs.rmSync(repoPath, { recursive: true, force: true });
          }
        }
      }
    } catch (error) {
      console.error("Error cleaning up old repos:", error.message);
    }
  }
};
RepoCloner.BASE_PATH = "/tmp/gitsee";

// server/agentic/explore.ts
import { generateText, tool, hasToolCall } from "ai";
import { getModel, getApiKeyForProvider } from "aieo";

// server/agentic/prompts.ts
var GENERAL_EXPLORER = `
You are a codebase exploration assistant. Use the provided tools to explore the codebase and answer the user's question. Focus on general language and framework first, then specific core libraries, integrations, and features. Try to understand the core functionallity (user stories) of the codebase. Explore files, functions, and component names to understand the main user stories, pages, UX components, or workflows in the application.
`;
var GENERAL_FINAL_ANSWER_DESCRIPTION = `

Provide the final answer to the user. YOU **MUST** CALL THIS TOOL AT THE END OF YOUR EXPLORATION.

Return a simple JSON object with the following fields:

- "summary": a 1-4 sentence short synopsis of the codebase.
- "key_files": an array of the core package and LLM agent files. Focus on package files like package.json, and core markdown files. DO NOT include code files unless they are central to the codebase, such as the main DB schema file.
- "features": an array of about 20 core user stories or pages, 1-4 words each. Each one should be focused on ONE SINGLE user action... DO NOT flesh these out for not reason!! Keep them short and to the point BUT SPECIFIC, NOT GENERAL! For example "Github Integration" and "Google Oauth Login" are separate, not one "Integrations".

{
  "summary": "This is a next.js project with a postgres database and a github oauth implementation",
  "key_files": ["package.json", "README.md", "CLAUDE.md", "AGENTS.md", "schema.prisma"],
  "features": ["Authentication", "User Journeys page", "Payments","Admin Dashboard", "Notifications", "User Profile", "Settings page", "Data Visualization", "Github Integration", "File Uploads", "Search Functionality", "Real-time Collaboration Tools", "Activity Logs", "Billing and Subscription Management", "Help and Support"]
}
`;

// server/agentic/explore.ts
import { z } from "zod";

// server/agentic/tools.ts
import { spawn as spawn2 } from "child_process";
import * as fs2 from "fs";
import * as path2 from "path";
function execCommand(command, cwd, timeoutMs = 1e4) {
  return new Promise((resolve, reject) => {
    const parts = command.split(" ");
    const rgIndex = parts.findIndex(
      (part) => part === "rg" || part.endsWith("/rg")
    );
    if (rgIndex === -1) {
      reject(new Error("Not a ripgrep command"));
      return;
    }
    const args = parts.slice(rgIndex + 1).map((arg) => {
      if (arg.startsWith('"') && arg.endsWith('"') || arg.startsWith("'") && arg.endsWith("'")) {
        return arg.slice(1, -1);
      }
      return arg;
    });
    args.push("./");
    const process2 = spawn2("rg", args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        process2.kill("SIGKILL");
        resolved = true;
        reject(new Error(`Command timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);
    process2.stdout.on("data", (data) => {
      stdout += data.toString();
      if (stdout.length > 1e4) {
        process2.kill("SIGKILL");
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          const truncated = stdout.substring(0, 1e4) + "\n\n[... output truncated due to size limit ...]";
          resolve(truncated);
        }
        return;
      }
    });
    process2.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    process2.on("close", (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        if (code === 0) {
          if (stdout.length > 1e4) {
            const truncated = stdout.substring(0, 1e4) + "\n\n[... output truncated to 10,000 characters ...]";
            resolve(truncated);
          } else {
            resolve(stdout);
          }
        } else if (code === 1) {
          resolve("No matches found");
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      }
    });
    process2.on("error", (error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(error);
      }
    });
  });
}
async function getRepoMap(repoPath) {
  if (!repoPath) {
    return "No repository path provided";
  }
  if (!fs2.existsSync(repoPath)) {
    return "Repository not cloned yet";
  }
  try {
    const result = await execCommand(
      "git ls-tree -r --name-only HEAD | tree -L 3 --fromfile",
      repoPath
    );
    return result;
  } catch (error) {
    return `Error getting repo map: ${error.message}`;
  }
}
function getFileSummary(filePath, repoPath) {
  if (!repoPath) {
    return "No repository path provided";
  }
  const fullPath = path2.join(repoPath, filePath);
  if (!fs2.existsSync(fullPath)) {
    return "File not found";
  }
  try {
    const content = fs2.readFileSync(fullPath, "utf-8");
    const lines = content.split("\n").slice(0, 40).map((line) => {
      return line.length > 200 ? line.substring(0, 200) + "..." : line;
    });
    return lines.join("\n");
  } catch (error) {
    return `Error reading file: ${error.message}`;
  }
}
async function fulltextSearch(query, repoPath) {
  if (!repoPath) {
    return "No repository path provided";
  }
  if (!fs2.existsSync(repoPath)) {
    return "Repository not cloned yet";
  }
  try {
    const result = await execCommand(
      `rg --glob '!dist' --ignore-file .gitignore -C 2 -n --max-count 10 --max-columns 200 "${query}"`,
      repoPath,
      5e3
    );
    if (result.length > 1e4) {
      return result.substring(0, 1e4) + "\n\n[... output truncated to 10,000 characters ...]";
    }
    return result;
  } catch (error) {
    if (error.message.includes("code 1")) {
      return `No matches found for "${query}"`;
    }
    return `Error searching: ${error.message}`;
  }
}

// server/agentic/explore.ts
function logStep(contents) {
  if (!Array.isArray(contents)) return;
  for (const content of contents) {
    if (content.type === "tool-call" && content.toolName !== "final_answer") {
      console.log("TOOL CALL:", content.toolName, ":", content.input);
    }
  }
}
async function get_context(prompt, repoPath) {
  const startTime = Date.now();
  const provider = process.env.LLM_PROVIDER || "anthropic";
  const apiKey = getApiKeyForProvider(provider);
  const model = await getModel(provider, apiKey);
  const tools = {
    repo_overview: tool({
      description: "Get a high-level view of the codebase architecture and structure. Use this to understand the project layout and identify where specific functionality might be located. Call this when you need to: 1) Orient yourself in an unfamiliar codebase, 2) Locate which directories/files might contain relevant code for a user's question, 3) Understand the overall project structure before diving deeper. Don't call this if you already know which specific files you need to examine.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          return await getRepoMap(repoPath);
        } catch (e) {
          return "Could not retrieve repository map";
        }
      }
    }),
    file_summary: tool({
      description: "Get a summary of what a specific file contains and its role in the codebase. Use this when you have identified a potentially relevant file and need to understand: 1) What functions/components it exports, 2) What its main responsibility is, 3) Whether it's worth exploring further for the user's question. The first 40 lines of the file will be returned. Call this with a hypothesis like 'This file probably handles user authentication' or 'This looks like the main dashboard component'. Don't call this to browse random files.",
      inputSchema: z.object({
        file_path: z.string().describe("Path to the file to summarize"),
        hypothesis: z.string().describe(
          "What you think this file might contain or handle, based on its name/location"
        )
      }),
      execute: async ({ file_path }) => {
        try {
          return getFileSummary(file_path, repoPath);
        } catch (e) {
          return "Bad file path";
        }
      }
    }),
    fulltext_search: tool({
      description: `Search the entire codebase for a specific term. Use this when you need to find a specific function, component, or file. Call this when the user provided specific text that might be present in the codebase. For example, if the query is 'Add a subtitle to the User Journeys page', you could call this with the query "User Journeys". Don't call this if you do not have specific text to search for`,
      inputSchema: z.object({
        query: z.string().describe("The term to search for")
      }),
      execute: async ({ query }) => {
        try {
          return await fulltextSearch(query, repoPath);
        } catch (e) {
          return `Search failed: ${e}`;
        }
      }
    }),
    final_answer: tool({
      // The tool that signals the end of the process
      description: GENERAL_FINAL_ANSWER_DESCRIPTION,
      inputSchema: z.object({ answer: z.string() }),
      execute: async ({ answer }) => answer
    })
  };
  const { steps } = await generateText({
    model,
    tools,
    prompt,
    system: GENERAL_EXPLORER,
    stopWhen: hasToolCall("final_answer"),
    onStepFinish: (sf) => logStep(sf.content)
  });
  let final = "";
  let lastText = "";
  for (const step of steps) {
    for (const item of step.content) {
      if (item.type === "text" && item.text && item.text.trim().length > 0) {
        lastText = item.text.trim();
      }
    }
  }
  steps.reverse();
  for (const step of steps) {
    const final_answer = step.content.find((c) => {
      return c.type === "tool-result" && c.toolName === "final_answer";
    });
    if (final_answer) {
      final = final_answer.output;
    }
  }
  if (!final && lastText) {
    console.warn(
      "No final_answer tool call detected; falling back to last reasoning text."
    );
    final = `${lastText}

(Note: Model did not invoke final_answer tool; using last reasoning text as answer.)`;
  }
  const endTime = Date.now();
  const duration = endTime - startTime;
  console.log(
    `\u23F1\uFE0F get_context completed in ${duration}ms (${(duration / 1e3).toFixed(2)}s)`
  );
  return final;
}
setTimeout(() => {
  get_context(
    "What are the key features of this codebase?",
    "/Users/evanfeenstra/code/sphinx2/hive"
  ).then((result) => {
    console.log("Context:", result);
  });
});

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
    this.stats = new StatsResource(this.octokit, this.cache);
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
    console.log(`\u{1F504} Starting background clone for ${owner}/${repo}...`);
    RepoCloner.cloneInBackground(owner, repo);
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
    console.log(
      `\u{1F50D} Processing request for ${owner}/${repo} with data: [${data.join(", ")}]`
    );
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
            response.contributors = await this.contributors.getContributors(
              owner,
              repo
            );
            console.log(
              `\u{1F465} Contributors result: ${response.contributors?.length || 0} found`
            );
            break;
          case "icon":
            console.log(`\u{1F50D} Fetching icon for ${owner}/${repo}...`);
            response.icon = await this.icons.getRepoIcon(owner, repo);
            console.log(
              `\u{1F4F7} Icon result:`,
              response.icon ? "Found" : "Not found"
            );
            break;
          case "commits":
            console.log(`\u{1F50D} Fetching commits for ${owner}/${repo}...`);
            response.commits = await this.commits.getCommits(owner, repo);
            console.log(
              `\u{1F4DD} Commits result: ${response.commits?.length || 0} found`
            );
            break;
          case "branches":
            console.log(`\u{1F50D} Fetching branches for ${owner}/${repo}...`);
            response.branches = await this.branches.getBranches(owner, repo);
            console.log(
              `\u{1F33F} Branches result: ${response.branches?.length || 0} found`
            );
            break;
          case "files":
            console.log(`\u{1F50D} Fetching key files for ${owner}/${repo}...`);
            response.files = await this.files.getKeyFiles(owner, repo);
            console.log(
              `\u{1F4C1} Files result: ${response.files?.length || 0} found`
            );
            break;
          case "stats":
            console.log(`\u{1F50D} Fetching stats for ${owner}/${repo}...`);
            response.stats = await this.stats.getRepoStats(owner, repo);
            console.log(
              `\u{1F4CA} Stats result: ${response.stats?.stars} stars, ${response.stats?.totalPRs} PRs, ${response.stats?.totalCommits} commits, ${response.stats?.ageInYears}y old`
            );
            break;
          default:
            console.warn(`\u26A0\uFE0F  Unknown data type: ${dataType}`);
        }
      } catch (error) {
        console.error(
          `\u{1F4A5} Error processing ${dataType} for ${owner}/${repo}:`,
          error
        );
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