import { BaseResource } from "./base.js";
import { RepoStats } from "../types/index.js";
import { RepoAnalyzer } from "../mcp/index.js";

export class StatsResource extends BaseResource {
  private analyzer: RepoAnalyzer;

  constructor(cache: any, githubToken?: string) {
    super(cache);
    this.analyzer = new RepoAnalyzer({
      githubToken,
    });
  }

  async getRepoStats(owner: string, repo: string): Promise<RepoStats> {
    // Check cache first
    const cached = await this.getCached<RepoStats>(owner, repo, "stats");
    if (cached) {
      console.log("📊 Using cached stats data");
      return cached;
    }

    console.log(`🔍 Fetching stats for ${owner}/${repo}...`);

    try {
      const stats = await this.analyzer.getRepoStats(owner, repo);

      console.log(`📊 Stats for ${owner}/${repo}:`, {
        stars: stats.stars,
        totalPRs: stats.totalPRs,
        totalCommits: stats.totalCommits,
        ageInYears: stats.ageInYears,
      });

      // Cache the results
      this.setCached(owner, repo, "stats", stats);

      return stats;
    } catch (error: any) {
      console.error(
        `💥 Error fetching stats for ${owner}/${repo}:`,
        error.message,
      );

      // Check if it's a rate limit error
      if (error.status === 403 || error.message?.includes("rate limit")) {
        console.error(`⏱️  RATE LIMIT HIT for stats!`);
      }

      throw error;
    }
  }
}
