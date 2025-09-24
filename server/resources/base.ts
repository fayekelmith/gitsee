import { GitSeeCache } from "../utils/cache.js";

export abstract class BaseResource {
  protected cache: GitSeeCache;

  constructor(cache: GitSeeCache) {
    this.cache = cache;
  }

  protected getCacheKey(owner: string, repo: string, type: string): string {
    return `${type}:${owner}/${repo}`;
  }

  protected async getCached<T>(
    owner: string,
    repo: string,
    type: string,
  ): Promise<T | undefined> {
    const cacheKey = this.getCacheKey(owner, repo, type);
    return this.cache.get(cacheKey);
  }

  protected setCached<T>(
    owner: string,
    repo: string,
    type: string,
    data: T,
  ): void {
    const cacheKey = this.getCacheKey(owner, repo, type);
    this.cache.set(cacheKey, data);
  }
}
