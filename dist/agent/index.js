var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/agent/repo-cloner.ts
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
var RepoCloner = class {
  /**
   * Clone a repository in the background (fire-and-forget)
   */
  static async cloneInBackground(owner, repo) {
    const repoKey = `${owner}/${repo}`;
    if (this.clonePromises.has(repoKey)) {
      return;
    }
    const clonePromise = this.cloneRepo(owner, repo);
    this.clonePromises.set(repoKey, clonePromise);
    clonePromise.finally(() => {
      setTimeout(() => {
        this.clonePromises.delete(repoKey);
      }, 5e3);
    }).catch((error) => {
      console.error(
        `\u{1F6A8} Background clone failed for ${owner}/${repo}:`,
        error.message
      );
    });
  }
  /**
   * Clone a repository to /tmp/gitsee/{owner}/{repo}
   */
  static async cloneRepo(owner, repo) {
    const startTime = Date.now();
    const repoPath = path.join(this.BASE_PATH, owner, repo);
    const githubUrl = `https://github.com/${owner}/${repo}.git`;
    console.log(`\u{1F4E5} Starting clone of ${owner}/${repo} to ${repoPath}`);
    try {
      if (fs.existsSync(repoPath)) {
        console.log(
          `\u{1F4C2} Repository ${owner}/${repo} already exists at ${repoPath}`
        );
        return {
          success: true,
          localPath: repoPath,
          duration: Date.now() - startTime
        };
      }
      const parentDir = path.dirname(repoPath);
      fs.mkdirSync(parentDir, { recursive: true });
      const result = await this.executeGitClone(githubUrl, repoPath);
      const duration = Date.now() - startTime;
      if (result.success) {
        console.log(`\u2705 Successfully cloned ${owner}/${repo} in ${duration}ms`);
        return {
          success: true,
          localPath: repoPath,
          duration
        };
      } else {
        console.error(`\u274C Failed to clone ${owner}/${repo}:`, result.error);
        return {
          success: false,
          localPath: repoPath,
          error: result.error,
          duration
        };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`\u{1F4A5} Clone error for ${owner}/${repo}:`, error.message);
      return {
        success: false,
        localPath: repoPath,
        error: error.message,
        duration
      };
    }
  }
  /**
   * Execute git clone command with shallow clone and single branch
   */
  static executeGitClone(githubUrl, targetPath) {
    return new Promise((resolve) => {
      const gitProcess = spawn("git", [
        "clone",
        "--depth",
        "1",
        // Shallow clone (only latest commit)
        "--single-branch",
        // Only clone the default branch
        "--no-tags",
        // Skip tags for speed
        githubUrl,
        targetPath
      ]);
      let errorOutput = "";
      gitProcess.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });
      gitProcess.stdout.on("data", (data) => {
        const output = data.toString();
        if (output.includes("Cloning") || output.includes("Receiving")) {
          console.log(`\u{1F4E5} ${output.trim()}`);
        }
      });
      gitProcess.on("close", (code) => {
        if (code === 0) {
          resolve({ success: true });
        } else {
          resolve({
            success: false,
            error: errorOutput || `Git clone exited with code ${code}`
          });
        }
      });
      gitProcess.on("error", (error) => {
        resolve({
          success: false,
          error: `Failed to start git process: ${error.message}`
        });
      });
    });
  }
  /**
   * Check if a repository is already cloned
   */
  static isRepoCloned(owner, repo) {
    const repoPath = path.join(this.BASE_PATH, owner, repo);
    return fs.existsSync(repoPath) && fs.existsSync(path.join(repoPath, ".git"));
  }
  /**
   * Get the local path for a repository
   */
  static getRepoPath(owner, repo) {
    return path.join(this.BASE_PATH, owner, repo);
  }
  /**
   * Wait for a repository clone to complete
   */
  static async waitForClone(owner, repo) {
    const repoKey = `${owner}/${repo}`;
    if (this.isRepoCloned(owner, repo)) {
      return {
        success: true,
        localPath: this.getRepoPath(owner, repo)
      };
    }
    const clonePromise = this.clonePromises.get(repoKey);
    if (clonePromise) {
      console.log(`\u23F3 Waiting for ongoing clone of ${owner}/${repo}...`);
      return await clonePromise;
    }
    console.log(`\u{1F680} Starting new clone for ${owner}/${repo}...`);
    return await this.cloneRepo(owner, repo);
  }
  /**
   * Get clone result if available (non-blocking)
   */
  static async getCloneResult(owner, repo) {
    const repoKey = `${owner}/${repo}`;
    if (this.isRepoCloned(owner, repo)) {
      return {
        success: true,
        localPath: this.getRepoPath(owner, repo)
      };
    }
    const clonePromise = this.clonePromises.get(repoKey);
    if (clonePromise) {
      try {
        return await clonePromise;
      } catch (error) {
        return {
          success: false,
          localPath: this.getRepoPath(owner, repo),
          error: error instanceof Error ? error.message : "Unknown error"
        };
      }
    }
    return null;
  }
  /**
   * Clean up old repositories (optional utility)
   */
  static async cleanupOldRepos(maxAgeHours = 24) {
    try {
      if (!fs.existsSync(this.BASE_PATH)) {
        return;
      }
      const cutoffTime = Date.now() - maxAgeHours * 60 * 60 * 1e3;
      const owners = fs.readdirSync(this.BASE_PATH);
      for (const owner of owners) {
        const ownerPath = path.join(this.BASE_PATH, owner);
        if (!fs.statSync(ownerPath).isDirectory()) continue;
        const repos = fs.readdirSync(ownerPath);
        for (const repo of repos) {
          const repoPath = path.join(ownerPath, repo);
          const stats = fs.statSync(repoPath);
          if (stats.isDirectory() && stats.mtime.getTime() < cutoffTime) {
            console.log(`\u{1F5D1}\uFE0F Cleaning up old repo: ${owner}/${repo}`);
            fs.rmSync(repoPath, { recursive: true, force: true });
          }
        }
      }
    } catch (error) {
      console.error("Error cleaning up old repos:", error.message);
    }
  }
};
RepoCloner.BASE_PATH = "/tmp/gitsee";
RepoCloner.clonePromises = /* @__PURE__ */ new Map();

// server/agent/explore.ts
import { generateText, tool, hasToolCall } from "ai";
import { getModel, getApiKeyForProvider } from "aieo";

// server/agent/prompts/first_pass.ts
var first_pass_exports = {};
__export(first_pass_exports, {
  EXPLORER: () => EXPLORER,
  FINAL_ANSWER: () => FINAL_ANSWER
});
var EXPLORER = `
You are a codebase exploration assistant. Use the provided tools to quickly explore the codebase and get a high-level understanding. DONT GO DEEP. Focus on general language and framework, specific core libraries, integrations, and features. Try to understand the main user story of the codebase just by looking at the file structure. YOU NEED TO RETURN AN ANSWER AS FAST AS POSSIBLE! So the best approach is 3-4 tool calls only: 1) repo_overview 2) file_summary of the package.json (or other main package file), 3) The main router file of page/endpoint names, ONLY if you can identify it first try, and 4) final_answer. DO NOT GO DEEPER THAN THIS.
`;
var FINAL_ANSWER = `
Provide the final answer to the user. YOU **MUST** CALL THIS TOOL AT THE END OF YOUR EXPLORATION.

Return a simple JSON object with the following fields:

- "summary": a SHORT 1-2 sentence synopsis of the codebase.
- "key_files": an array of a few core package and LLM agent files. Focus on package files like package.json, and core markdown files. DO NOT include code files unless they are central to the codebase, such as the main DB schema file.
- "infrastructure"/"dependencies"/"user_stories"/"pages": short arrays of core elements of the application,: 1-2 words each. Include just a few dependencies, ONLY if it seems like they are central to the application. Try to find the main user flows and pages just by looking at file names, or a couple file contents. In total try to target 10-12 items for these four categories. Get at least one in each category, but don't make anything up!

{
  "summary": "This is a next.js project with a postgres database and a github oauth implementation",
  "key_files": ["package.json", "README.md", "CLAUDE.md", "AGENTS.md", "schema.prisma"],
  "infrastructure": ["Next.js", "Postgres", "Typescript"],
  "dependencies": ["Github Integration", "D3.js", "React"],
  "user_stories": ["Authentication", "Payments"],
  "pages": ["User Journeys page", "Admin Dashboard"]
}
`;

// server/agent/prompts/general.ts
var general_exports = {};
__export(general_exports, {
  EXPLORER: () => EXPLORER2,
  FINAL_ANSWER: () => FINAL_ANSWER2
});
var EXPLORER2 = `
You are a codebase exploration assistant. Use the provided tools to explore the codebase and answer the user's question. Focus on general language and framework first, then specific core libraries, integrations, and features. Try to understand the core functionallity (user stories) of the codebase. Explore files, functions, and component names to understand the main user stories, pages, UX components, or workflows in the application.
`;
var FINAL_ANSWER2 = `
Provide the final answer to the user. YOU **MUST** CALL THIS TOOL AT THE END OF YOUR EXPLORATION.

Return a simple JSON object with the following fields:

- "summary": a 1-4 sentence short synopsis of the codebase.
- "key_files": an array of the core package and LLM agent files. Focus on package files like package.json, and core markdown files. DO NOT include code files unless they are central to the codebase, such as the main DB schema file.
- "features": an array of about 20 core user stories or pages, 1-4 words each. Each one should be focused on ONE SINGLE user action... DO NOT flesh these out for not reason!! Keep them short and to the point BUT SPECIFIC, NOT GENERAL! For example "Github Integration" and "Google Oauth Login" are separate, not one "Integrations".

{
  "summary": "This is a next.js project with a postgres database and a github oauth implementation",
  "key_files": ["package.json", "README.md", "CLAUDE.md", "AGENTS.md", "schema.prisma"],
  "features": ["Authentication", "User Journeys page", "Payments", "Admin Dashboard", "Notifications", "User Profile", "Settings page", "Data Visualization", "Github Integration", "File Uploads", "Search Functionality", "Real-time Collaboration Tools", "Activity Logs", "Billing and Subscription Management", "Help and Support"]
}
`;

// server/agent/prompts/services.ts
var services_exports = {};
__export(services_exports, {
  EXPLORER: () => EXPLORER3,
  FINAL_ANSWER: () => FINAL_ANSWER3
});
var EXPLORER3 = `
You are a codebase exploration assistant. Your job is to identify the various services, integrations, and environment variables need to setup and run this codebase. Take your time exploring the codebase to find the most likely setup services, and env vars. You might need to use the fulltext_search tool to find instance of "process.env." or other similar patterns, based on the coding language(s) used in the project. You will be asked to output actual configuration files at the end, so make sure you find everything you need to do that.
`;
var FINAL_ANSWER3 = `
Provide the final answer to the user. YOU **MUST** CALL THIS TOOL AT THE END OF YOUR EXPLORATION.

Return three files: a pm2.config.js, a .env file, and a docker-compose.yml. Please put the title of each file, then the content in backticks.

- pm2.config.js: the actual dev services for running this project. Often its just one single service! But sometimes the backend/frontend might be separate services.
- .env: the environment variables needed to run the project, with example values.
- docker-compose.yml: the auxiliary services needed to run the project, such as databases, caches, queues, etc. IMPORTANT: there is a special "app" service in the docker-compsose.yaml that you MUST include! It is the service in which the codebase is mounted. Here is the EXACT content that it should have:
\`\`\`
  app:
    build:
      context: .
      dockerfile: Dockerfile
    volumes:
      - ../..:/workspaces:cached
    command: sleep infinity
    networks:
      - app_network
    extra_hosts:
      - "localhost:172.17.0.1"
      - "host.docker.internal:host-gateway"
\`\`\`

# HERE IS AN EXAMPLE OUTPUT:

pm2.config.js

\`\`\`js
module.exports = {
  apps: [
    {
      name: "frontend",
      script: "npm run dev",
      cwd: "/workspaces/my-project",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        PORT: "3000",
        INSTALL_COMMAND: "npm install",
        BUILD_COMMAND: "npm run build"
      }
    }
  ],
};
\`\`\`

.env

\`\`\`sh
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/backend_db
JWT_KEY=your_jwt_secret_key
\`\`\`

docker-compose.yml

\`\`\`yaml
version: '3.8'
networks:
  app_network:
    driver: bridge
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    volumes:
      - ../..:/workspaces:cached
    command: sleep infinity
    networks:
      - app_network
    extra_hosts:
      - "localhost:172.17.0.1"
      - "host.docker.internal:host-gateway"
  postgres:
    image: postgres:15
    container_name: backend-postgres
    environment:
      - POSTGRES_DB=backend_db
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - app_network
    restart: unless-stopped
volumes:
  postgres_data:
\`\`\`

`;

// server/agent/explore.ts
import { z } from "zod";

// server/agent/tools.ts
import { spawn as spawn2 } from "child_process";
import * as fs2 from "fs";
import * as path2 from "path";
function execCommand(command, cwd, timeoutMs = 1e4) {
  return new Promise((resolve, reject) => {
    const parts = command.split(" ");
    const rgIndex = parts.findIndex(
      (part) => part === "rg" || part.endsWith("/rg")
    );
    if (rgIndex === -1) {
      reject(new Error("Not a ripgrep command"));
      return;
    }
    const args = parts.slice(rgIndex + 1).map((arg) => {
      if (arg.startsWith('"') && arg.endsWith('"') || arg.startsWith("'") && arg.endsWith("'")) {
        return arg.slice(1, -1);
      }
      return arg;
    });
    args.push("./");
    const process2 = spawn2("rg", args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        process2.kill("SIGKILL");
        resolved = true;
        reject(new Error(`Command timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);
    process2.stdout.on("data", (data) => {
      stdout += data.toString();
      if (stdout.length > 1e4) {
        process2.kill("SIGKILL");
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          const truncated = stdout.substring(0, 1e4) + "\n\n[... output truncated due to size limit ...]";
          resolve(truncated);
        }
        return;
      }
    });
    process2.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    process2.on("close", (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        if (code === 0) {
          if (stdout.length > 1e4) {
            const truncated = stdout.substring(0, 1e4) + "\n\n[... output truncated to 10,000 characters ...]";
            resolve(truncated);
          } else {
            resolve(stdout);
          }
        } else if (code === 1) {
          resolve("No matches found");
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      }
    });
    process2.on("error", (error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(error);
      }
    });
  });
}
async function getRepoMap(repoPath) {
  if (!repoPath) {
    return "No repository path provided";
  }
  if (!fs2.existsSync(repoPath)) {
    return "Repository not cloned yet";
  }
  try {
    const result = await execCommand(
      "git ls-tree -r --name-only HEAD | tree -L 3 --fromfile",
      repoPath
    );
    return result;
  } catch (error) {
    return `Error getting repo map: ${error.message}`;
  }
}
function getFileSummary(filePath, repoPath, linesLimit) {
  if (!repoPath) {
    return "No repository path provided";
  }
  const fullPath = path2.join(repoPath, filePath);
  if (!fs2.existsSync(fullPath)) {
    return "File not found";
  }
  try {
    const content = fs2.readFileSync(fullPath, "utf-8");
    const lines = content.split("\n").slice(0, linesLimit || 40).map((line) => {
      return line.length > 200 ? line.substring(0, 200) + "..." : line;
    });
    return lines.join("\n");
  } catch (error) {
    return `Error reading file: ${error.message}`;
  }
}
async function fulltextSearch(query, repoPath) {
  if (!repoPath) {
    return "No repository path provided";
  }
  if (!fs2.existsSync(repoPath)) {
    return "Repository not cloned yet";
  }
  try {
    const result = await execCommand(
      `rg --glob '!dist' --ignore-file .gitignore -C 2 -n --max-count 10 --max-columns 200 "${query}"`,
      repoPath,
      5e3
    );
    if (result.length > 1e4) {
      return result.substring(0, 1e4) + "\n\n[... output truncated to 10,000 characters ...]";
    }
    return result;
  } catch (error) {
    if (error.message.includes("code 1")) {
      return `No matches found for "${query}"`;
    }
    return `Error searching: ${error.message}`;
  }
}

// server/agent/explore.ts
function logStep(contents) {
  if (!Array.isArray(contents)) return;
  for (const content of contents) {
    if (content.type === "tool-call" && content.toolName !== "final_answer") {
      console.log("TOOL CALL:", content.toolName, ":", content.input);
    }
  }
}
var CONFIG = {
  first_pass: {
    file_lines: 100,
    system: first_pass_exports.EXPLORER,
    final_answer_description: first_pass_exports.FINAL_ANSWER
  },
  general: {
    file_lines: 40,
    system: general_exports.EXPLORER,
    final_answer_description: general_exports.FINAL_ANSWER
  },
  services: {
    file_lines: 40,
    system: services_exports.EXPLORER,
    final_answer_description: services_exports.FINAL_ANSWER
  }
};
async function get_context(prompt, repoPath, mode = "general") {
  const startTime = Date.now();
  const provider = process.env.LLM_PROVIDER || "anthropic";
  const apiKey = getApiKeyForProvider(provider);
  const model = await getModel(provider, apiKey);
  const tools = {
    repo_overview: tool({
      description: "Get a high-level view of the codebase architecture and structure. Use this to understand the project layout and identify where specific functionality might be located. Call this when you need to: 1) Orient yourself in an unfamiliar codebase, 2) Locate which directories/files might contain relevant code for a user's question, 3) Understand the overall project structure before diving deeper. Don't call this if you already know which specific files you need to examine.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          return await getRepoMap(repoPath);
        } catch (e) {
          return "Could not retrieve repository map";
        }
      }
    }),
    file_summary: tool({
      description: "Get a summary of what a specific file contains and its role in the codebase. Use this when you have identified a potentially relevant file and need to understand: 1) What functions/components it exports, 2) What its main responsibility is, 3) Whether it's worth exploring further for the user's question. Only the first 40-100 lines of the file will be returned. Call this with a hypothesis like 'This file probably handles user authentication' or 'This looks like the main dashboard component'. Don't call this to browse random files.",
      inputSchema: z.object({
        file_path: z.string().describe("Path to the file to summarize"),
        hypothesis: z.string().describe(
          "What you think this file might contain or handle, based on its name/location"
        )
      }),
      execute: async ({ file_path }) => {
        try {
          return getFileSummary(file_path, repoPath, CONFIG[mode].file_lines);
        } catch (e) {
          return "Bad file path";
        }
      }
    }),
    fulltext_search: tool({
      description: `Search the entire codebase for a specific term. Use this when you need to find a specific function, component, or file. Call this when the user provided specific text that might be present in the codebase. For example, if the query is 'Add a subtitle to the User Journeys page', you could call this with the query "User Journeys". Don't call this if you do not have specific text to search for`,
      inputSchema: z.object({
        query: z.string().describe("The term to search for")
      }),
      execute: async ({ query }) => {
        try {
          return await fulltextSearch(query, repoPath);
        } catch (e) {
          return `Search failed: ${e}`;
        }
      }
    }),
    final_answer: tool({
      // The tool that signals the end of the process
      description: CONFIG[mode].final_answer_description,
      inputSchema: z.object({ answer: z.string() }),
      execute: async ({ answer }) => answer
    })
  };
  if (mode === "first_pass") {
    delete tools.fulltext_search;
  }
  const { steps } = await generateText({
    model,
    tools,
    prompt,
    system: CONFIG[mode].system,
    stopWhen: hasToolCall("final_answer"),
    onStepFinish: (sf) => logStep(sf.content)
  });
  let final = "";
  let lastText = "";
  for (const step of steps) {
    for (const item of step.content) {
      if (item.type === "text" && item.text && item.text.trim().length > 0) {
        lastText = item.text.trim();
      }
    }
  }
  steps.reverse();
  for (const step of steps) {
    const final_answer = step.content.find((c) => {
      return c.type === "tool-result" && c.toolName === "final_answer";
    });
    if (final_answer) {
      final = final_answer.output;
    }
  }
  if (!final && lastText) {
    console.warn(
      "No final_answer tool call detected; falling back to last reasoning text."
    );
    final = `${lastText}

(Note: Model did not invoke final_answer tool; using last reasoning text as answer.)`;
  }
  const endTime = Date.now();
  const duration = endTime - startTime;
  console.log(
    `\u23F1\uFE0F get_context completed in ${duration}ms (${(duration / 1e3).toFixed(2)}s)`
  );
  return final;
}
setTimeout(() => {
  get_context(
    "How do I set up this project?",
    "/Users/evanfeenstra/code/sphinx2/hive",
    "services"
  ).then((result) => {
    console.log("=============== FINAL RESULT: ===============");
    console.log(result);
  });
});

// server/agent/explore-wrapper.ts
async function explore(prompt, repoPath, mode = "first_pass") {
  const startTime = Date.now();
  console.log(`\u{1F916} Starting ${mode} exploration...`);
  try {
    const jsonString = await get_context(prompt, repoPath, mode);
    console.log(
      `\u{1F4CB} Raw exploration result:`,
      jsonString.substring(0, 200) + "..."
    );
    if (mode === "services") {
      return jsonString;
    }
    let parsedResult;
    try {
      parsedResult = JSON.parse(jsonString);
    } catch (parseError) {
      console.warn("\u26A0\uFE0F Failed to parse JSON, treating as raw summary");
      if (mode === "first_pass") {
        parsedResult = {
          summary: jsonString,
          key_files: [],
          infrastructure: [],
          dependencies: [],
          user_stories: [],
          pages: []
        };
      } else {
        parsedResult = {
          summary: jsonString,
          key_files: [],
          features: []
        };
      }
    }
    let result;
    if (mode === "first_pass") {
      result = {
        summary: parsedResult.summary || jsonString,
        key_files: parsedResult.key_files || [],
        infrastructure: parsedResult.infrastructure || [],
        dependencies: parsedResult.dependencies || [],
        user_stories: parsedResult.user_stories || [],
        pages: parsedResult.pages || []
      };
    } else {
      result = {
        summary: parsedResult.summary || jsonString,
        key_files: parsedResult.key_files || [],
        features: parsedResult.features || []
      };
    }
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`\u2705 ${mode} exploration completed in ${duration}ms`);
    console.log(
      `\u{1F4CA} Result: ${result.key_files.length} key files, summary: ${result.summary.substring(0, 100)}...`
    );
    return result;
  } catch (error) {
    console.error(`\u{1F4A5} Exploration failed:`, error);
    if (mode === "first_pass") {
      return {
        summary: `Exploration failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        key_files: [],
        infrastructure: [],
        dependencies: [],
        user_stories: [],
        pages: []
      };
    } else {
      return {
        summary: `Exploration failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        key_files: [],
        features: []
      };
    }
  }
}
export {
  RepoCloner,
  explore,
  get_context
};
//# sourceMappingURL=index.js.map