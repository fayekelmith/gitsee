import { BaseAnalyzer } from "../base.js";
import {
  RepoCommit,
  ContributorFile,
  RecentCommitsOptions,
} from "../types.js";

export class CommitAnalyzer extends BaseAnalyzer {
  async getRecentCommits(
    owner: string,
    repo: string,
    options: RecentCommitsOptions = {}
  ): Promise<RepoCommit[]> {
    const {
      days = this.config.defaultDays,
      limit = this.config.defaultLimit,
      author,
      since,
      until,
    } = options;

    const sinceDate = since || (days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString() : undefined);

    const commits = await this.paginate<RepoCommit>(
      (params: any) => this.octokit.rest.repos.listCommits({
        owner,
        repo,
        author,
        since: sinceDate,
        until,
        ...params,
      }),
      limit
    );

    return commits;
  }

  async getRecentCommitsWithFiles(
    owner: string,
    repo: string,
    options: RecentCommitsOptions = {}
  ): Promise<RepoCommit[]> {
    const commits = await this.getRecentCommits(owner, repo, options);

    // Fetch detailed commit info including files for each commit
    const detailedCommits = await Promise.all(
      commits.map(async (commit) => {
        try {
          const detailedCommit = await this.octokit.rest.repos.getCommit({
            owner,
            repo,
            ref: commit.sha,
          });

          return {
            ...commit,
            files: detailedCommit.data.files || [],
          };
        } catch (error) {
          // If we can't get detailed info, return commit without files
          console.warn(`Could not fetch files for commit ${commit.sha}:`, error);
          return commit;
        }
      })
    );

    return detailedCommits;
  }

  async getContributorCommits(
    owner: string,
    repo: string,
    contributor: string,
    limit?: number
  ): Promise<RepoCommit[]> {
    return this.getRecentCommits(owner, repo, {
      author: contributor,
      limit,
    });
  }

  async getContributorFiles(
    owner: string,
    repo: string,
    contributor: string,
    limit?: number
  ): Promise<ContributorFile[]> {
    // Get commits with file details
    const commits = await this.getRecentCommitsWithFiles(owner, repo, {
      author: contributor,
      limit: limit || 100, // Get more commits to analyze file patterns
    });

    // Count file modifications
    const fileMap = new Map<string, { count: number; lastModified: string }>();

    commits.forEach(commit => {
      if (commit.files) {
        commit.files.forEach(file => {
          const existing = fileMap.get(file.filename);
          if (!existing || commit.commit.author.date > existing.lastModified) {
            fileMap.set(file.filename, {
              count: (existing?.count || 0) + 1,
              lastModified: commit.commit.author.date,
            });
          }
        });
      }
    });

    // Convert to array and sort by modification count
    const files: ContributorFile[] = Array.from(fileMap.entries())
      .map(([filename, data]) => ({
        filename,
        modifications: data.count,
        lastModified: data.lastModified,
      }))
      .sort((a, b) => b.modifications - a.modifications);

    return limit ? files.slice(0, limit) : files;
  }
}