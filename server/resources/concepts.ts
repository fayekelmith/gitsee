import { BaseResource } from "./base.js";

export interface RepoConcepts {
  infrastructure: string;
  dependencies: string;
  user_stories: string;
  pages: string;
}

export class ConceptResource extends BaseResource {
  async getConcepts(owner: string, repo: string): Promise<RepoConcepts> {
    // Check cache first
    const cached = await this.getCached<RepoConcepts>(owner, repo, "concepts");
    if (cached) {
      console.log("🔮 Using cached concept data");
      return cached;
    }

    console.log(`🔍 Generating concepts for ${owner}/${repo}...`);

    try {
      // For now, provide default concept data
      // In the future, this could analyze the repository to determine concepts
      const concepts: RepoConcepts = {
        infrastructure: "Infrastructure",
        dependencies: "Dependencies",
        user_stories: "User Stories",
        pages: "Pages",
      };

      console.log(`🔮 Concepts for ${owner}/${repo}:`, concepts);

      // Cache the results
      this.setCached(owner, repo, "concepts", concepts);

      return concepts;
    } catch (error: any) {
      console.error(
        `💥 Error generating concepts for ${owner}/${repo}:`,
        error.message,
      );
      throw error;
    }
  }
}