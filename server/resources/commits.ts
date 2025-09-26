import { BaseResource } from "./base.js";
import { Commit } from "../types/index.js";
import { RepoAnalyzer } from "../github/index.js";

export class CommitsResource extends BaseResource {
  private analyzer: RepoAnalyzer;

  constructor(cache: any, githubToken?: string) {
    super(cache);
    this.analyzer = new RepoAnalyzer({
      githubToken,
      defaultLimit: 50,
    });
  }

  async getCommits(owner: string, repo: string): Promise<string> {
    // Check cache first
    const cached = await this.getCached<string>(owner, repo, "commits");
    if (cached) {
      console.log(`💾 Cache hit for commits: ${owner}/${repo}`);
      return cached;
    }

    console.log(`📡 Fetching commits for ${owner}/${repo}...`);

    try {
      const commits = await this.analyzer.getRecentCommits(owner, repo, {
        limit: 50,
      });

      console.log(`📝 Commits fetched successfully`);

      // Cache the result
      this.setCached(owner, repo, "commits", commits);

      return commits;
    } catch (error: any) {
      console.error(
        `💥 Error fetching commits for ${owner}/${repo}:`,
        error.message
      );

      // Check if it's a rate limit error
      if (error.status === 403 || error.message?.includes("rate limit")) {
        console.error(`⏱️  RATE LIMIT HIT for commits!`);
      }

      throw error;
    }
  }
}
