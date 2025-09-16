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
import {
  RepoCloner,
  explore,
  RepoContextMode,
  CloneOptions,
} from "./agent/index.js";
import { FileStore } from "./persistence/index.js";
import { ExplorationEmitter } from "./events/index.js";

export class GitSeeHandler {
  private octokit: Octokit;
  private cache: GitSeeCache;
  private options: GitSeeOptions;
  private store: FileStore;
  private emitter: ExplorationEmitter;

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
    this.emitter = ExplorationEmitter.getInstance();

    // Initialize resource modules
    this.contributors = new ContributorsResource(this.octokit, this.cache);
    this.icons = new IconsResource(this.octokit, this.cache);
    this.repository = new RepositoryResource(this.octokit, this.cache);
    this.commits = new CommitsResource(this.octokit, this.cache);
    this.branches = new BranchesResource(this.octokit, this.cache);
    this.files = new FilesResource(this.octokit, this.cache);
    this.stats = new StatsResource(this.octokit, this.cache);
  }

  async handleEvents(
    req: IncomingMessage,
    res: ServerResponse,
    owner: string,
    repo: string
  ): Promise<void> {
    console.log(`📡 SSE connection established for ${owner}/${repo}`);

    // Set SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
    });

    // Send initial connection event
    res.write(
      `data: ${JSON.stringify({
        type: "connected",
        owner,
        repo,
        timestamp: Date.now(),
      })}\n\n`
    );

    // Subscribe to repository events
    const unsubscribe = this.emitter.subscribeToRepo(owner, repo, (event) => {
      try {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      } catch (error) {
        console.error(
          `💥 Error writing SSE event for ${owner}/${repo}:`,
          error
        );
      }
    });

    // Handle client disconnect
    req.on("close", () => {
      console.log(`📡 SSE connection closed for ${owner}/${repo}`);
      unsubscribe();
    });

    req.on("error", (error) => {
      console.error(`💥 SSE connection error for ${owner}/${repo}:`, error);
      unsubscribe();
    });

    // Keep connection alive with periodic heartbeat
    const heartbeat = setInterval(() => {
      try {
        res.write(
          `data: ${JSON.stringify({
            type: "heartbeat",
            timestamp: Date.now(),
          })}\n\n`
        );
      } catch (error) {
        console.error(`💥 Heartbeat failed for ${owner}/${repo}:`, error);
        clearInterval(heartbeat);
        unsubscribe();
      }
    }, 30000); // 30 second heartbeat

    // Clean up heartbeat when connection closes
    req.on("close", () => {
      clearInterval(heartbeat);
    });
  }

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    console.log("🔥 GitSeeHandler.handle() - START");

    // Set CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    console.log("🔥 CORS headers set");

    if (req.method === "OPTIONS") {
      console.log("🔥 OPTIONS request, responding with 200");
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method !== "POST") {
      console.log("🔥 Method not POST:", req.method);
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    try {
      console.log("🔥 Parsing request body...");
      const body = await this.parseRequestBody(req);
      console.log("🔥 Request body parsed:", body.length, "chars");

      console.log("🔥 Parsing JSON...");
      const request: GitSeeRequest = JSON.parse(body);
      console.log(
        "🔥 JSON parsed - owner:",
        request.owner,
        "repo:",
        request.repo,
        "data:",
        request.data
      );

      console.log("🔥 About to call processRequest...");
      const response = await this.processRequest(request);
      console.log(
        "🔥 processRequest completed, response keys:",
        Object.keys(response)
      );

      console.log("🔥 Sending response...");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(response));
      console.log("🔥 Response sent successfully");
    } catch (error) {
      console.error("🔥 GitSee handler error:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error:
            error instanceof Error ? error.message : "Internal server error",
        })
      );
    }
  }

  /**
   * Handle request with pre-parsed JSON body (for Express.js integration)
   * Use this when your framework already parsed the JSON body (e.g., express.json() middleware)
   */
  async handleJson(body: GitSeeRequest, res: ServerResponse): Promise<void> {
    console.log("🔥 GitSeeHandler.handleJson() - START");

    // Set CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    console.log("🔥 CORS headers set");

    try {
      console.log(
        "🔥 Using pre-parsed body - owner:",
        body.owner,
        "repo:",
        body.repo,
        "data:",
        body.data
      );

      console.log("🔥 About to call processRequest...");
      const response = await this.processRequest(body);
      console.log(
        "🔥 processRequest completed, response keys:",
        Object.keys(response)
      );

      console.log("🔥 Sending response...");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(response));
      console.log("🔥 Response sent successfully");
    } catch (error) {
      console.error("🔥 GitSee handleJson error:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error:
            error instanceof Error ? error.message : "Internal server error",
        })
      );
    }
  }

  private autoStartFirstPassExploration(
    owner: string,
    repo: string,
    cloneOptions?: CloneOptions
  ): void {
    // Use setImmediate to completely defer this work
    setImmediate(async () => {
      try {
        // Check if we already have recent first_pass exploration
        const hasRecent = await this.store.hasRecentExploration(
          owner,
          repo,
          "first_pass",
          24
        );

        if (!hasRecent) {
          console.log(
            `🚀 Auto-starting first_pass exploration for ${owner}/${repo}...`
          );
          this.emitter.emitExplorationStarted(owner, repo, "first_pass");

          // Fire and forget - don't await, let it run in background
          this.runBackgroundExploration(
            owner,
            repo,
            "first_pass",
            cloneOptions
          ).catch((error) => {
            console.error(
              `🚨 Background first_pass exploration failed for ${owner}/${repo}:`,
              error.message
            );
            this.emitter.emitExplorationFailed(
              owner,
              repo,
              "first_pass",
              error.message
            );
          });
        } else {
          console.log(
            `✅ Recent first_pass exploration found for ${owner}/${repo}, emitting cached result`
          );

          // Wait for SSE connection then emit cached exploration
          setImmediate(async () => {
            try {
              const cached = await this.store.getExploration(
                owner,
                repo,
                "first_pass"
              );
              if (cached?.result) {
                console.log(
                  `⏳ Waiting for SSE connection before emitting cached first_pass exploration for ${owner}/${repo}`
                );

                // Wait for SSE connection with timeout
                try {
                  await this.emitter.waitForConnection(owner, repo, 10000);
                  console.log(
                    `🔔 SSE connected! Emitting cached first_pass exploration for ${owner}/${repo}`
                  );
                  console.log(
                    `🔔 Infrastructure in cached result:`,
                    (cached.result as any).infrastructure
                  );
                  console.log(
                    `🔔 Current SSE listeners:`,
                    this.emitter.getListenerCount(owner, repo)
                  );
                  this.emitter.emitExplorationCompleted(
                    owner,
                    repo,
                    "first_pass",
                    cached.result
                  );
                } catch (timeoutError) {
                  console.warn(
                    `⏰ Timeout waiting for SSE connection, emitting anyway for ${owner}/${repo}`
                  );
                  this.emitter.emitExplorationCompleted(
                    owner,
                    repo,
                    "first_pass",
                    cached.result
                  );
                }
              }
            } catch (error) {
              console.error(
                `💥 Error emitting cached exploration for ${owner}/${repo}:`,
                error
              );
            }
          });
        }
      } catch (error) {
        console.error(
          `💥 Error checking exploration status for ${owner}/${repo}:`,
          error
        );
      }
    });
  }

  private async runBackgroundExploration(
    owner: string,
    repo: string,
    mode: RepoContextMode,
    cloneOptions?: CloneOptions
  ): Promise<void> {
    try {
      // Wait for repo to be cloned with options if provided
      await RepoCloner.waitForClone(owner, repo, cloneOptions);
      const cloneResult = await RepoCloner.getCloneResult(owner, repo);

      if (cloneResult?.success && cloneResult.localPath) {
        this.emitter.emitCloneCompleted(
          owner,
          repo,
          true,
          cloneResult.localPath
        );

        const prompt =
          mode === "first_pass"
            ? "Analyze this repository and provide a comprehensive overview"
            : "What are the key features and components of this codebase?";

        console.log(
          `🤖 Running background ${mode} exploration for ${owner}/${repo}...`
        );
        this.emitter.emitExplorationProgress(
          owner,
          repo,
          mode,
          "Running AI analysis..."
        );

        const explorationResult = await explore(
          prompt,
          cloneResult.localPath,
          mode
        );

        // Store the results
        await this.store.storeExploration(owner, repo, mode, explorationResult);

        console.log(
          `✅ Background ${mode} exploration completed for ${owner}/${repo}`
        );
        this.emitter.emitExplorationCompleted(
          owner,
          repo,
          mode,
          explorationResult
        );
      } else {
        console.error(
          `❌ Repository clone failed for background exploration: ${owner}/${repo}`
        );
        this.emitter.emitCloneCompleted(owner, repo, false);
        this.emitter.emitExplorationFailed(
          owner,
          repo,
          mode,
          "Repository clone failed"
        );
      }
    } catch (error) {
      console.error(
        `💥 Background ${mode} exploration failed for ${owner}/${repo}:`,
        error
      );
      this.emitter.emitExplorationFailed(
        owner,
        repo,
        mode,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  private async parseRequestBody(req: IncomingMessage): Promise<string> {
    console.log("🔥 parseRequestBody - START");
    return new Promise((resolve, reject) => {
      let body = "";
      console.log("🔥 Setting up data/end/error handlers...");

      req.on("data", (chunk: any) => {
        console.log("🔥 Received data chunk:", chunk.length, "bytes");
        body += chunk;
      });

      req.on("end", () => {
        console.log("🔥 Request body parsing complete:", body.length, "chars");
        resolve(body);
      });

      req.on("error", (error) => {
        console.log("🔥 Request body parsing error:", error);
        reject(error);
      });

      console.log("🔥 Waiting for request data...");
    });
  }

  private async processRequest(
    request: GitSeeRequest
  ): Promise<GitSeeResponse> {
    console.log("🔥 processRequest - START");
    const { owner, repo, data, cloneOptions } = request;
    const response: GitSeeResponse = {};

    console.log("🔥 Setting up Octokit and resources...");
    // Create per-request Octokit instance if token provided, otherwise use default
    const requestOctokit = cloneOptions?.token
      ? new Octokit({ auth: cloneOptions.token })
      : this.octokit;

    // Create per-request resource instances if token provided
    const contributors = cloneOptions?.token
      ? new ContributorsResource(requestOctokit, this.cache)
      : this.contributors;
    const icons = cloneOptions?.token
      ? new IconsResource(requestOctokit, this.cache)
      : this.icons;
    const repository = cloneOptions?.token
      ? new RepositoryResource(requestOctokit, this.cache)
      : this.repository;
    const commits = cloneOptions?.token
      ? new CommitsResource(requestOctokit, this.cache)
      : this.commits;
    const branches = cloneOptions?.token
      ? new BranchesResource(requestOctokit, this.cache)
      : this.branches;
    const files = cloneOptions?.token
      ? new FilesResource(requestOctokit, this.cache)
      : this.files;
    const stats = cloneOptions?.token
      ? new StatsResource(requestOctokit, this.cache)
      : this.stats;

    console.log("🔥 Starting background operations...");
    // 🚀 AGENTIC: Start background clone immediately (fire-and-forget) with clone options
    console.log(`🔄 Starting background clone for ${owner}/${repo}...`);
    this.emitter.emitCloneStarted(owner, repo);
    RepoCloner.cloneInBackground(owner, repo, cloneOptions);

    // 🤖 AGENTIC: Auto-start first_pass exploration if we don't have recent data (fire-and-forget)
    console.log("🔥 Starting first pass exploration...");
    this.autoStartFirstPassExploration(owner, repo, cloneOptions);

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

    console.log("🔥 Starting main data processing loop...");
    // Process each requested data type using resource modules
    for (const dataType of data) {
      try {
        console.log(`🔥 Processing data type: ${dataType}`);
        switch (dataType) {
          case "repo_info":
            console.log(`🔍 Fetching repository info for ${owner}/${repo}...`);
            response.repo = await repository.getRepoInfo(owner, repo);
            console.log(`📋 Repository info result: Found`);
            break;

          case "contributors":
            console.log(`🔍 Fetching contributors for ${owner}/${repo}...`);
            response.contributors = await contributors.getContributors(
              owner,
              repo
            );
            console.log(
              `👥 Contributors result: ${response.contributors?.length || 0} found`
            );
            break;

          case "icon":
            console.log(`🔍 Fetching icon for ${owner}/${repo}...`);
            response.icon = await icons.getRepoIcon(owner, repo);
            console.log(
              `📷 Icon result:`,
              response.icon ? "Found" : "Not found"
            );
            break;

          case "commits":
            console.log(`🔍 Fetching commits for ${owner}/${repo}...`);
            response.commits = await commits.getCommits(owner, repo);
            console.log(
              `📝 Commits result: ${response.commits?.length || 0} found`
            );
            break;

          case "branches":
            console.log(`🔍 Fetching branches for ${owner}/${repo}...`);
            response.branches = await branches.getBranches(owner, repo);
            console.log(
              `🌿 Branches result: ${response.branches?.length || 0} found`
            );
            break;

          case "files":
            console.log(`🔍 Fetching key files for ${owner}/${repo}...`);
            response.files = await files.getKeyFiles(owner, repo);
            console.log(
              `📁 Files result: ${response.files?.length || 0} found`
            );
            break;

          case "stats":
            console.log(`🔍 Fetching stats for ${owner}/${repo}...`);
            response.stats = await stats.getRepoStats(owner, repo);
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
            response.fileContent = await files.getFileContent(
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

              // Emit the cached result for any SSE listeners
              if (cached?.result) {
                this.emitter.emitExplorationCompleted(
                  owner,
                  repo,
                  explorationMode,
                  cached.result
                );
              }
            } else {
              console.log(`🤖 Running ${explorationMode} agent exploration...`);
              try {
                // Wait for repo to be cloned first with options if provided
                await RepoCloner.waitForClone(owner, repo, cloneOptions);
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

    console.log("🔥 Main data processing loop completed");
    console.log("🔥 processRequest - END, returning response");
    return response;
  }
}

// Factory function for easy integration
export function createGitSeeHandler(options: GitSeeOptions = {}) {
  const handler = new GitSeeHandler(options);
  return (req: IncomingMessage, res: ServerResponse) =>
    handler.handle(req, res);
}
