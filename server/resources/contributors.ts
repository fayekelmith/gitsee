import { BaseResource } from "./base.js";
import { Contributor } from "../types/index.js";
import { RepoAnalyzer } from "../mcp/index.js";

export class ContributorsResource extends BaseResource {
  private analyzer: RepoAnalyzer;

  constructor(cache: any, githubToken?: string) {
    super(cache);
    this.analyzer = new RepoAnalyzer({
      githubToken,
      defaultLimit: 50,
    });
  }

  async getContributors(owner: string, repo: string): Promise<Contributor[]> {
    // Check cache first
    const cached = await this.getCached<Contributor[]>(
      owner,
      repo,
      "contributors",
    );
    if (cached) {
      console.log(`💾 Cache hit for contributors: ${owner}/${repo}`);
      return cached;
    }

    console.log(`📡 Fetching contributors for ${owner}/${repo}...`);

    try {
      const contributors = await this.analyzer.getContributors(owner, repo, 50);

      console.log(`👥 Found ${contributors.length} contributors`);

      // Cache the result
      this.setCached(owner, repo, "contributors", contributors);

      return contributors as Contributor[];
    } catch (error: any) {
      console.error(
        `💥 Error fetching contributors for ${owner}/${repo}:`,
        error.message,
      );

      // Check if it's a rate limit error
      if (error.status === 403 || error.message?.includes("rate limit")) {
        console.error(`⏱️  RATE LIMIT HIT for contributors!`);
      }

      throw error;
    }
  }
}
