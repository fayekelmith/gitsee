import { BaseResource } from "./base.js";
import { Contributor } from "../types/index.js";

export class ContributorsResource extends BaseResource {
  async getContributors(owner: string, repo: string): Promise<Contributor[]> {
    // Check cache first
    const cached = await this.getCached<Contributor[]>(owner, repo, 'contributors');
    if (cached) {
      console.log(`💾 Cache hit for contributors: ${owner}/${repo}`);
      return cached;
    }

    console.log(`📡 Fetching contributors for ${owner}/${repo}...`);

    try {
      const response = await this.octokit.rest.repos.listContributors({
        owner,
        repo,
        per_page: 50
      });

      const contributors = response.data as Contributor[];
      console.log(`👥 Found ${contributors.length} contributors`);

      // Cache the result
      this.setCached(owner, repo, 'contributors', contributors);

      return contributors;
    } catch (error: any) {
      console.error(`💥 Error fetching contributors for ${owner}/${repo}:`, error.message);
      
      // Check if it's a rate limit error
      if (error.status === 403 || error.message?.includes('rate limit')) {
        console.error(`⏱️  RATE LIMIT HIT for contributors! Using token:`, !!this.octokit.auth);
      }
      
      throw error;
    }
  }
}