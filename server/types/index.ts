export interface GitSeeRequest {
  owner: string;
  repo: string;
  data: ('contributors' | 'icon' | 'repo_info' | 'commits' | 'branches' | 'files')[];
}

export interface GitSeeResponse {
  repo?: any;
  contributors?: any[];
  icon?: string | null;
  commits?: any[];
  branches?: any[];
  files?: FileInfo[];
  error?: string;
  options?: {
    contributorDelay?: number;
  };
}

export interface GitSeeOptions {
  token?: string;
  cache?: {
    ttl?: number; // seconds
  };
  visualization?: {
    contributorDelay?: number; // milliseconds between contributor additions
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
  type: 'package' | 'config' | 'docs' | 'build' | 'ci' | 'data' | 'other';
}