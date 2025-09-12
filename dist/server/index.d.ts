import { IncomingMessage, ServerResponse } from 'http';

interface GitSeeOptions {
    token?: string;
    cache?: {
        ttl?: number;
    };
}
declare class GitSeeHandler {
    private octokit;
    private cache;
    constructor(options?: GitSeeOptions);
    handle(req: IncomingMessage, res: ServerResponse): Promise<void>;
    private parseRequestBody;
    private processRequest;
    private getRepoInfo;
    private getContributors;
    private getCommits;
    private getBranches;
    private getRepoIcon;
    private sortIconsByResolution;
}
declare function createGitSeeHandler(options?: GitSeeOptions): (req: IncomingMessage, res: ServerResponse) => Promise<void>;

export { GitSeeHandler, createGitSeeHandler };
