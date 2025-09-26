export interface RepoCommit {
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
  files?: CommitFile[];
}

export interface CommitFile {
  sha: string;
  filename: string;
  status: "added" | "modified" | "removed" | "renamed" | "copied" | "changed" | "unchanged";
  additions: number;
  deletions: number;
  changes: number;
  blob_url: string;
  raw_url: string;
  contents_url: string;
  patch?: string;
  previous_filename?: string;
}

export interface RepoPullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  user: {
    login: string;
    avatar_url: string;
    id: number;
  };
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  merge_commit_sha: string | null;
  assignees?: Array<{
    login: string;
    avatar_url: string;
    id: number;
    [key: string]: any;
  }> | null;
  requested_reviewers?: Array<{
    login: string;
    avatar_url: string;
    id: number;
    [key: string]: any;
  }> | null;
  head: {
    ref: string;
    sha: string;
    [key: string]: any;
  };
  base: {
    ref: string;
    sha: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface PRReview {
  id: number;
  user: {
    login: string;
    avatar_url: string;
    id: number;
  };
  body: string | null;
  state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED";
  submitted_at?: string;
  pull_request_url?: string;
  [key: string]: any;
}

export interface ContributorFile {
  filename: string;
  modifications: number;
  lastModified: string;
}

export interface RecentCommitsOptions {
  days?: number;
  limit?: number;
  author?: string;
  since?: string;
  until?: string;
}

export interface RecentPRsOptions {
  days?: number | null;
  limit?: number;
  state?: "open" | "closed" | "all";
  author?: string;
}

export interface RepoBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
  [key: string]: any;
}

export interface RepoStats {
  stars: number;
  totalPRs: number;
  totalCommits: number;
  ageInYears: number;
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