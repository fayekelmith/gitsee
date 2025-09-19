export { RepoCloner } from "./repo-cloner.js";
export type { CloneResult, CloneOptions } from "./repo-cloner.js";
export { get_context } from "./explore.js";
export type {
  FeaturesContextResult,
  FirstPassContextResult,
  RepoContextMode,
} from "./explore.js";
export { explore } from "./explore-wrapper.js";
export type { ExplorationResult } from "./explore-wrapper.js";
export { parse_files_contents } from "./utils.js";

import { parse_files_contents } from "./utils.js";
import { RepoCloner, CloneOptions } from "./repo-cloner.js";
import { get_context, RepoContextMode } from "./explore.js";

export interface Overrides {
  system_prompt?: string;
  final_answer_description?: string;
}

export async function clone_and_explore(
  owner: string,
  repo: string,
  prompt: string,
  mode: RepoContextMode = "features",
  clone_options?: CloneOptions,
  overrides?: Overrides
): Promise<string> {
  await RepoCloner.waitForClone(owner, repo, clone_options);
  const cloneResult = await RepoCloner.getCloneResult(owner, repo);
  // console.log("Clone result:", cloneResult);
  if (!cloneResult?.success) {
    throw new Error("Failed to clone repo");
  }
  const localPath = cloneResult.localPath;
  const result = await get_context(
    prompt,
    localPath,
    mode,
    overrides?.system_prompt,
    overrides?.final_answer_description
  );
  return result;
}

export async function clone_and_explore_parse_files(
  owner: string,
  repo: string,
  prompt: string,
  mode: RepoContextMode = "features",
  clone_options?: CloneOptions
): Promise<{ [k: string]: string }> {
  const result = await clone_and_explore(
    owner,
    repo,
    prompt,
    mode,
    clone_options
  );
  return parse_files_contents(result);
}

setTimeout(async () => {
  return;
  console.log("======> clone_and_explore_parse_files <======");
  const result = await clone_and_explore_parse_files(
    "stakwork",
    "hive",
    "How do I set up this project?",
    "services"
  );
  console.log("=============== FINAL RESULT: ===============");
  console.log(result);
});
