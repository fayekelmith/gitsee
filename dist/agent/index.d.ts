import { ModelMessage } from 'ai';

interface CloneResult {
    success: boolean;
    localPath: string;
    error?: string;
    duration?: number;
}
declare class RepoCloner {
    private static readonly BASE_PATH;
    private static clonePromises;
    /**
     * Clone a repository in the background (fire-and-forget)
     */
    static cloneInBackground(owner: string, repo: string): Promise<void>;
    /**
     * Clone a repository to /tmp/gitsee/{owner}/{repo}
     */
    static cloneRepo(owner: string, repo: string): Promise<CloneResult>;
    /**
     * Execute git clone command with shallow clone and single branch
     */
    private static executeGitClone;
    /**
     * Check if a repository is already cloned
     */
    static isRepoCloned(owner: string, repo: string): boolean;
    /**
     * Get the local path for a repository
     */
    static getRepoPath(owner: string, repo: string): string;
    /**
     * Wait for a repository clone to complete
     */
    static waitForClone(owner: string, repo: string): Promise<CloneResult>;
    /**
     * Get clone result if available (non-blocking)
     */
    static getCloneResult(owner: string, repo: string): Promise<CloneResult | null>;
    /**
     * Clean up old repositories (optional utility)
     */
    static cleanupOldRepos(maxAgeHours?: number): Promise<void>;
}

type RepoContextMode = "first_pass" | "general" | "services";
interface GeneralContextResult {
    summary: string;
    key_files: string[];
    features: string[];
}
interface FirstPassContextResult {
    summary: string;
    key_files: string[];
    infrastructure: string[];
    dependencies: string[];
    user_stories: string[];
    pages: string[];
}
declare function get_context(prompt: string | ModelMessage[], repoPath: string, mode?: RepoContextMode): Promise<string>;

type ExplorationResult = GeneralContextResult | FirstPassContextResult | string;
declare function explore(prompt: string | any[], repoPath: string, mode?: RepoContextMode): Promise<ExplorationResult>;

export { type CloneResult, type ExplorationResult, type FirstPassContextResult, type GeneralContextResult, RepoCloner, type RepoContextMode, explore, get_context };
