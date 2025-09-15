export { RepoCloner } from "./repo-cloner.js";
export type { CloneResult } from "./repo-cloner.js";
export { get_context } from "./explore.js";
export type {
  GeneralContextResult,
  FirstPassContextResult,
  RepoContextMode,
} from "./explore.js";
export { explore } from "./explore-wrapper.js";
export type { ExplorationResult } from "./explore-wrapper.js";

import { RepoCloner, CloneOptions } from "./repo-cloner.js";
import { get_context, RepoContextMode } from "./explore.js";

export async function clone_and_get_context(
  owner: string,
  repo: string,
  prompt: string,
  mode: RepoContextMode = "general",
  clone_options?: CloneOptions
): Promise<string> {
  await RepoCloner.waitForClone(owner, repo, clone_options);
  const cloneResult = await RepoCloner.getCloneResult(owner, repo);
  // console.log("Clone result:", cloneResult);
  if (!cloneResult?.success) {
    throw new Error("Failed to clone repo");
  }
  const localPath = cloneResult.localPath;
  const result = await get_context(prompt, localPath, mode);
  return result;
}
