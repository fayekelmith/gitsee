import { BaseResource } from "./base.js";
import { RepoStats } from "../types/index.js";

export class StatsResource extends BaseResource {
  async getRepoStats(owner: string, repo: string): Promise<RepoStats> {
    // Check cache first
    const cached = await this.getCached<RepoStats>(owner, repo, "stats");
    if (cached) {
      console.log('📊 Using cached stats data');
      return cached;
    }

    console.log(`🔍 Fetching stats for ${owner}/${repo}...`);

    try {
      // Fetch repository basic info (includes stars and creation date)
      const repoResponse = await this.octokit.rest.repos.get({
        owner,
        repo
      });

      const repoData = repoResponse.data;
      
      // Get total PRs count
      const prsResponse = await this.octokit.rest.search.issuesAndPullRequests({
        q: `repo:${owner}/${repo} type:pr`,
        per_page: 1 // We only need the count
      });

      // Get total commits count (approximate from contributors API which is faster than paginating all commits)
      const contributorsResponse = await this.octokit.rest.repos.listContributors({
        owner,
        repo,
        per_page: 100 // Get up to 100 contributors
      });

      // Sum up all contributions to get approximate total commits
      const totalCommits = contributorsResponse.data.reduce((sum, contributor) => {
        return sum + (contributor.contributions || 0);
      }, 0);

      // Calculate age in years
      const createdDate = new Date(repoData.created_at);
      const now = new Date();
      const ageInYears = Math.round((now.getTime() - createdDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000) * 10) / 10; // Round to 1 decimal

      const stats: RepoStats = {
        stars: repoData.stargazers_count,
        totalPRs: prsResponse.data.total_count,
        totalCommits: totalCommits,
        ageInYears: ageInYears
      };

      console.log(`📊 Stats for ${owner}/${repo}:`, {
        stars: stats.stars,
        totalPRs: stats.totalPRs,
        totalCommits: stats.totalCommits,
        ageInYears: stats.ageInYears
      });

      // Cache the results
      this.setCached(owner, repo, "stats", stats);

      return stats;
    } catch (error: any) {
      console.error(`💥 Error fetching stats for ${owner}/${repo}:`, error.message);
      
      // Check if it's a rate limit error
      if (error.status === 403 || error.message?.includes("rate limit")) {
        console.error(`⏱️  RATE LIMIT HIT for stats! Using token:`, !!this.octokit.auth);
      }
      
      throw error;
    }
  }
}