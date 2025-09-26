import { BaseAnalyzer } from "../base.js";
import { RepoPullRequest, PRReview, RecentPRsOptions } from "../types.js";

export class PullRequestAnalyzer extends BaseAnalyzer {
  async getRecentPRs(
    owner: string,
    repo: string,
    options: RecentPRsOptions = {}
  ): Promise<RepoPullRequest[]> {
    const {
      days = options.days === null
        ? null
        : options.days || this.config.defaultDays,
      limit = this.config.defaultLimit,
      state = "all",
      author,
    } = options;

    const prs = await this.paginate<RepoPullRequest>(
      (params: any) =>
        this.octokit.rest.pulls.list({
          owner,
          repo,
          state,
          sort: "updated",
          direction: "desc",
          ...(author && { creator: author }), // Use GitHub API's creator parameter
          ...params,
        }),
      limit
    );

    // Filter by date and author if specified
    let filteredPRs = prs;

    if (days !== null && days !== undefined) {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      filteredPRs = filteredPRs.filter(
        (pr) => new Date(pr.updated_at) > cutoffDate
      );
    }

    // Author filtering is now handled by the API's creator parameter

    return filteredPRs;
  }

  async getContributorPRs(
    owner: string,
    repo: string,
    contributor: string,
    limit?: number
  ): Promise<string> {
    const prs = await this.getRecentPRs(owner, repo, {
      author: contributor,
      limit: limit || 50,
      days: null, // Get all PRs by this contributor
    });

    // Enhance each PR with comments, reviews, and commits
    const enhancedPRs = await Promise.all(
      prs.map(async (pr) => {
        try {
          const [commentsResponse, reviewsResponse, commitsResponse] =
            await Promise.all([
              // Get issue comments
              this.octokit.rest.issues.listComments({
                owner,
                repo,
                issue_number: pr.number,
              }),
              // Get reviews
              this.octokit.rest.pulls.listReviews({
                owner,
                repo,
                pull_number: pr.number,
              }),
              // Get commits
              this.octokit.rest.pulls.listCommits({
                owner,
                repo,
                pull_number: pr.number,
              }),
            ]);

          return {
            ...pr,
            comments: commentsResponse.data.filter(
              (comment) => !comment.user?.login.includes("[bot]")
            ),
            reviews: reviewsResponse.data.filter(
              (review) => !review.user?.login.includes("[bot]")
            ),
            commits: commitsResponse.data,
          };
        } catch (error) {
          console.warn(`Could not fetch details for PR #${pr.number}:`, error);
          return {
            ...pr,
            comments: [],
            reviews: [],
            commits: [],
          };
        }
      })
    );

    const finalPRs = limit ? enhancedPRs.slice(0, limit) : enhancedPRs;

    // Format as string output
    let output = `\n=== Contributor PRs for ${contributor} in ${owner}/${repo} ===\n\n`;

    for (const pr of finalPRs) {
      output += `📝 PR #${pr.number}: ${pr.title}\n`;
      output += `   Branch: ${pr.head.ref} → ${pr.base.ref}\n`;
      output += `   State: ${pr.state}${pr.merged_at ? " (merged)" : ""}\n`;
      output += `   Created: ${new Date(pr.created_at).toLocaleDateString()}\n`;

      if (pr.body) {
        output += `   Description: ${pr.body.substring(0, 200)}${pr.body.length > 200 ? "..." : ""}\n`;
      }

      // Show comments
      if (pr.comments && pr.comments.length > 0) {
        output += `\n   💬 Comments (${pr.comments.length}):\n`;
        pr.comments.forEach((comment: any, idx: number) => {
          output += `     ${idx + 1}. ${comment.user.login}: ${comment.body.substring(0, 150)}${comment.body.length > 150 ? "..." : ""}\n`;
        });
      }

      // Show reviews
      if (pr.reviews && pr.reviews.length > 0) {
        output += `\n   👀 Reviews (${pr.reviews.length}):\n`;
        pr.reviews.forEach((review: any, idx: number) => {
          output += `     ${idx + 1}. ${review.user.login} (${review.state})\n`;
          if (review.body) {
            output += `        ${review.body.substring(0, 150)}${review.body.length > 150 ? "..." : ""}\n`;
          }
        });
      }

      // Show commits
      if (pr.commits && pr.commits.length > 0) {
        output += `\n   📦 Commits (${pr.commits.length}):\n`;
        pr.commits.forEach((commit: any, idx: number) => {
          output += `     ${idx + 1}. ${commit.commit.message.split("\n")[0]} (${commit.commit.author.name})\n`;
        });
      }

      output += "\n" + "=".repeat(80) + "\n\n";
    }

    return output;
  }

  async getContributorReviews(
    owner: string,
    repo: string,
    reviewer: string,
    limit?: number
  ): Promise<RepoPullRequest[]> {
    // Get recent PRs (more to account for filtering)
    const prs = await this.getRecentPRs(owner, repo, {
      limit: limit ? limit * 3 : 150,
    });

    // Filter PRs that have reviews by this reviewer
    const reviewedPRs: RepoPullRequest[] = [];

    for (const pr of prs) {
      try {
        const reviewsResponse = await this.octokit.rest.pulls.listReviews({
          owner,
          repo,
          pull_number: pr.number,
        });

        const hasReviewByUser = reviewsResponse.data.some(
          (review) =>
            review.user?.login.toLowerCase() === reviewer.toLowerCase() &&
            !review.user?.login.includes("[bot]")
        );

        if (hasReviewByUser) {
          // Enhance this PR with full details
          const [commentsResponse, commitsResponse] = await Promise.all([
            this.octokit.rest.issues.listComments({
              owner,
              repo,
              issue_number: pr.number,
            }),
            this.octokit.rest.pulls.listCommits({
              owner,
              repo,
              pull_number: pr.number,
            }),
          ]);

          reviewedPRs.push({
            ...pr,
            comments: commentsResponse.data.filter(
              (comment) => !comment.user?.login.includes("[bot]")
            ),
            reviews: reviewsResponse.data.filter(
              (review) => !review.user?.login.includes("[bot]")
            ),
            commits: commitsResponse.data,
          });

          if (limit && reviewedPRs.length >= limit) break;
        }
      } catch (error) {
        console.warn(`Could not fetch reviews for PR #${pr.number}:`, error);
      }
    }

    return reviewedPRs;
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
      limit: 100,
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

          const cutoffDate = new Date(
            Date.now() - actualDays * 24 * 60 * 60 * 1000
          );
          const recentReviews = reviews.data.filter(
            (review) =>
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
