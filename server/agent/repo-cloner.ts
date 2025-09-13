import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

export interface CloneResult {
  success: boolean;
  path: string;
  error?: string;
  duration?: number;
}

export class RepoCloner {
  private static readonly BASE_PATH = "/tmp/gitsee";

  /**
   * Clone a repository in the background (fire-and-forget)
   */
  static async cloneInBackground(owner: string, repo: string): Promise<void> {
    // Don't await - let it run in background
    this.cloneRepo(owner, repo).catch((error) => {
      console.error(
        `🚨 Background clone failed for ${owner}/${repo}:`,
        error.message,
      );
    });
  }

  /**
   * Clone a repository to /tmp/gitsee/{owner}/{repo}
   */
  static async cloneRepo(owner: string, repo: string): Promise<CloneResult> {
    const startTime = Date.now();
    const repoPath = path.join(this.BASE_PATH, owner, repo);
    const githubUrl = `https://github.com/${owner}/${repo}.git`;

    console.log(`📥 Starting clone of ${owner}/${repo} to ${repoPath}`);

    try {
      // Check if already exists
      if (fs.existsSync(repoPath)) {
        console.log(
          `📂 Repository ${owner}/${repo} already exists at ${repoPath}`,
        );
        return {
          success: true,
          path: repoPath,
          duration: Date.now() - startTime,
        };
      }

      // Ensure parent directory exists
      const parentDir = path.dirname(repoPath);
      fs.mkdirSync(parentDir, { recursive: true });

      // Clone with shallow copy (depth 1) and single branch for speed
      const result = await this.executeGitClone(githubUrl, repoPath);

      const duration = Date.now() - startTime;

      if (result.success) {
        console.log(`✅ Successfully cloned ${owner}/${repo} in ${duration}ms`);
        return {
          success: true,
          path: repoPath,
          duration,
        };
      } else {
        console.error(`❌ Failed to clone ${owner}/${repo}:`, result.error);
        return {
          success: false,
          path: repoPath,
          error: result.error,
          duration,
        };
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`💥 Clone error for ${owner}/${repo}:`, error.message);

      return {
        success: false,
        path: repoPath,
        error: error.message,
        duration,
      };
    }
  }

  /**
   * Execute git clone command with shallow clone and single branch
   */
  private static executeGitClone(
    githubUrl: string,
    targetPath: string,
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      // Use shallow clone with single branch for maximum speed
      const gitProcess = spawn("git", [
        "clone",
        "--depth",
        "1", // Shallow clone (only latest commit)
        "--single-branch", // Only clone the default branch
        "--no-tags", // Skip tags for speed
        githubUrl,
        targetPath,
      ]);

      let errorOutput = "";

      gitProcess.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      gitProcess.stdout.on("data", (data) => {
        // Git clone sends progress to stderr, but we can capture stdout too
        const output = data.toString();
        if (output.includes("Cloning") || output.includes("Receiving")) {
          console.log(`📥 ${output.trim()}`);
        }
      });

      gitProcess.on("close", (code) => {
        if (code === 0) {
          resolve({ success: true });
        } else {
          resolve({
            success: false,
            error: errorOutput || `Git clone exited with code ${code}`,
          });
        }
      });

      gitProcess.on("error", (error) => {
        resolve({
          success: false,
          error: `Failed to start git process: ${error.message}`,
        });
      });
    });
  }

  /**
   * Check if a repository is already cloned
   */
  static isRepoCloned(owner: string, repo: string): boolean {
    const repoPath = path.join(this.BASE_PATH, owner, repo);
    return (
      fs.existsSync(repoPath) && fs.existsSync(path.join(repoPath, ".git"))
    );
  }

  /**
   * Get the local path for a repository
   */
  static getRepoPath(owner: string, repo: string): string {
    return path.join(this.BASE_PATH, owner, repo);
  }

  /**
   * Clean up old repositories (optional utility)
   */
  static async cleanupOldRepos(maxAgeHours: number = 24): Promise<void> {
    try {
      if (!fs.existsSync(this.BASE_PATH)) {
        return;
      }

      const cutoffTime = Date.now() - maxAgeHours * 60 * 60 * 1000;

      // Walk through /tmp/gitsee/{owner}/{repo} directories
      const owners = fs.readdirSync(this.BASE_PATH);

      for (const owner of owners) {
        const ownerPath = path.join(this.BASE_PATH, owner);
        if (!fs.statSync(ownerPath).isDirectory()) continue;

        const repos = fs.readdirSync(ownerPath);

        for (const repo of repos) {
          const repoPath = path.join(ownerPath, repo);
          const stats = fs.statSync(repoPath);

          if (stats.isDirectory() && stats.mtime.getTime() < cutoffTime) {
            console.log(`🗑️ Cleaning up old repo: ${owner}/${repo}`);
            fs.rmSync(repoPath, { recursive: true, force: true });
          }
        }
      }
    } catch (error: any) {
      console.error("Error cleaning up old repos:", error.message);
    }
  }
}
