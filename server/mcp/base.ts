import { Octokit } from "@octokit/rest";

export interface RepoAnalyzerConfig {
  githubToken?: string;
  defaultLimit?: number;
  defaultDays?: number;
}

export abstract class BaseAnalyzer {
  protected octokit: Octokit;
  protected config: RepoAnalyzerConfig;

  constructor(config: RepoAnalyzerConfig = {}) {
    this.config = {
      defaultLimit: 50,
      defaultDays: 30,
      ...config,
    };

    this.octokit = new Octokit({
      auth: config.githubToken,
    });
  }

  protected async paginate<T>(request: any, limit?: number): Promise<T[]> {
    const actualLimit = limit || this.config.defaultLimit || 50;

    if (actualLimit <= 100) {
      // Single request
      const response = await request({ per_page: actualLimit });
      return response.data;
    }

    // Multiple requests needed
    const results: T[] = [];
    let page = 1;
    const perPage = 100;

    while (results.length < actualLimit) {
      const remaining = actualLimit - results.length;
      const requestSize = Math.min(perPage, remaining);

      const response = await request({
        per_page: requestSize,
        page,
      });

      if (response.data.length === 0) break;

      results.push(...response.data);
      page++;
    }

    return results.slice(0, actualLimit);
  }
}
