import { CloneOptions } from "../agent/index.js";

export interface GitSeeRequest {
  owner: string;
  repo: string;
  data: (
    | "contributors"
    | "icon"
    | "repo_info"
    | "commits"
    | "branches"
    | "files"
    | "stats"
    | "file_content"
    | "exploration"
  )[];
  filePath?: string; // Required when requesting file_content
  explorationMode?: "general" | "first_pass"; // Type of exploration to run
  explorationPrompt?: string; // Custom prompt for exploration
  // Optional clone options for private repos, auth, or different branches
  cloneOptions?: CloneOptions;
}

export interface GitSeeResponse {
  repo?: any;
  contributors?: any[];
  icon?: string | null;
  commits?: any[];
  branches?: any[];
  files?: FileInfo[];
  fileContent?: FileContent | null;
  stats?: RepoStats;
  exploration?: ExplorationResult | { error: string } | string;
  error?: string;
  options?: {
    nodeDelay?: number;
  };
}

export interface ExplorationResult {
  summary: string;
  key_files: string[];
  features?: string[]; // For general mode
  infrastructure?: string[]; // For first_pass mode
  dependencies?: string[]; // For first_pass mode
  user_stories?: string[]; // For first_pass mode
  pages?: string[]; // For first_pass mode
}

export interface GitSeeOptions {
  token?: string;
  cache?: {
    ttl?: number; // seconds
  };
  visualization?: {
    nodeDelay?: number; // milliseconds between node additions (contributors, files, etc.)
  };
}

export interface Contributor {
  id: number;
  login: string;
  avatar_url: string;
  contributions: number;
  url?: string;
  html_url?: string;
  type?: string;
}

export interface Repository {
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

export interface Commit {
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

export interface Branch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

export interface FileInfo {
  name: string;
  path: string;
  type: "package" | "config" | "docs" | "build" | "ci" | "data" | "other";
}

export interface FileContent {
  name: string;
  path: string;
  content: string;
  encoding: string;
  size: number;
}

export interface RepoStats {
  stars: number;
  totalPRs: number;
  totalCommits: number;
  ageInYears: number;
}
