import { generateText, tool, hasToolCall, ModelMessage } from "ai";
import { getModel, getApiKeyForProvider, Provider } from "aieo";
import { GENERAL_EXPLORER, GENERAL_FINAL_ANSWER_DESCRIPTION } from "./prompts";
import { z } from "zod";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

function logStep(contents: any) {
  // return;
  if (!Array.isArray(contents)) return;
  for (const content of contents) {
    console.log("STEP:", content.type);
    if (content.type === "tool-call") {
      if (content.toolName === "final_answer") {
        // console.log("FINAL ANSWER:", content.input.answer);
      } else {
        console.log("TOOL CALL:", content.toolName, ":", content.input);
      }
    }
    if (content.type === "tool-result") {
      if (content.toolName !== "repo_overview") {
        // console.log(content.output);
      }
      // console.log("TOOL RESULT", content.toolName, content.output);
    }
  }
}

// Utility function to execute ripgrep commands with proper streaming
function execCommand(
  command: string,
  cwd: string,
  timeoutMs: number = 10000
): Promise<string> {
  console.log(
    `⚙️ [execCommand] Starting command: "${command}" in directory: ${cwd} with timeout: ${timeoutMs}ms`
  );

  return new Promise((resolve, reject) => {
    // Parse the ripgrep command and add explicit directory
    const parts = command.split(' ');
    const rgIndex = parts.findIndex(part => part === 'rg' || part.endsWith('/rg'));
    
    if (rgIndex === -1) {
      reject(new Error("Not a ripgrep command"));
      return;
    }

    // Build ripgrep arguments properly, removing quotes and adding explicit directory
    const args = parts.slice(rgIndex + 1).map(arg => {
      // Remove surrounding quotes (both single and double)
      if ((arg.startsWith('"') && arg.endsWith('"')) || 
          (arg.startsWith("'") && arg.endsWith("'"))) {
        return arg.slice(1, -1);
      }
      return arg;
    });
    args.push('./'); // Add explicit directory to prevent stdin detection issues
    
    console.log(`⚙️ [execCommand] Spawning: rg with args:`, args);

    const process = spawn('rg', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'] // Ignore stdin, pipe stdout/stderr
    });

    let stdout = "";
    let stderr = "";
    let resolved = false;

    // Set up timeout
    const timeout = setTimeout(() => {
      if (!resolved) {
        console.log(`⚙️ [execCommand] Command timed out after ${timeoutMs}ms, killing process`);
        process.kill("SIGKILL");
        resolved = true;
        reject(new Error(`Command timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    process.stdout.on("data", (data) => {
      const chunk = data.toString();
      console.log(`⚙️ [execCommand] stdout chunk received, length: ${chunk.length}`);
      stdout += chunk;

      // Safety check: if output gets too large, kill process and resolve
      if (stdout.length > 10000) {
        console.log(`⚙️ [execCommand] Output too large (${stdout.length} chars), killing process`);
        process.kill("SIGKILL");
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          const truncated = stdout.substring(0, 10000) + "\n\n[... output truncated due to size limit ...]";
          console.log(`⚙️ [execCommand] Resolving with truncated output`);
          resolve(truncated);
        }
        return;
      }
    });

    process.stderr.on("data", (data) => {
      const chunk = data.toString();
      console.log(`⚙️ [execCommand] stderr chunk received, length: ${chunk.length}`);
      stderr += chunk;
    });

    process.on("close", (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        console.log(`⚙️ [execCommand] Process closed with code: ${code}`);
        
        if (code === 0) {
          console.log(`⚙️ [execCommand] Command succeeded, stdout length: ${stdout.length}`);
          if (stdout.length > 10000) {
            const truncated = stdout.substring(0, 10000) + "\n\n[... output truncated to 10,000 characters ...]";
            console.log(`⚙️ [execCommand] Output truncated from ${stdout.length} to 10,000 characters`);
            resolve(truncated);
          } else {
            resolve(stdout);
          }
        } else if (code === 1) {
          // ripgrep returns exit code 1 when no matches found
          console.log(`⚙️ [execCommand] No matches found (exit code 1)`);
          resolve("No matches found");
        } else {
          console.log(`⚙️ [execCommand] Command failed with stderr: ${stderr}`);
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      }
    });

    process.on("error", (error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        console.log(`⚙️ [execCommand] Process error:`, error);
        reject(error);
      }
    });
  });
}

// Get repository map using git ls-tree and tree
async function getRepoMap(repoPath: string): Promise<string> {
  console.log(`🗂️ [getRepoMap] Starting with repoPath: ${repoPath}`);

  if (!repoPath) {
    console.log(`🗂️ [getRepoMap] No repository path provided`);
    return "No repository path provided";
  }

  if (!fs.existsSync(repoPath)) {
    console.log(`🗂️ [getRepoMap] Repository not cloned yet: ${repoPath}`);
    return "Repository not cloned yet";
  }

  try {
    console.log(`🗂️ [getRepoMap] Executing git ls-tree command...`);
    // Use the exact command from the comment: git ls-tree -r --name-only HEAD | tree -L 3 --fromfile
    const result = await execCommand(
      "git ls-tree -r --name-only HEAD | tree -L 3 --fromfile",
      repoPath
    );
    console.log(
      `🗂️ [getRepoMap] Command completed successfully, result length: ${result.length}`
    );
    return result;
  } catch (error: any) {
    console.log(`🗂️ [getRepoMap] Error occurred: ${error.message}`);
    return `Error getting repo map: ${error.message}`;
  }
}

// Get file summary by reading first 40 lines
function getFileSummary(filePath: string, repoPath: string): string {
  console.log(
    `📄 [getFileSummary] Starting with filePath: ${filePath}, repoPath: ${repoPath}`
  );

  if (!repoPath) {
    console.log(`📄 [getFileSummary] No repository path provided`);
    return "No repository path provided";
  }

  const fullPath = path.join(repoPath, filePath);
  console.log(`📄 [getFileSummary] Full path: ${fullPath}`);

  if (!fs.existsSync(fullPath)) {
    console.log(`📄 [getFileSummary] File not found: ${fullPath}`);
    return "File not found";
  }

  try {
    console.log(`📄 [getFileSummary] Reading file content...`);
    const content = fs.readFileSync(fullPath, "utf-8");
    console.log(
      `📄 [getFileSummary] File read successfully, content length: ${content.length}`
    );

    const lines = content
      .split("\n")
      .slice(0, 40)
      .map((line) => {
        // Limit each line to 200 characters to handle minified files
        return line.length > 200 ? line.substring(0, 200) + "..." : line;
      });

    console.log(`📄 [getFileSummary] Processed ${lines.length} lines`);
    return lines.join("\n");
  } catch (error: any) {
    console.log(`📄 [getFileSummary] Error occurred: ${error.message}`);
    return `Error reading file: ${error.message}`;
  }
}

// Fulltext search using ripgrep
async function fulltextSearch(
  query: string,
  repoPath: string
): Promise<string> {
  console.log(
    `🔍 [fulltextSearch] Starting search for query: "${query}" in repoPath: ${repoPath}`
  );

  if (!repoPath) {
    console.log(`🔍 [fulltextSearch] No repository path provided`);
    return "No repository path provided";
  }

  if (!fs.existsSync(repoPath)) {
    console.log(`🔍 [fulltextSearch] Repository not cloned yet: ${repoPath}`);
    return "Repository not cloned yet";
  }

  try {
    console.log(`🔍 [fulltextSearch] Executing ripgrep command...`);

    // Use ripgrep with context lines, line numbers, and limits to prevent overwhelming output
    const result = await execCommand(
      `rg --glob '!dist' --ignore-file .gitignore -C 2 -n --max-count 10 --max-columns 200 "${query}"`,
      repoPath,
      5000
    );
    console.log(
      `🔍 [fulltextSearch] Search completed successfully, result length: ${result.length}`
    );

    // Limit the result to 10,000 characters to prevent overwhelming output
    if (result.length > 10000) {
      const truncated =
        result.substring(0, 10000) +
        "\n\n[... output truncated to 10,000 characters ...]";
      console.log(
        `🔍 [fulltextSearch] Result truncated from ${result.length} to 10,000 characters`
      );
      return truncated;
    }

    return result;
  } catch (error: any) {
    console.log(`🔍 [fulltextSearch] Error occurred: ${error.message}`);
    // Ripgrep returns exit code 1 when no matches found, which is not really an error
    if (error.message.includes("code 1")) {
      console.log(`🔍 [fulltextSearch] No matches found (this is normal)`);
      return `No matches found for "${query}"`;
    }
    return `Error searching: ${error.message}`;
  }
}

export interface GeneralContextResult {
  summary: string;
  key_files: string[];
  features: string[];
}

export async function get_context(
  prompt: string | ModelMessage[],
  repoPath: string
): Promise<string> {
  console.log(`🤖 [get_context] Starting exploration...`);
  console.log(
    `🤖 [get_context] Prompt type: ${typeof prompt}, RepoPath: ${repoPath}`
  );

  const provider = process.env.LLM_PROVIDER || "anthropic";
  console.log(`🤖 [get_context] Using provider: ${provider}`);

  const apiKey = getApiKeyForProvider(provider);
  console.log(`🤖 [get_context] API key available: ${!!apiKey}`);

  const model = await getModel(provider as Provider, apiKey as string);
  console.log(`🤖 [get_context] Model initialized successfully`);
  const tools = {
    repo_overview: tool({
      description:
        "Get a high-level view of the codebase architecture and structure. Use this to understand the project layout and identify where specific functionality might be located. Call this when you need to: 1) Orient yourself in an unfamiliar codebase, 2) Locate which directories/files might contain relevant code for a user's question, 3) Understand the overall project structure before diving deeper. Don't call this if you already know which specific files you need to examine.",
      inputSchema: z.object({}),
      execute: async () => {
        console.log(`🛠️ [repo_overview] Tool execution starting...`);
        try {
          const result = await getRepoMap(repoPath);
          console.log(
            `🛠️ [repo_overview] Tool execution completed successfully`
          );
          return result;
        } catch (e) {
          console.log(`🛠️ [repo_overview] Tool execution failed:`, e);
          return "Could not retrieve repository map";
        }
      },
    }),
    file_summary: tool({
      description:
        "Get a summary of what a specific file contains and its role in the codebase. Use this when you have identified a potentially relevant file and need to understand: 1) What functions/components it exports, 2) What its main responsibility is, 3) Whether it's worth exploring further for the user's question. The first 40 lines of the file will be returned. Call this with a hypothesis like 'This file probably handles user authentication' or 'This looks like the main dashboard component'. Don't call this to browse random files.",
      inputSchema: z.object({
        file_path: z.string().describe("Path to the file to summarize"),
        hypothesis: z
          .string()
          .describe(
            "What you think this file might contain or handle, based on its name/location"
          ),
      }),
      execute: async ({ file_path }: { file_path: string }) => {
        console.log(
          `🛠️ [file_summary] Tool execution starting for file: ${file_path}`
        );
        try {
          const result = getFileSummary(file_path, repoPath);
          console.log(
            `🛠️ [file_summary] Tool execution completed successfully`
          );
          return result;
        } catch (e) {
          console.log(`🛠️ [file_summary] Tool execution failed:`, e);
          return "Bad file path";
        }
      },
    }),
    fulltext_search: tool({
      description:
        "Search the entire codebase for a specific term. Use this when you need to find a specific function, component, or file. Call this when the user provided specific text that might be present in the codebase. For example, if the query is 'Add a subtitle to the User Journeys page', you could call this with the query \"User Journeys\". Don't call this if you do not have specific text to search for",
      inputSchema: z.object({
        query: z.string().describe("The term to search for"),
      }),
      execute: async ({ query }: { query: string }) => {
        console.log(
          `🛠️ [fulltext_search] Tool execution starting for query: "${query}"`
        );
        try {
          const result = await fulltextSearch(query, repoPath);
          console.log(
            `🛠️ [fulltext_search] Tool execution completed successfully`
          );
          return result;
        } catch (e) {
          console.log(`🛠️ [fulltext_search] Tool execution failed:`, e);
          return `Search failed: ${e}`;
        }
      },
    }),
    final_answer: tool({
      // The tool that signals the end of the process
      description: GENERAL_FINAL_ANSWER_DESCRIPTION,
      inputSchema: z.object({ answer: z.string() }),
      execute: async ({ answer }: { answer: string }) => {
        console.log(
          `🛠️ [final_answer] Tool execution - providing final answer`
        );
        return answer;
      },
    }),
  };
  console.log(`🤖 [get_context] Tools defined, preparing generateText call...`);

  const system = GENERAL_EXPLORER;
  console.log(`🤖 [get_context] System prompt loaded, calling generateText...`);

  const { steps } = await generateText({
    model,
    tools,
    prompt,
    system,
    stopWhen: hasToolCall("final_answer"),
    onStepFinish: (sf) => {
      console.log(`🤖 [get_context] Step finished, processing...`);
      logStep(sf.content);
    },
  });
  console.log(
    "🤖 [get_context] =================== DONE WITH EXPLORATION =================="
  );
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
    // console.log("step", JSON.stringify(step.content, null, 2));
    const final_answer = step.content.find((c) => {
      return c.type === "tool-result" && c.toolName === "final_answer";
    });
    if (final_answer) {
      final = (final_answer as any).output;
    }
  }
  if (!final && lastText) {
    console.warn(
      "No final_answer tool call detected; falling back to last reasoning text."
    );
    final = `${lastText}\n\n(Note: Model did not invoke final_answer tool; using last reasoning text as answer.)`;
  }
  // console.log("FINAL", final);
  return final;
}

// Test code removed - use get_context() directly when needed
setTimeout(() => {
  // return;
  // get_context(
  //   "What are the key features of this codebase?",
  //   "/Users/evanfeenstra/code/evanf/gitsee"
  // ).then((result) => {
  //   console.log("Context:", result);
  // });
  const cmd = `rg --glob '!dist' --ignore-file .gitignore -C 2 -n --max-count 10 --max-columns 200 "visualization"`;
  execCommand(cmd, "/Users/evanfeenstra/code/evanf/gitsee", 5000).then(
    (result) => {
      console.log("Search Result:", result);
    }
  ).catch(error => {
    console.log("Search Error:", error.message);
  });
}, 1000); // Keep the process alive for testing
