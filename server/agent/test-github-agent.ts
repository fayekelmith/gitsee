import { generateText, tool, hasToolCall, ModelMessage } from "ai";
import { getModel, getApiKeyForProvider, Provider } from "aieo";
import * as prompts from "./prompts";
import { z } from "zod";
import { RepoAnalyzer } from "../github/repo-analyzer";
import { config } from "dotenv";

config();

function logStep(contents: any) {
  if (!Array.isArray(contents)) return;
  for (const content of contents) {
    if (content.type === "tool-call" && content.toolName !== "final_answer") {
      console.log("TOOL CALL:", content.toolName, ":", content.input);
    }
    if (content.type === "tool-result" && content.toolName !== "final_answer") {
      console.log("TOOL RESULT:", content.toolName, ":", content.output);
    }
  }
}

export async function get_github_context(
  prompt: string | ModelMessage[],
  repoPath: string
): Promise<string> {
  const startTime = Date.now();
  const provider = process.env.LLM_PROVIDER || "anthropic";
  const apiKey = getApiKeyForProvider(provider);
  const model = await getModel(provider as Provider, apiKey as string);
  const repoArr = repoPath.split("/");
  const repoName = repoArr.pop() || "";
  const repoOwner = repoArr.pop() || "";
  const tools = {
    recent_commits: tool({
      description:
        "Query a repo for recent commits. The output is a list of recent commits.",
      inputSchema: z.object({}),
      execute: async () => {
        const analyzer = new RepoAnalyzer({
          githubToken: process.env.GITHUB_TOKEN,
        });
        return analyzer.getRecentCommitsWithFiles(repoOwner, repoName, {
          limit: 7,
        });
      },
    }),
    recent_contributions: tool({
      description:
        "Query a repo for recent PRs by a specific contributor. Input is the contributor's GitHub login. The output is a list of their most recent contributions, including PR titles, issue titles, commit messages, and code review comments.",
      inputSchema: z.object({ user: z.string() }),
      execute: async ({ user }: { user: string }) => {
        try {
          const analyzer = new RepoAnalyzer({
            githubToken: process.env.GITHUB_TOKEN,
          });
          const output = await analyzer.getContributorPRs(
            repoOwner,
            repoName,
            user,
            5
          );
          return output;
        } catch (e) {
          return "Could not retrieve repository map";
        }
      },
    }),
    final_answer: tool({
      // The tool that signals the end of the process
      description: prompts.generic.FINAL_ANSWER.trim(),
      inputSchema: z.object({ answer: z.string() }),
      execute: async ({ answer }: { answer: string }) => answer,
    }),
  };
  const { steps } = await generateText({
    model,
    tools,
    prompt,
    system: prompts.generic.EXPLORER,
    stopWhen: hasToolCall("final_answer"),
    onStepFinish: (sf) => logStep(sf.content),
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

  const endTime = Date.now();
  const duration = endTime - startTime;
  console.log(
    `⏱️ get_context completed in ${duration}ms (${(duration / 1000).toFixed(2)}s)`
  );

  return final;
}

// infra, dependencies/integratins, user stories, pages

// get_github_context(
//   "Summarize tomsmith8's role in this repo, in just 1-3 sentences. Be very brief.",
//   "/tmp/clones/stakwork/hive"
// ).then(console.log);

get_github_context(
  "Summarize the recent activity in this repo, in just 1-3 sentences. Be very brief.",
  "/tmp/clones/stakwork/hive"
).then(console.log);
