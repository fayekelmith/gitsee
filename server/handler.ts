import { IncomingMessage, ServerResponse } from "http";
import { Octokit } from "@octokit/rest";
import { GitSeeCache } from "./utils/cache.js";
import {
  ContributorsResource,
  IconsResource,
  RepositoryResource,
  CommitsResource,
  BranchesResource,
  FilesResource,
  StatsResource,
} from "./resources/index.js";
import { GitSeeRequest, GitSeeResponse, GitSeeOptions } from "./types/index.js";
import { RepoCloner, explore, RepoContextMode } from "./agent/index.js";
import { FileStore } from "./persistence/index.js";

export class GitSeeHandler {
  private octokit: Octokit;
  private cache: GitSeeCache;
  private options: GitSeeOptions;
  private store: FileStore;

  // Resource modules
  private contributors: ContributorsResource;
  private icons: IconsResource;
  private repository: RepositoryResource;
  private commits: CommitsResource;
  private branches: BranchesResource;
  private files: FilesResource;
  private stats: StatsResource;

  constructor(options: GitSeeOptions = {}) {
    this.options = options;
    this.octokit = new Octokit({
      auth: options.token,
    });

    this.cache = new GitSeeCache(options.cache?.ttl);
    this.store = new FileStore();

    // Initialize resource modules
    this.contributors = new ContributorsResource(this.octokit, this.cache);
    this.icons = new IconsResource(this.octokit, this.cache);
    this.repository = new RepositoryResource(this.octokit, this.cache);
    this.commits = new CommitsResource(this.octokit, this.cache);
    this.branches = new BranchesResource(this.octokit, this.cache);
    this.files = new FilesResource(this.octokit, this.cache);
    this.stats = new StatsResource(this.octokit, this.cache);
  }

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // Set CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    try {
      const body = await this.parseRequestBody(req);
      const request: GitSeeRequest = JSON.parse(body);

      const response = await this.processRequest(request);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(response));
    } catch (error) {
      console.error("GitSee handler error:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error:
            error instanceof Error ? error.message : "Internal server error",
        })
      );
    }
  }

  private autoStartFirstPassExploration(owner: string, repo: string): void {
    // Use setImmediate to completely defer this work
    setImmediate(async () => {
      try {
        // Check if we already have recent first_pass exploration
        const hasRecent = await this.store.hasRecentExploration(owner, repo, 'first_pass', 24);

        if (!hasRecent) {
          console.log(`🚀 Auto-starting first_pass exploration for ${owner}/${repo}...`);

          // Fire and forget - don't await, let it run in background
          this.runBackgroundExploration(owner, repo, 'first_pass').catch(error => {
            console.error(`🚨 Background first_pass exploration failed for ${owner}/${repo}:`, error.message);
          });
        } else {
          console.log(`✅ Recent first_pass exploration found for ${owner}/${repo}, skipping auto-start`);
        }
      } catch (error) {
        console.error(`💥 Error checking exploration status for ${owner}/${repo}:`, error);
      }
    });
  }

  private async runBackgroundExploration(
    owner: string,
    repo: string,
    mode: RepoContextMode
  ): Promise<void> {
    try {
      // Wait for repo to be cloned
      await RepoCloner.waitForClone(owner, repo);
      const cloneResult = await RepoCloner.getCloneResult(owner, repo);

      if (cloneResult?.success && cloneResult.localPath) {
        const prompt = mode === 'first_pass'
          ? "Analyze this repository and provide a comprehensive overview"
          : "What are the key features and components of this codebase?";

        console.log(`🤖 Running background ${mode} exploration for ${owner}/${repo}...`);
        const explorationResult = await explore(prompt, cloneResult.localPath, mode);

        // Store the results
        await this.store.storeExploration(owner, repo, mode, explorationResult);

        console.log(`✅ Background ${mode} exploration completed for ${owner}/${repo}`);
      } else {
        console.error(`❌ Repository clone failed for background exploration: ${owner}/${repo}`);
      }
    } catch (error) {
      console.error(`💥 Background ${mode} exploration failed for ${owner}/${repo}:`, error);
    }
  }

  private async parseRequestBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = "";
      req.on("data", (chunk: any) => (body += chunk));
      req.on("end", () => resolve(body));
      req.on("error", reject);
    });
  }

  private async processRequest(
    request: GitSeeRequest
  ): Promise<GitSeeResponse> {
    const { owner, repo, data } = request;
    const response: GitSeeResponse = {};

    // 🚀 AGENTIC: Start background clone immediately (fire-and-forget)
    console.log(`🔄 Starting background clone for ${owner}/${repo}...`);
    RepoCloner.cloneInBackground(owner, repo);

    // 🤖 AGENTIC: Auto-start first_pass exploration if we don't have recent data (fire-and-forget)
    this.autoStartFirstPassExploration(owner, repo);

    // Add visualization options to response
    if (this.options.visualization) {
      response.options = {
        nodeDelay: this.options.visualization.nodeDelay || 800,
      };
    } else {
      // Default options
      response.options = {
        nodeDelay: 800,
      };
    }

    // Validate input
    if (!owner || !repo) {
      throw new Error("Owner and repo are required");
    }

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Data array is required and must not be empty");
    }

    console.log(
      `🔍 Processing request for ${owner}/${repo} with data: [${data.join(", ")}]`
    );

    // Process each requested data type using resource modules
    for (const dataType of data) {
      try {
        switch (dataType) {
          case "repo_info":
            console.log(`🔍 Fetching repository info for ${owner}/${repo}...`);
            response.repo = await this.repository.getRepoInfo(owner, repo);
            console.log(`📋 Repository info result: Found`);
            break;

          case "contributors":
            console.log(`🔍 Fetching contributors for ${owner}/${repo}...`);
            response.contributors = await this.contributors.getContributors(
              owner,
              repo
            );
            console.log(
              `👥 Contributors result: ${response.contributors?.length || 0} found`
            );
            break;

          case "icon":
            console.log(`🔍 Fetching icon for ${owner}/${repo}...`);
            response.icon = await this.icons.getRepoIcon(owner, repo);
            console.log(
              `📷 Icon result:`,
              response.icon ? "Found" : "Not found"
            );
            break;

          case "commits":
            console.log(`🔍 Fetching commits for ${owner}/${repo}...`);
            response.commits = await this.commits.getCommits(owner, repo);
            console.log(
              `📝 Commits result: ${response.commits?.length || 0} found`
            );
            break;

          case "branches":
            console.log(`🔍 Fetching branches for ${owner}/${repo}...`);
            response.branches = await this.branches.getBranches(owner, repo);
            console.log(
              `🌿 Branches result: ${response.branches?.length || 0} found`
            );
            break;

          case "files":
            console.log(`🔍 Fetching key files for ${owner}/${repo}...`);
            response.files = await this.files.getKeyFiles(owner, repo);
            console.log(
              `📁 Files result: ${response.files?.length || 0} found`
            );
            break;

          case "stats":
            console.log(`🔍 Fetching stats for ${owner}/${repo}...`);
            response.stats = await this.stats.getRepoStats(owner, repo);
            console.log(
              `📊 Stats result: ${response.stats?.stars} stars, ${response.stats?.totalPRs} PRs, ${response.stats?.totalCommits} commits, ${response.stats?.ageInYears}y old`
            );
            break;

          case "file_content":
            if (!request.filePath) {
              console.warn(
                `⚠️ File content requested but no filePath provided`
              );
              break;
            }
            console.log(
              `🔍 Fetching file content for ${owner}/${repo}:${request.filePath}...`
            );
            response.fileContent = await this.files.getFileContent(
              owner,
              repo,
              request.filePath
            );
            console.log(
              `📄 File content result: ${
                response.fileContent
                  ? `Found (${response.fileContent.size} bytes)`
                  : "Not found"
              }`
            );
            break;

          case "exploration":
            console.log(`🔍 Fetching exploration data for ${owner}/${repo}...`);
            const explorationMode: RepoContextMode =
              request.explorationMode || "general";

            // Check if we have recent exploration data
            if (
              await this.store.hasRecentExploration(
                owner,
                repo,
                explorationMode,
                24
              )
            ) {
              console.log(
                `♻️ Using cached ${explorationMode} exploration data`
              );
              const cached = await this.store.getExploration(
                owner,
                repo,
                explorationMode
              );
              response.exploration = cached?.result;
            } else {
              console.log(`🤖 Running ${explorationMode} agent exploration...`);
              try {
                // Wait for repo to be cloned first
                await RepoCloner.waitForClone(owner, repo);
                const cloneResult = await RepoCloner.getCloneResult(
                  owner,
                  repo
                );

                if (cloneResult?.success && cloneResult.localPath) {
                  const prompt =
                    request.explorationPrompt ||
                    (explorationMode === "first_pass"
                      ? "Analyze this repository and provide a comprehensive overview"
                      : "What are the key features and components of this codebase?");

                  const explorationResult = await explore(
                    prompt,
                    cloneResult.localPath,
                    explorationMode
                  );

                  // Store for future requests
                  await this.store.storeExploration(
                    owner,
                    repo,
                    explorationMode,
                    explorationResult
                  );
                  response.exploration = explorationResult;

                  // Also store basic data if this is our first interaction
                  await this.store.storeBasicData(owner, repo, {
                    repo: response.repo,
                    contributors: response.contributors,
                    files: response.files,
                    stats: response.stats,
                    icon: response.icon,
                  });

                  console.log(
                    `✅ ${explorationMode} exploration completed and cached`
                  );
                } else {
                  console.error("Repository clone failed or not available");
                  response.exploration = {
                    error: "Repository not accessible for exploration",
                  };
                }
              } catch (error) {
                console.error(
                  `Failed to run ${explorationMode} exploration:`,
                  error
                );
                response.exploration = {
                  error: `Exploration failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                };
              }
            }
            break;

          default:
            console.warn(`⚠️  Unknown data type: ${dataType}`);
        }
      } catch (error) {
        console.error(
          `💥 Error processing ${dataType} for ${owner}/${repo}:`,
          error
        );
        // Continue processing other data types instead of failing completely
      }
    }

    return response;
  }
}

// Factory function for easy integration
export function createGitSeeHandler(options: GitSeeOptions = {}) {
  const handler = new GitSeeHandler(options);
  return (req: IncomingMessage, res: ServerResponse) =>
    handler.handle(req, res);
}
