import { BaseResource } from "./base.js";
import { Commit } from "../types/index.js";

export class CommitsResource extends BaseResource {
  async getCommits(owner: string, repo: string): Promise<Commit[]> {
    // Check cache first
    const cached = await this.getCached<Commit[]>(owner, repo, "commits");
    if (cached) {
      console.log(`💾 Cache hit for commits: ${owner}/${repo}`);
      return cached;
    }

    console.log(`📡 Fetching commits for ${owner}/${repo}...`);

    try {
      const response = await this.octokit.rest.repos.listCommits({
        owner,
        repo,
        per_page: 50,
      });

      const commits = response.data as Commit[];
      console.log(`📝 Found ${commits.length} commits`);

      // Cache the result
      this.setCached(owner, repo, "commits", commits);

      return commits;
    } catch (error: any) {
      console.error(
        `💥 Error fetching commits for ${owner}/${repo}:`,
        error.message,
      );

      // Check if it's a rate limit error
      if (error.status === 403 || error.message?.includes("rate limit")) {
        console.error(
          `⏱️  RATE LIMIT HIT for commits! Using token:`,
          !!this.octokit.auth,
        );
      }

      throw error;
    }
  }
}
