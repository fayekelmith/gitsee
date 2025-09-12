import { generateText, tool, hasToolCall, ModelMessage } from "ai";
import { getModel, getApiKeyForProvider, Provider } from "aieo";
import { GENERAL_EXPLORER, GENERAL_FINAL_ANSWER_DESCRIPTION } from "./prompts";
import { z } from "zod";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

function logStep(contents: any) {
  return;
  if (!Array.isArray(contents)) return;
  for (const content of contents) {
    if (content.type === "tool-call") {
      if (content.toolName === "final_answer") {
        console.log("FINAL ANSWER:", content.input.answer);
      } else {
        console.log("TOOL CALL:", content.toolName, ":", content.input);
      }
    }
    if (content.type === "tool-result") {
      if (content.toolName !== "repo_overview") {
        console.log(content.output);
      }
      // console.log("TOOL RESULT", content.toolName, content.output);
    }
  }
}

// Utility function to execute shell commands
function execCommand(command: string, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = command.split(" ");
    const process = spawn(cmd, args, { cwd, shell: true });

    let stdout = "";
    let stderr = "";

    process.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    process.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    process.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });
  });
}

// Get repository map using git ls-tree and tree
async function getRepoMap(repoPath: string): Promise<string> {
  if (!repoPath) {
    return "No repository path provided";
  }

  if (!fs.existsSync(repoPath)) {
    return "Repository not cloned yet";
  }

  try {
    // Use the exact command from the comment: git ls-tree -r --name-only HEAD | tree -L 3 --fromfile
    const result = await execCommand(
      "git ls-tree -r --name-only HEAD | tree -L 3 --fromfile",
      repoPath
    );
    return result;
  } catch (error: any) {
    return `Error getting repo map: ${error.message}`;
  }
}

// Get file summary by reading first 40 lines
function getFileSummary(filePath: string, repoPath: string): string {
  if (!repoPath) {
    return "No repository path provided";
  }

  const fullPath = path.join(repoPath, filePath);

  if (!fs.existsSync(fullPath)) {
    return "File not found";
  }

  try {
    const content = fs.readFileSync(fullPath, "utf-8");
    const lines = content
      .split("\n")
      .slice(0, 40)
      .map((line) => {
        // Limit each line to 200 characters to handle minified files
        return line.length > 200 ? line.substring(0, 200) + "..." : line;
      });
    return lines.join("\n");
  } catch (error: any) {
    return `Error reading file: ${error.message}`;
  }
}

// Fulltext search using ripgrep
async function fulltextSearch(
  query: string,
  repoPath: string
): Promise<string> {
  if (!repoPath) {
    return "No repository path provided";
  }

  if (!fs.existsSync(repoPath)) {
    return "Repository not cloned yet";
  }

  try {
    // Use ripgrep with context lines and line numbers
    const result = await execCommand(`rg -C 4 -n "${query}"`, repoPath);
    return result;
  } catch (error: any) {
    // Ripgrep returns exit code 1 when no matches found, which is not really an error
    if (error.message.includes("code 1")) {
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
  const provider = process.env.LLM_PROVIDER || "anthropic";
  const apiKey = getApiKeyForProvider(provider);
  const model = await getModel(provider as Provider, apiKey as string);
  // console.log("call claude:");
  const tools = {
    repo_overview: tool({
      description:
        "Get a high-level view of the codebase architecture and structure. Use this to understand the project layout and identify where specific functionality might be located. Call this when you need to: 1) Orient yourself in an unfamiliar codebase, 2) Locate which directories/files might contain relevant code for a user's question, 3) Understand the overall project structure before diving deeper. Don't call this if you already know which specific files you need to examine.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          return await getRepoMap(repoPath);
        } catch (e) {
          return "Could not retrieve repository map";
        }
      },
    }),
    file_summary: tool({
      description:
        "Get a summary of what a specific file contains and its role in the codebase. Use this when you have identified a potentially relevant file and need to understand: 1) What functions/components it exports, 2) What its main responsibility is, 3) Whether it's worth exploring further for the user's question. Functions, imports, and top-level variables will be returned with their name and first 10 lines of code. If a summary can't be generated, the first 40 lines of the file will be returned. Call this with a hypothesis like 'This file probably handles user authentication' or 'This looks like the main dashboard component'. Don't call this to browse random files.",
      inputSchema: z.object({
        file_path: z.string().describe("Path to the file to summarize"),
        hypothesis: z
          .string()
          .describe(
            "What you think this file might contain or handle, based on its name/location"
          ),
      }),
      execute: async ({ file_path }: { file_path: string }) => {
        try {
          return getFileSummary(file_path, repoPath);
        } catch (e) {
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
        try {
          return await fulltextSearch(query, repoPath);
        } catch (e) {
          return `Search failed: ${e}`;
        }
      },
    }),
    final_answer: tool({
      // The tool that signals the end of the process
      description: GENERAL_FINAL_ANSWER_DESCRIPTION,
      inputSchema: z.object({ answer: z.string() }),
      execute: async ({ answer }: { answer: string }) => answer,
    }),
  };
  const system = GENERAL_EXPLORER;
  const { steps } = await generateText({
    model,
    tools,
    prompt,
    system,
    stopWhen: hasToolCall("final_answer"),
    onStepFinish: (sf) => {
      // console.log("step", JSON.stringify(sf.content, null, 2));
      logStep(sf.content);
    },
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
