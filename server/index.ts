import { IncomingMessage, ServerResponse } from "http";
import { Octokit } from "@octokit/rest";

interface GitSeeRequest {
  owner: string;
  repo: string;
  data: ("contributors" | "icon" | "repo_info" | "commits" | "branches")[];
}

interface GitSeeResponse {
  repo?: any;
  contributors?: any[];
  icon?: string | null;
  commits?: any[];
  branches?: any[];
  error?: string;
}

interface GitSeeOptions {
  token?: string;
  cache?: {
    ttl?: number; // seconds
  };
}

// Simple in-memory cache
interface CacheEntry {
  data: any;
  expires: number;
}

class GitSeeCache {
  private cache = new Map<string, CacheEntry>();
  private ttl: number;

  constructor(ttl: number = 300) {
    // 5 minutes default
    this.ttl = ttl * 1000; // convert to ms
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key: string, data: any): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + this.ttl,
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

export class GitSeeHandler {
  private octokit: Octokit;
  private cache: GitSeeCache;

  constructor(options: GitSeeOptions = {}) {
    this.octokit = new Octokit({
      auth: options.token,
    });

    this.cache = new GitSeeCache(options.cache?.ttl);
  }

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // Set CORS headers
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
      const request: GitSeeRequest = JSON.parse(body);

      const response = await this.processRequest(request);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(response));
    } catch (error) {
      console.error("GitSee handler error:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error:
            error instanceof Error ? error.message : "Internal server error",
        })
      );
    }
  }

  private async parseRequestBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = "";
      req.on("data", (chunk: any) => (body += chunk));
      req.on("end", () => resolve(body));
      req.on("error", reject);
    });
  }

  private async processRequest(
    request: GitSeeRequest
  ): Promise<GitSeeResponse> {
    const { owner, repo, data } = request;
    const response: GitSeeResponse = {};

    // Validate input
    if (!owner || !repo) {
      throw new Error("Owner and repo are required");
    }

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Data array is required and must not be empty");
    }

    // Process each requested data type
    for (const dataType of data) {
      switch (dataType) {
        case "repo_info":
          response.repo = await this.getRepoInfo(owner, repo);
          break;
        case "contributors":
          response.contributors = await this.getContributors(owner, repo);
          break;
        case "icon":
          console.log(`🔍 Fetching icon for ${owner}/${repo}...`);
          response.icon = await this.getRepoIcon(owner, repo);
          console.log(`📷 Icon result:`, response.icon ? 'Found' : 'Not found');
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

  private async getRepoInfo(owner: string, repo: string): Promise<any> {
    const cacheKey = `repo:${owner}/${repo}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const response = await this.octokit.rest.repos.get({ owner, repo });
    const data = response.data;

    this.cache.set(cacheKey, data);
    return data;
  }

  private async getContributors(owner: string, repo: string): Promise<any[]> {
    const cacheKey = `contributors:${owner}/${repo}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const response = await this.octokit.rest.repos.listContributors({
      owner,
      repo,
      per_page: 50,
    });
    const data = response.data;

    this.cache.set(cacheKey, data);
    return data;
  }

  private async getCommits(owner: string, repo: string): Promise<any[]> {
    const cacheKey = `commits:${owner}/${repo}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const response = await this.octokit.rest.repos.listCommits({
      owner,
      repo,
      per_page: 50,
    });
    const data = response.data;

    this.cache.set(cacheKey, data);
    return data;
  }

  private async getBranches(owner: string, repo: string): Promise<any[]> {
    const cacheKey = `branches:${owner}/${repo}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const response = await this.octokit.rest.repos.listBranches({
      owner,
      repo,
    });
    const data = response.data;

    this.cache.set(cacheKey, data);
    return data;
  }

  private async getRepoIcon(
    owner: string,
    repo: string
  ): Promise<string | null> {
    const cacheKey = `icon:${owner}/${repo}`;
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) {
      console.log(`💾 Cache hit for ${owner}/${repo} icon:`, cached ? 'Found' : 'Not found');
      console.log(`🔄 Clearing cache to retry (checking for rate limits)...`);
      this.cache.clear(); // Clear cache to retry
      // Don't return cached, let it retry
    }
    
    console.log(`🚀 Starting fresh icon fetch for ${owner}/${repo}`);

    try {
      // Get root directory contents
      console.log(`📁 Getting root contents for ${owner}/${repo}...`);
      const rootContents = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path: "",
      });

      if (!Array.isArray(rootContents.data)) {
        console.log(`❌ Root contents not an array`);
        this.cache.set(cacheKey, null);
        return null;
      }

      console.log(`📂 Found ${rootContents.data.length} files in root`);
      console.log(`📂 Root files:`, rootContents.data.map((f: any) => f.name).slice(0, 10));

      // Look for icon files
      const iconFiles = rootContents.data.filter((file: any) => {
        const name = file.name.toLowerCase();
        const isIcon = name.includes("favicon") ||
          name.includes("logo") ||
          name.includes("icon") ||
          (name.startsWith("apple-touch") && name.includes("icon"));
        if (isIcon) {
          console.log(`🎯 Found potential icon in root: ${file.name}`);
        }
        return isIcon;
      });

      console.log(`📊 Found ${iconFiles.length} icon files in root`);

      // Check common subdirectories
      const subdirs = ["public", "assets", "static", "images", "img"];
      for (const subdir of subdirs) {
        const subdirExists = rootContents.data.find(
          (item: any) => item.name === subdir && item.type === "dir"
        );

        if (subdirExists) {
          try {
            const subdirContents = await this.octokit.rest.repos.getContent({
              owner,
              repo,
              path: subdir,
            });

            if (Array.isArray(subdirContents.data)) {
              const subdirIcons = subdirContents.data.filter((file: any) => {
                const name = file.name.toLowerCase();
                return (
                  name.includes("favicon") ||
                  name.includes("logo") ||
                  name.includes("icon")
                );
              });
              iconFiles.push(
                ...subdirIcons.map((f: any) => ({
                  ...f,
                  path: `${subdir}/${f.name}`,
                }))
              );
            }
          } catch (error) {
            // Continue if subdirectory access fails
            continue;
          }
        }
      }

      // Sort by resolution (highest first)
      const sortedIcons = this.sortIconsByResolution(iconFiles);

      // Try to fetch the best icon
      for (const iconFile of sortedIcons) {
        try {
          const iconResponse = await this.octokit.rest.repos.getContent({
            owner,
            repo,
            path: iconFile.path || iconFile.name,
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
    } catch (error: any) {
      console.error(`💥 ERROR fetching repo icon for ${owner}/${repo}:`, error);
      
      // Check if it's a rate limit error
      if (error.status === 403 || error.message?.includes('rate limit')) {
        console.error(`⏱️  RATE LIMIT HIT! Error:`, error.message);
        console.error(`🔑 Using token:`, !!this.octokit.auth);
      }
      
      this.cache.set(cacheKey, null);
      return null;
    }
  }

  private sortIconsByResolution(iconFiles: any[]): any[] {
    return iconFiles.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();

      const getResolution = (name: string) => {
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

      return getResolution(bName) - getResolution(aName); // Higher first
    });
  }
}

// Factory function for easy integration
export function createGitSeeHandler(options: GitSeeOptions = {}) {
  const handler = new GitSeeHandler(options);
  return (req: IncomingMessage, res: ServerResponse) =>
    handler.handle(req, res);
}
