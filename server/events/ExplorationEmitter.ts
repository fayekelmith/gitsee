import { EventEmitter } from 'events';
import { ExplorationResult } from '../persistence/index.js';
import { RepoContextMode } from '../agent/index.js';

export interface ExplorationEvent {
  type: 'clone_started' | 'clone_completed' | 'exploration_started' | 'exploration_progress' | 'exploration_completed' | 'exploration_failed';
  owner: string;
  repo: string;
  mode?: RepoContextMode;
  data?: any;
  error?: string;
  timestamp: number;
}

export class ExplorationEmitter extends EventEmitter {
  private static instance: ExplorationEmitter;

  static getInstance(): ExplorationEmitter {
    if (!this.instance) {
      this.instance = new ExplorationEmitter();
    }
    return this.instance;
  }

  private constructor() {
    super();
    this.setMaxListeners(100); // Allow many concurrent listeners
  }

  private getRepoKey(owner: string, repo: string): string {
    return `${owner}/${repo}`;
  }

  // Emit clone events
  emitCloneStarted(owner: string, repo: string): void {
    const event: ExplorationEvent = {
      type: 'clone_started',
      owner,
      repo,
      timestamp: Date.now()
    };

    this.emit(this.getRepoKey(owner, repo), event);
    console.log(`🔔 Emitted clone_started for ${owner}/${repo}`);
  }

  emitCloneCompleted(owner: string, repo: string, success: boolean, localPath?: string): void {
    const event: ExplorationEvent = {
      type: 'clone_completed',
      owner,
      repo,
      data: { success, localPath },
      timestamp: Date.now()
    };

    this.emit(this.getRepoKey(owner, repo), event);
    console.log(`🔔 Emitted clone_completed for ${owner}/${repo}: ${success ? 'success' : 'failed'}`);
  }

  // Emit exploration events
  emitExplorationStarted(owner: string, repo: string, mode: RepoContextMode): void {
    const event: ExplorationEvent = {
      type: 'exploration_started',
      owner,
      repo,
      mode,
      timestamp: Date.now()
    };

    this.emit(this.getRepoKey(owner, repo), event);
    console.log(`🔔 Emitted exploration_started for ${owner}/${repo} (${mode})`);
  }

  emitExplorationProgress(owner: string, repo: string, mode: RepoContextMode, progress: string): void {
    const event: ExplorationEvent = {
      type: 'exploration_progress',
      owner,
      repo,
      mode,
      data: { progress },
      timestamp: Date.now()
    };

    this.emit(this.getRepoKey(owner, repo), event);
    console.log(`🔔 Emitted exploration_progress for ${owner}/${repo} (${mode}): ${progress}`);
  }

  emitExplorationCompleted(owner: string, repo: string, mode: RepoContextMode, result: ExplorationResult): void {
    const event: ExplorationEvent = {
      type: 'exploration_completed',
      owner,
      repo,
      mode,
      data: { result },
      timestamp: Date.now()
    };

    this.emit(this.getRepoKey(owner, repo), event);
    console.log(`🔔 Emitted exploration_completed for ${owner}/${repo} (${mode})`);
  }

  emitExplorationFailed(owner: string, repo: string, mode: RepoContextMode, error: string): void {
    const event: ExplorationEvent = {
      type: 'exploration_failed',
      owner,
      repo,
      mode,
      error,
      timestamp: Date.now()
    };

    this.emit(this.getRepoKey(owner, repo), event);
    console.log(`🔔 Emitted exploration_failed for ${owner}/${repo} (${mode}): ${error}`);
  }

  // Subscribe to repository events
  subscribeToRepo(owner: string, repo: string, callback: (event: ExplorationEvent) => void): () => void {
    const repoKey = this.getRepoKey(owner, repo);
    this.on(repoKey, callback);

    console.log(`📡 New subscriber for ${owner}/${repo} (total: ${this.listenerCount(repoKey)})`);

    // Emit connection established event for potential cached data handling
    this.emit(`connection:${repoKey}`, { owner, repo });

    // Return unsubscribe function
    return () => {
      this.removeListener(repoKey, callback);
      console.log(`📡 Unsubscribed from ${owner}/${repo} (remaining: ${this.listenerCount(repoKey)})`);
    };
  }

  // Wait for at least one SSE connection
  waitForConnection(owner: string, repo: string, timeoutMs: number = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const repoKey = this.getRepoKey(owner, repo);

      // Check if already connected
      if (this.listenerCount(repoKey) > 0) {
        resolve();
        return;
      }

      // Wait for connection
      const timeout = setTimeout(() => {
        this.removeListener(`connection:${repoKey}`, onConnection);
        reject(new Error(`Timeout waiting for SSE connection to ${owner}/${repo}`));
      }, timeoutMs);

      const onConnection = () => {
        clearTimeout(timeout);
        this.removeListener(`connection:${repoKey}`, onConnection);
        resolve();
      };

      this.once(`connection:${repoKey}`, onConnection);
    });
  }

  // Get current listener count for debugging
  getListenerCount(owner: string, repo: string): number {
    return this.listenerCount(this.getRepoKey(owner, repo));
  }

  // Cleanup old listeners (optional)
  cleanupRepo(owner: string, repo: string): void {
    const repoKey = this.getRepoKey(owner, repo);
    this.removeAllListeners(repoKey);
    console.log(`🧹 Cleaned up all listeners for ${owner}/${repo}`);
  }
}