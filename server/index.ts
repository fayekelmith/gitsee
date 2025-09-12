// Main exports for the GitSee server library
export { GitSeeHandler, createGitSeeHandler } from "./handler.js";

// Export types for library consumers
export type {
  GitSeeRequest,
  GitSeeResponse,
  GitSeeOptions,
  Contributor,
  Repository,
  Commit,
  Branch
} from "./types/index.js";

// Export resource classes for advanced usage
export {
  BaseResource,
  ContributorsResource,
  IconsResource,
  RepositoryResource,
  CommitsResource,
  BranchesResource
} from "./resources/index.js";

// Export utilities
export { GitSeeCache } from "./utils/cache.js";