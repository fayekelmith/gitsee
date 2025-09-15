import { IncomingMessage, ServerResponse } from 'http';
import { Octokit } from '@octokit/rest';

interface GitSeeRequest {
    owner: string;
    repo: string;
    data: ("contributors" | "icon" | "repo_info" | "commits" | "branches" | "files" | "stats" | "file_content" | "exploration")[];
    filePath?: string;
    explorationMode?: "general" | "first_pass";
    explorationPrompt?: string;
}
interface GitSeeResponse {
    repo?: any;
    contributors?: any[];
    icon?: string | null;
    commits?: any[];
    branches?: any[];
    files?: FileInfo[];
    fileContent?: FileContent | null;
    stats?: RepoStats;
    exploration?: ExplorationResult | {
        error: string;
    };
    error?: string;
    options?: {
        nodeDelay?: number;
    };
}
interface ExplorationResult {
    summary: string;
    key_files: string[];
    features?: string[];
    infrastructure?: string[];
    dependencies?: string[];
    user_stories?: string[];
    pages?: string[];
}
interface GitSeeOptions {
    token?: string;
    cache?: {
        ttl?: number;
    };
    visualization?: {
        nodeDelay?: number;
    };
}
interface Contributor {
    id: number;
    login: string;
    avatar_url: string;
    contributions: number;
    url?: string;
    html_url?: string;
    type?: string;
}
interface Repository {
    id: number;
    name: string;
    full_name: string;
    owner: {
        login: string;
        id: number;
        avatar_url: string;
    };
    description?: string;
    stargazers_count: number;
    forks_count: number;
    language?: string;
    created_at: string;
    updated_at: string;
    clone_url: string;
    html_url: string;
}
interface Commit {
    sha: string;
    commit: {
        author: {
            name: string;
            email: string;
            date: string;
        };
        message: string;
    };
    author: {
        login: string;
        avatar_url: string;
        id: number;
    } | null;
}
interface Branch {
    name: string;
    commit: {
        sha: string;
        url: string;
    };
    protected: boolean;
}
interface FileInfo {
    name: string;
    path: string;
    type: "package" | "config" | "docs" | "build" | "ci" | "data" | "other";
}
interface FileContent {
    name: string;
    path: string;
    content: string;
    encoding: string;
    size: number;
}
interface RepoStats {
    stars: number;
    totalPRs: number;
    totalCommits: number;
    ageInYears: number;
}

declare class GitSeeHandler {
    private octokit;
    private cache;
    private options;
    private store;
    private contributors;
    private icons;
    private repository;
    private commits;
    private branches;
    private files;
    private stats;
    constructor(options?: GitSeeOptions);
    handle(req: IncomingMessage, res: ServerResponse): Promise<void>;
    private autoStartFirstPassExploration;
    private runBackgroundExploration;
    private parseRequestBody;
    private processRequest;
}
declare function createGitSeeHandler(options?: GitSeeOptions): (req: IncomingMessage, res: ServerResponse) => Promise<void>;

declare class GitSeeCache {
    private cache;
    private ttl;
    constructor(ttl?: number);
    get(key: string): any | null;
    set(key: string, data: any): void;
    clear(): void;
}

declare abstract class BaseResource {
    protected octokit: Octokit;
    protected cache: GitSeeCache;
    constructor(octokit: Octokit, cache: GitSeeCache);
    protected getCacheKey(owner: string, repo: string, type: string): string;
    protected getCached<T>(owner: string, repo: string, type: string): Promise<T | undefined>;
    protected setCached<T>(owner: string, repo: string, type: string, data: T): void;
}

declare class ContributorsResource extends BaseResource {
    getContributors(owner: string, repo: string): Promise<Contributor[]>;
}

declare class IconsResource extends BaseResource {
    getRepoIcon(owner: string, repo: string): Promise<string | null>;
    private sortIconsByResolution;
}

declare class RepositoryResource extends BaseResource {
    getRepoInfo(owner: string, repo: string): Promise<Repository>;
}

declare class CommitsResource extends BaseResource {
    getCommits(owner: string, repo: string): Promise<Commit[]>;
}

declare class BranchesResource extends BaseResource {
    getBranches(owner: string, repo: string): Promise<Branch[]>;
}

export { BaseResource, type Branch, BranchesResource, type Commit, CommitsResource, type Contributor, ContributorsResource, GitSeeCache, GitSeeHandler, type GitSeeOptions, type GitSeeRequest, type GitSeeResponse, IconsResource, type Repository, RepositoryResource, createGitSeeHandler };
