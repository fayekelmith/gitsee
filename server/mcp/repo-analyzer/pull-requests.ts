import { BaseAnalyzer } from "../base.js";
import {
  RepoPullRequest,
  PRReview,
  RecentPRsOptions,
} from "../types.js";

export class PullRequestAnalyzer extends BaseAnalyzer {
  async getRecentPRs(
    owner: string,
    repo: string,
    options: RecentPRsOptions = {}
  ): Promise<RepoPullRequest[]> {
    const {
      days = this.config.defaultDays,
      limit = this.config.defaultLimit,
      state = "all",
      author,
    } = options;

    const prs = await this.paginate<RepoPullRequest>(
      (params: any) => this.octokit.rest.pulls.list({
        owner,
        repo,
        state,
        sort: "updated",
        direction: "desc",
        ...params,
      }),
      limit
    );

    // Filter by date and author if specified
    let filteredPRs = prs;

    if (days) {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      filteredPRs = filteredPRs.filter(pr =>
        new Date(pr.updated_at) > cutoffDate
      );
    }

    if (author) {
      filteredPRs = filteredPRs.filter(pr =>
        pr.user.login.toLowerCase() === author.toLowerCase()
      );
    }

    return filteredPRs;
  }

  async getContributorPRs(
    owner: string,
    repo: string,
    contributor: string,
    limit?: number
  ): Promise<RepoPullRequest[]> {
    return this.getRecentPRs(owner, repo, {
      author: contributor,
      limit,
    });
  }

  async getPRDetails(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<RepoPullRequest & { reviews: PRReview[] }> {
    const [prResponse, reviewsResponse] = await Promise.all([
      this.octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
      }),
      this.octokit.rest.pulls.listReviews({
        owner,
        repo,
        pull_number: prNumber,
      }),
    ]);

    return {
      ...prResponse.data,
      reviews: reviewsResponse.data as PRReview[],
    };
  }

  async getRecentReviews(
    owner: string,
    repo: string,
    days?: number
  ): Promise<PRReview[]> {
    const actualDays = days || this.config.defaultDays || 30;

    // Get recent PRs first
    const prs = await this.getRecentPRs(owner, repo, {
      days: actualDays,
      state: "all",
      limit: 100
    });

    // Get reviews for each PR
    const allReviews: PRReview[] = [];

    await Promise.all(
      prs.map(async (pr) => {
        try {
          const reviews = await this.octokit.rest.pulls.listReviews({
            owner,
            repo,
            pull_number: pr.number,
          });

          const cutoffDate = new Date(Date.now() - actualDays * 24 * 60 * 60 * 1000);
          const recentReviews = reviews.data.filter(review =>
            review.submitted_at && new Date(review.submitted_at) > cutoffDate
          );

          allReviews.push(...(recentReviews as PRReview[]));
        } catch (error) {
          console.warn(`Could not fetch reviews for PR #${pr.number}:`, error);
        }
      })
    );

    return allReviews.sort((a, b) => {
      const aDate = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
      const bDate = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
      return bDate - aDate;
    });
  }
}