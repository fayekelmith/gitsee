import { BaseResource } from "./base.js";
import { Repository } from "../types/index.js";

export class RepositoryResource extends BaseResource {
  async getRepoInfo(owner: string, repo: string): Promise<Repository> {
    // Check cache first
    const cached = await this.getCached<Repository>(owner, repo, "repo");
    if (cached) {
      console.log(`💾 Cache hit for repo info: ${owner}/${repo}`);
      return cached;
    }

    console.log(`📡 Fetching repository info for ${owner}/${repo}...`);

    try {
      const response = await this.octokit.rest.repos.get({ owner, repo });
      const repoData = response.data as Repository;

      console.log(`📋 Repository info loaded: ${repoData.full_name}`);

      // Cache the result
      this.setCached(owner, repo, "repo", repoData);

      return repoData;
    } catch (error: any) {
      console.error(
        `💥 Error fetching repository info for ${owner}/${repo}:`,
        error.message,
      );

      // Check if it's a rate limit error
      if (error.status === 403 || error.message?.includes("rate limit")) {
        console.error(
          `⏱️  RATE LIMIT HIT for repository! Using token:`,
          !!this.octokit.auth,
        );
      }

      throw error;
    }
  }
}
