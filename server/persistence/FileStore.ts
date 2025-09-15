import * as fs from "fs";
import * as path from "path";
import {
  GeneralContextResult,
  FirstPassContextResult,
  RepoContextMode,
} from "../agent/index.js";

// Union type for all exploration results
export type ExplorationResult =
  | GeneralContextResult
  | FirstPassContextResult
  | string;

// Stored exploration data with metadata
export interface StoredExploration {
  mode: RepoContextMode;
  result: ExplorationResult;
  timestamp: number;
  owner: string;
  repo: string;
  version: string; // For future schema migrations
}

export class FileStore {
  private dataDir: string;
  private version = "1.0.0";

  constructor(dataDir: string = "./data/repos") {
    this.dataDir = dataDir;
    this.ensureDataDir();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private getRepoDir(owner: string, repo: string): string {
    const repoKey = `${owner}-${repo}`.replace(/[^a-zA-Z0-9-]/g, "_");
    return path.join(this.dataDir, repoKey);
  }

  private ensureRepoDir(owner: string, repo: string): string {
    const repoDir = this.getRepoDir(owner, repo);
    if (!fs.existsSync(repoDir)) {
      fs.mkdirSync(repoDir, { recursive: true });
    }
    return repoDir;
  }

  // Store basic API data (what you already have)
  async storeBasicData(owner: string, repo: string, data: any): Promise<void> {
    const repoDir = this.ensureRepoDir(owner, repo);
    const filePath = path.join(repoDir, "basic.json");

    const enrichedData = {
      ...data,
      stored_at: new Date().toISOString(),
      owner,
      repo,
    };

    fs.writeFileSync(filePath, JSON.stringify(enrichedData, null, 2));
    console.log(`💾 Stored basic data for ${owner}/${repo}`);
  }

  // Store agent exploration results
  async storeExploration(
    owner: string,
    repo: string,
    mode: RepoContextMode,
    result: ExplorationResult
  ): Promise<void> {
    const repoDir = this.ensureRepoDir(owner, repo);
    const filePath = path.join(repoDir, `exploration-${mode}.json`);

    const storedExploration: StoredExploration = {
      mode,
      result,
      timestamp: Date.now(),
      owner,
      repo,
      version: this.version,
    };

    fs.writeFileSync(filePath, JSON.stringify(storedExploration, null, 2));
    console.log(`🔍 Stored ${mode} exploration for ${owner}/${repo}`);
  }

  // Get stored exploration data
  async getExploration(
    owner: string,
    repo: string,
    mode: RepoContextMode
  ): Promise<StoredExploration | null> {
    const repoDir = this.getRepoDir(owner, repo);
    const filePath = path.join(repoDir, `exploration-${mode}.json`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      console.error(`Error reading exploration data: ${error}`);
      return null;
    }
  }

  // Get all exploration data for a repo
  async getAllExplorations(
    owner: string,
    repo: string
  ): Promise<StoredExploration[]> {
    const repoDir = this.getRepoDir(owner, repo);

    if (!fs.existsSync(repoDir)) {
      return [];
    }

    const explorations: StoredExploration[] = [];
    const modes: RepoContextMode[] = ["first_pass", "general"];

    for (const mode of modes) {
      const exploration = await this.getExploration(owner, repo, mode);
      if (exploration) {
        explorations.push(exploration);
      }
    }

    return explorations;
  }

  // Check if we have recent exploration data
  async hasRecentExploration(
    owner: string,
    repo: string,
    mode: RepoContextMode,
    maxAgeHours: number = 24
  ): Promise<boolean> {
    const exploration = await this.getExploration(owner, repo, mode);
    if (!exploration) return false;

    const ageMs = Date.now() - exploration.timestamp;
    const ageHours = ageMs / (1000 * 60 * 60);
    return ageHours < maxAgeHours;
  }

  // Helper to get first_pass data typed correctly
  async getFirstPassExploration(
    owner: string,
    repo: string
  ): Promise<FirstPassContextResult | null> {
    const stored = await this.getExploration(owner, repo, "first_pass");
    return (stored?.result as FirstPassContextResult) || null;
  }

  // Helper to get general exploration data typed correctly
  async getGeneralExploration(
    owner: string,
    repo: string
  ): Promise<GeneralContextResult | null> {
    const stored = await this.getExploration(owner, repo, "general");
    return (stored?.result as GeneralContextResult) || null;
  }

  // List all stored repositories with exploration status
  async listRepos(): Promise<
    Array<{
      owner: string;
      repo: string;
      explorations: {
        first_pass: boolean;
        general: boolean;
      };
      lastExplored?: number;
    }>
  > {
    if (!fs.existsSync(this.dataDir)) {
      return [];
    }

    const repos = [];
    const entries = fs.readdirSync(this.dataDir);

    for (const entry of entries) {
      const parts = entry.split("-");
      if (parts.length >= 2) {
        const owner = parts[0];
        const repo = parts.slice(1).join("-");

        const explorations = await this.getAllExplorations(owner, repo);
        const hasFirstPass = explorations.some((e) => e.mode === "first_pass");
        const hasGeneral = explorations.some((e) => e.mode === "general");

        const lastExplored =
          explorations.length > 0
            ? Math.max(...explorations.map((e) => e.timestamp))
            : undefined;

        repos.push({
          owner,
          repo,
          explorations: {
            first_pass: hasFirstPass,
            general: hasGeneral,
          },
          lastExplored,
        });
      }
    }

    return repos;
  }

  // Clean up old exploration data
  async cleanupOldExplorations(maxAgeHours: number = 24 * 7): Promise<void> {
    const repos = await this.listRepos();
    const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;

    for (const repoInfo of repos) {
      if (repoInfo.lastExplored && repoInfo.lastExplored < cutoff) {
        const repoDir = this.getRepoDir(repoInfo.owner, repoInfo.repo);

        // Only remove exploration files, keep basic data
        const modes: RepoContextMode[] = ["first_pass", "general"];
        for (const mode of modes) {
          const filePath = path.join(repoDir, `exploration-${mode}.json`);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(
              `🧹 Cleaned up old ${mode} exploration for ${repoInfo.owner}/${repoInfo.repo}`
            );
          }
        }
      }
    }
  }
}
