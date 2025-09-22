declare class GitVisualizer {
    private width;
    private height;
    private svg;
    private context;
    private panelContainer;
    private repositoryViz;
    private contributorsViz;
    private linksViz;
    private filesViz;
    private statsViz;
    private conceptsViz;
    private detailPanel;
    private sseClient;
    private allNodes;
    private allLinks;
    private currentRepoData;
    private currentOwner;
    private currentRepo;
    private mainVisualizationComplete;
    private pendingConcepts;
    private occupiedSpaces;
    private nodeDelay;
    private zoomSpeed;
    private spiralDistances;
    private apiEndpoint;
    private sseEndpoint;
    private apiHeaders;
    constructor(containerSelector?: string, apiEndpoint?: string, apiHeaders?: Record<string, string>, sseEndpoint?: string, nodeDelay?: number);
    private initializeVisualization;
    /**
     * 🔍 Collision Detection System
     */
    private getNodeRadius;
    private checkCollision;
    private findNonCollidingPosition;
    private registerOccupiedSpace;
    /**
     * 🌱 Universal Organic Positioning System
     * Calculates natural, plant-like growth positions for any node type
     */
    private calculateOrganicPositionRaw;
    private calculateOrganicPosition;
    private currentZoom;
    private calculateGradualZoomOut;
    private gradualZoomOut;
    visualize(owner: string, repo: string): Promise<void>;
    private fetchRepoData;
    private connectToSSE;
    private showExplorationStatus;
    private onExplorationComplete;
    private clearVisualization;
    private addResources;
    private addStatsAfterIcon;
    private addStatsSequentially;
    private addContributorsAfterStats;
    private addContributorsSequentially;
    private addFilesAfterContributors;
    private addFilesSequentially;
    private addConceptsSequentially;
    private addConceptNodesSequentially;
    setDimensions(width: number, height: number): void;
    private injectStyles;
    private showNodePanel;
    showDetailPanel(): void;
    hideDetailPanel(): void;
    toggleDetailPanel(): void;
    setApiEndpoint(apiEndpoint: string): void;
    setSseEndpoint(sseEndpoint: string): void;
    setEndpoints(apiEndpoint: string, sseEndpoint?: string): void;
    setApiHeaders(apiHeaders: Record<string, string>): void;
    getApiEndpoint(): string;
    getSseEndpoint(): string;
    getApiHeaders(): Record<string, string>;
    setNodeDelay(nodeDelay: number): void;
    getNodeDelay(): number;
    destroy(): void;
}

export { GitVisualizer };
