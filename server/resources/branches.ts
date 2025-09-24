import { BaseResource } from "./base.js";
import { Branch } from "../types/index.js";
import { RepoAnalyzer } from "../mcp/index.js";

export class BranchesResource extends BaseResource {
  private analyzer: RepoAnalyzer;

  constructor(cache: any, githubToken?: string) {
    super(cache);
    this.analyzer = new RepoAnalyzer({
      githubToken,
    });
  }

  async getBranches(owner: string, repo: string): Promise<Branch[]> {
    // Check cache first
    const cached = await this.getCached<Branch[]>(owner, repo, "branches");
    if (cached) {
      console.log(`💾 Cache hit for branches: ${owner}/${repo}`);
      return cached;
    }

    console.log(`📡 Fetching branches for ${owner}/${repo}...`);

    try {
      const branches = await this.analyzer.getBranches(owner, repo);

      console.log(`🌿 Found ${branches.length} branches`);

      // Cache the result
      this.setCached(owner, repo, "branches", branches);

      return branches as Branch[];
    } catch (error: any) {
      console.error(
        `💥 Error fetching branches for ${owner}/${repo}:`,
        error.message,
      );

      // Check if it's a rate limit error
      if (error.status === 403 || error.message?.includes("rate limit")) {
        console.error(`⏱️  RATE LIMIT HIT for branches!`);
      }

      throw error;
    }
  }
}
