import { BaseResource } from "./base.js";
import { RepoAnalyzer, FileInfo, FileContent } from "../mcp/index.js";

export class FilesResource extends BaseResource {
  private analyzer: RepoAnalyzer;

  constructor(cache: any, githubToken?: string) {
    super(cache);
    this.analyzer = new RepoAnalyzer({
      githubToken,
    });
  }

  async getKeyFiles(owner: string, repo: string): Promise<FileInfo[]> {
    // Check cache first
    const cached = await this.getCached<FileInfo[]>(owner, repo, "files");
    if (cached) {
      console.log("📁 Using cached files data");
      return cached;
    }

    console.log(`🔍 Fetching key files for ${owner}/${repo}...`);

    const foundFiles = await this.analyzer.getKeyFiles(owner, repo);

    console.log(`📁 Found ${foundFiles.length} key files in ${owner}/${repo}`);
    foundFiles.forEach(file => console.log(`✅ Found file: ${file.name}`));

    // Cache the results
    this.setCached(owner, repo, "files", foundFiles);

    return foundFiles;
  }

  async getFileContent(
    owner: string,
    repo: string,
    path: string,
  ): Promise<FileContent | null> {
    // Check cache first
    const cacheKey = `file-content-${path}`;
    const cached = await this.getCached<FileContent>(owner, repo, cacheKey);
    if (cached) {
      console.log(`📄 Using cached file content for ${path}`);
      return cached;
    }

    console.log(`> Fetching file content for ${owner}/${repo}:${path}...`);

    const fileContent = await this.analyzer.getFileContent(owner, repo, path);

    if (fileContent) {
      console.log(
        `✅ Retrieved file content for ${path} (${fileContent.size} bytes)`,
      );

      // Cache the results
      this.setCached(owner, repo, cacheKey, fileContent);
    }

    return fileContent;
  }
}
