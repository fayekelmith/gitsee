export interface ExplorationSSEEvent {
  type: 'connected' | 'clone_started' | 'clone_completed' | 'exploration_started' | 'exploration_progress' | 'exploration_completed' | 'exploration_failed' | 'heartbeat';
  owner: string;
  repo: string;
  mode?: 'general' | 'first_pass';
  data?: any;
  error?: string;
  timestamp: number;
}

export type SSEEventHandler = (event: ExplorationSSEEvent) => void;

export class SSEClient {
  private eventSource: EventSource | null = null;
  private eventHandlers: Map<string, SSEEventHandler[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second

  constructor(
    private baseUrl: string = '/api/gitsee'
  ) {}

  /**
   * Connect to SSE stream for a specific repository
   */
  connect(owner: string, repo: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Close existing connection if any
        this.disconnect();

        const sseUrl = `${this.baseUrl}/events/${owner}/${repo}`;
        console.log(`📡 Connecting to SSE: ${sseUrl}`);

        this.eventSource = new EventSource(sseUrl);

        this.eventSource.onopen = () => {
          console.log(`✅ SSE connected to ${owner}/${repo}`);
          console.log(`📊 EventSource readyState: ${this.eventSource?.readyState} (OPEN=1)`);
          this.reconnectAttempts = 0; // Reset on successful connection
          resolve();
        };

        this.eventSource.onmessage = (event) => {
          try {
            const data: ExplorationSSEEvent = JSON.parse(event.data);
            console.log(`📨 SSE event received:`, data.type, data);

            // Emit to all registered handlers
            const handlers = this.eventHandlers.get(data.type) || [];
            const allHandlers = this.eventHandlers.get('*') || [];

            [...handlers, ...allHandlers].forEach(handler => {
              try {
                handler(data);
              } catch (error) {
                console.error('Error in SSE event handler:', error);
              }
            });

          } catch (error) {
            console.error('Error parsing SSE message:', error, event.data);
          }
        };

        this.eventSource.onerror = (error) => {
          console.error(`💥 SSE connection error for ${owner}/${repo}:`, error);

          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

            console.log(`🔄 Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

            setTimeout(() => {
              this.connect(owner, repo).catch(console.error);
            }, delay);
          } else {
            console.error(`❌ Max reconnection attempts reached for ${owner}/${repo}`);
            reject(new Error('Failed to connect to SSE after multiple attempts'));
          }
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from SSE stream
   */
  disconnect(): void {
    if (this.eventSource) {
      console.log('📡 Disconnecting SSE');
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  /**
   * Register event handler for specific event types
   */
  on(eventType: string, handler: SSEEventHandler): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }

    this.eventHandlers.get(eventType)!.push(handler);
    console.log(`📝 Registered handler for '${eventType}' events`);

    // Return unsubscribe function
    return () => {
      const handlers = this.eventHandlers.get(eventType);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
          console.log(`📝 Unregistered handler for '${eventType}' events`);
        }
      }
    };
  }

  /**
   * Register handler for all events
   */
  onAll(handler: SSEEventHandler): () => void {
    return this.on('*', handler);
  }

  /**
   * Remove all event handlers for a specific event type
   */
  off(eventType: string): void {
    this.eventHandlers.delete(eventType);
    console.log(`📝 Removed all handlers for '${eventType}' events`);
  }

  /**
   * Remove all event handlers
   */
  offAll(): void {
    this.eventHandlers.clear();
    console.log('📝 Removed all event handlers');
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }

  /**
   * Get connection state
   */
  getState(): number {
    return this.eventSource?.readyState ?? EventSource.CLOSED;
  }

  /**
   * Convenience methods for common event types
   */
  onCloneStarted(handler: SSEEventHandler): () => void {
    return this.on('clone_started', handler);
  }

  onCloneCompleted(handler: SSEEventHandler): () => void {
    return this.on('clone_completed', handler);
  }

  onExplorationStarted(handler: SSEEventHandler): () => void {
    return this.on('exploration_started', handler);
  }

  onExplorationProgress(handler: SSEEventHandler): () => void {
    return this.on('exploration_progress', handler);
  }

  onExplorationCompleted(handler: SSEEventHandler): () => void {
    return this.on('exploration_completed', handler);
  }

  onExplorationFailed(handler: SSEEventHandler): () => void {
    return this.on('exploration_failed', handler);
  }
}