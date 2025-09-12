import { Octokit } from '@octokit/rest';

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

interface RateLimit {
    rate: {
        limit: number;
        used: number;
        remaining: number;
        reset: number;
    };
}

export class GitHubAPI {
    private octokit: Octokit;
    
    constructor(token: string | null = null) {
        this.octokit = new Octokit({
            auth: token
        });
    }
    
    async getContributors(
        owner: string, 
        repo: string, 
        page: number = 1, 
        perPage: number = 30
    ): Promise<Contributor[]> {
        try {
            const response = await this.octokit.rest.repos.listContributors({
                owner,
                repo,
                page,
                per_page: perPage
            });
            
            return response.data as Contributor[];
        } catch (error) {
            console.error('Error fetching contributors:', error);
            throw error;
        }
    }
    
    async getRepository(owner: string, repo: string): Promise<Repository> {
        try {
            const response = await this.octokit.rest.repos.get({
                owner,
                repo
            });
            
            return response.data as Repository;
        } catch (error) {
            console.error('Error fetching repository:', error);
            throw error;
        }
    }
    
    async getCommits(
        owner: string, 
        repo: string, 
        page: number = 1, 
        perPage: number = 30
    ): Promise<Commit[]> {
        try {
            const response = await this.octokit.rest.repos.listCommits({
                owner,
                repo,
                page,
                per_page: perPage
            });
            
            return response.data as Commit[];
        } catch (error) {
            console.error('Error fetching commits:', error);
            throw error;
        }
    }
    
    async getBranches(owner: string, repo: string): Promise<Branch[]> {
        try {
            const response = await this.octokit.rest.repos.listBranches({
                owner,
                repo
            });
            
            return response.data as Branch[];
        } catch (error) {
            console.error('Error fetching branches:', error);
            throw error;
        }
    }
    
    async getRateLimit(): Promise<RateLimit> {
        try {
            const response = await this.octokit.rest.rateLimit.get();
            return response.data as RateLimit;
        } catch (error) {
            console.error('Error fetching rate limit:', error);
            throw error;
        }
    }
    
    async getRepoContents(owner: string, repo: string, path: string = ''): Promise<any[]> {
        try {
            const response = await this.octokit.rest.repos.getContent({
                owner,
                repo,
                path
            });
            
            if (Array.isArray(response.data)) {
                return response.data;
            } else {
                return [response.data];
            }
        } catch (error) {
            return [];
        }
    }
    
    async getFileContent(owner: string, repo: string, path: string): Promise<string | null> {
        try {
            const response = await this.octokit.rest.repos.getContent({
                owner,
                repo,
                path
            });
            
            if ('content' in response.data && response.data.content) {
                return `data:image/png;base64,${response.data.content}`;
            }
            
            return null;
        } catch (error) {
            return null; // File doesn't exist or no access
        }
    }
}