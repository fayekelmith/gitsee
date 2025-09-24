import { BaseResource } from "./base.js";
import { RepoAnalyzer } from "../mcp/index.js";

export class IconsResource extends BaseResource {
  private analyzer: RepoAnalyzer;

  constructor(cache: any, githubToken?: string) {
    super(cache);
    this.analyzer = new RepoAnalyzer({
      githubToken,
    });
  }

  async getRepoIcon(owner: string, repo: string): Promise<string | null> {
    // Check cache first (null is a valid cached value)
    const cached = await this.getCached<string | null>(owner, repo, "icon");
    if (cached !== undefined) {
      console.log(
        `💾 Cache hit for ${owner}/${repo} icon:`,
        cached ? "Found" : "Not found",
      );
      console.log(`🔄 Clearing cache to retry (checking for rate limits)...`);
      this.cache.clear(); // Clear cache to retry
      // Don't return cached, let it retry
    }

    console.log(`🚀 Starting fresh icon fetch for ${owner}/${repo}`);

    try {
      const iconData = await this.analyzer.getRepoIcon(owner, repo);

      if (iconData) {
        console.log(`✅ Successfully loaded icon`);
        console.log(`📊 Icon data length: ${iconData.length} chars`);

        // Cache the result
        this.setCached(owner, repo, "icon", iconData);
        return iconData;
      } else {
        console.log("❌ No icons could be loaded");
        this.setCached(owner, repo, "icon", null);
        return null;
      }
    } catch (error: any) {
      console.error(`💥 ERROR fetching repo icon for ${owner}/${repo}:`, error);

      // Check if it's a rate limit error
      if (error.status === 403 || error.message?.includes("rate limit")) {
        console.error(`⏱️  RATE LIMIT HIT! Error:`, error.message);
      }

      this.setCached(owner, repo, "icon", null);
      return null;
    }
  }
}
