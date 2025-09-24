import { BaseAnalyzer } from "../base.js";
import {
  RepoBranch,
  RepoStats,
} from "../types.js";

export class RepositoryAnalyzer extends BaseAnalyzer {
  async getRepoInfo(owner: string, repo: string): Promise<any> {
    try {
      const response = await this.octokit.rest.repos.get({ owner, repo });
      return response.data;
    } catch (error: any) {
      console.error(`💥 Error fetching repository info for ${owner}/${repo}:`, error.message);
      throw error;
    }
  }

  async getBranches(
    owner: string,
    repo: string,
    limit?: number
  ): Promise<RepoBranch[]> {
    const branches = await this.paginate<RepoBranch>(
      (params: any) => this.octokit.rest.repos.listBranches({
        owner,
        repo,
        ...params,
      }),
      limit
    );

    return branches;
  }

  async getContributors(
    owner: string,
    repo: string,
    limit?: number
  ): Promise<any[]> {
    const contributors = await this.paginate<any>(
      (params: any) => this.octokit.rest.repos.listContributors({
        owner,
        repo,
        ...params,
      }),
      limit || 50
    );

    return contributors;
  }

  async getRepoStats(owner: string, repo: string): Promise<RepoStats> {
    try {
      // Fetch repository basic info (includes stars and creation date)
      const repoResponse = await this.octokit.rest.repos.get({
        owner,
        repo,
      });

      const repoData = repoResponse.data;

      // Get total PRs count (using advanced search to avoid deprecation)
      const prsResponse = await this.octokit.rest.search.issuesAndPullRequests({
        q: `repo:${owner}/${repo} type:pr`,
        per_page: 1, // We only need the count
      });

      // Get total commits count (approximate from contributors API)
      const contributorsResponse = await this.octokit.rest.repos.listContributors({
        owner,
        repo,
        per_page: 100, // Get up to 100 contributors
      });

      // Sum up all contributions to get approximate total commits
      const totalCommits = contributorsResponse.data.reduce(
        (sum, contributor) => {
          return sum + (contributor.contributions || 0);
        },
        0,
      );

      // Calculate age in years
      const createdDate = new Date(repoData.created_at);
      const now = new Date();
      const ageInYears =
        Math.round(
          ((now.getTime() - createdDate.getTime()) /
            (365.25 * 24 * 60 * 60 * 1000)) *
            10,
        ) / 10; // Round to 1 decimal

      const stats: RepoStats = {
        stars: repoData.stargazers_count,
        totalPRs: prsResponse.data.total_count,
        totalCommits: totalCommits,
        ageInYears: ageInYears,
      };

      return stats;
    } catch (error: any) {
      console.error(`💥 Error fetching stats for ${owner}/${repo}:`, error.message);
      throw error;
    }
  }
}