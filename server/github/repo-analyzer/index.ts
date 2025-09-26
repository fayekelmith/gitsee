import { BaseAnalyzer, RepoAnalyzerConfig } from "../base.js";
import { CommitAnalyzer } from "./commits.js";
import { PullRequestAnalyzer } from "./pull-requests.js";
import { RepositoryAnalyzer } from "./repository.js";
import { FileAnalyzer } from "./files.js";
import { IconAnalyzer } from "./icons.js";

export class RepoAnalyzer extends BaseAnalyzer {
  private commitAnalyzer: CommitAnalyzer;
  private prAnalyzer: PullRequestAnalyzer;
  private repoAnalyzer: RepositoryAnalyzer;
  private fileAnalyzer: FileAnalyzer;
  private iconAnalyzer: IconAnalyzer;

  constructor(config: RepoAnalyzerConfig = {}) {
    super(config);

    // Initialize all analyzers with the same config
    this.commitAnalyzer = new CommitAnalyzer(config);
    this.prAnalyzer = new PullRequestAnalyzer(config);
    this.repoAnalyzer = new RepositoryAnalyzer(config);
    this.fileAnalyzer = new FileAnalyzer(config);
    this.iconAnalyzer = new IconAnalyzer(config);
  }

  // Commit methods
  async getRecentCommits(...args: Parameters<CommitAnalyzer['getRecentCommits']>) {
    return this.commitAnalyzer.getRecentCommits(...args);
  }

  async getRecentCommitsWithFiles(...args: Parameters<CommitAnalyzer['getRecentCommitsWithFiles']>) {
    return this.commitAnalyzer.getRecentCommitsWithFiles(...args);
  }

  async getContributorCommits(...args: Parameters<CommitAnalyzer['getContributorCommits']>) {
    return this.commitAnalyzer.getContributorCommits(...args);
  }

  async getContributorFiles(...args: Parameters<CommitAnalyzer['getContributorFiles']>) {
    return this.commitAnalyzer.getContributorFiles(...args);
  }

  // Pull Request methods
  async getRecentPRs(...args: Parameters<PullRequestAnalyzer['getRecentPRs']>) {
    return this.prAnalyzer.getRecentPRs(...args);
  }

  async getContributorPRs(...args: Parameters<PullRequestAnalyzer['getContributorPRs']>) {
    return this.prAnalyzer.getContributorPRs(...args);
  }

  async getContributorReviews(...args: Parameters<PullRequestAnalyzer['getContributorReviews']>) {
    return this.prAnalyzer.getContributorReviews(...args);
  }

  async getPRDetails(...args: Parameters<PullRequestAnalyzer['getPRDetails']>) {
    return this.prAnalyzer.getPRDetails(...args);
  }

  async getRecentReviews(...args: Parameters<PullRequestAnalyzer['getRecentReviews']>) {
    return this.prAnalyzer.getRecentReviews(...args);
  }

  // Repository methods
  async getRepoInfo(...args: Parameters<RepositoryAnalyzer['getRepoInfo']>) {
    return this.repoAnalyzer.getRepoInfo(...args);
  }

  async getBranches(...args: Parameters<RepositoryAnalyzer['getBranches']>) {
    return this.repoAnalyzer.getBranches(...args);
  }

  async getContributors(...args: Parameters<RepositoryAnalyzer['getContributors']>) {
    return this.repoAnalyzer.getContributors(...args);
  }

  async getRepoStats(...args: Parameters<RepositoryAnalyzer['getRepoStats']>) {
    return this.repoAnalyzer.getRepoStats(...args);
  }

  // File methods
  async getKeyFiles(...args: Parameters<FileAnalyzer['getKeyFiles']>) {
    return this.fileAnalyzer.getKeyFiles(...args);
  }

  async getFileContent(...args: Parameters<FileAnalyzer['getFileContent']>) {
    return this.fileAnalyzer.getFileContent(...args);
  }

  // Icon methods
  async getRepoIcon(...args: Parameters<IconAnalyzer['getRepoIcon']>) {
    return this.iconAnalyzer.getRepoIcon(...args);
  }
}