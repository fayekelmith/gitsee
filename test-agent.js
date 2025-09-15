import { th } from "zod/locales";
import { get_context, RepoCloner } from "./server/agent/dist/index.js";
import "dotenv/config";

setTimeout(async () => {
  // Wait for repo to be cloned
  const owner = "stakwork";
  const repo = "hive";
  await RepoCloner.waitForClone(owner, repo);
  const cloneResult = await RepoCloner.getCloneResult(owner, repo);
  console.log("Clone result:", cloneResult);
  if (!cloneResult.success) {
    throw new Error("Failed to clone repo");
  }

  const localPath = cloneResult.localPath;

  get_context("How do I set up this project?", localPath, "services").then(
    (result) => {
      console.log("=============== FINAL RESULT: ===============");
      console.log(result);
    }
  );
});
