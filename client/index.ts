import * as d3 from "d3";
import {
  NodeData,
  LinkData,
  ApiResponse,
  VisualizationContext,
  ResourceData,
} from "./types/index.js";
import {
  RepositoryVisualization,
  ContributorsVisualization,
  LinksVisualization,
  FilesVisualization,
  StatsVisualization,
  ConceptVisualization,
} from "./resources/index.js";
import { DetailPanel } from "./panel/index.js";
import { SSEClient } from "./events/index.js";

class GitVisualizer {
  private width: number;
  private height: number;
  private svg: any;
  private context!: VisualizationContext;
  private panelContainer!: HTMLElement;

  // Resource visualizations
  private repositoryViz!: RepositoryVisualization;
  private contributorsViz!: ContributorsVisualization;
  private linksViz!: LinksVisualization;
  private filesViz!: FilesVisualization;
  private statsViz!: StatsVisualization;
  private conceptsViz!: ConceptVisualization;

  // Detail panel
  private detailPanel!: DetailPanel;

  // SSE client for real-time updates
  private sseClient!: SSEClient;

  // Data storage
  private allNodes: NodeData[] = [];
  private allLinks: LinkData[] = [];
  private currentRepoData: any = null;
  private currentOwner: string = "";
  private currentRepo: string = "";
  private mainVisualizationComplete: boolean = false;
  private pendingConcepts: any = null;

  // Collision detection system
  private occupiedSpaces: Array<{
    x: number;
    y: number;
    radius: number;
    nodeId: string;
  }> = [];

  // Configurable timing and animation
  private nodeDelay: number = 800;
  private zoomSpeed: number = 1; // 1 = normal, 2 = faster, 0.5 = slower

  // Spiral positioning configuration - distances from base radius
  private spiralDistances = {
    repo: 40, // Repository nodes (not used much since repo is centered)
    contributor: 40, // Contributors start close to center
    stat: 40, // Stats close to center
    concept: 80, // Reduced from 140 - concepts need tighter spiral steps
    file: 80, // Files farther out for better separation
    default: 40, // Fallback for any other node types
  };

  // API configuration
  private apiEndpoint: string;
  private sseEndpoint: string;
  private apiHeaders: Record<string, string>;

  constructor(
    containerSelector: string = "#visualization",
    apiEndpoint: string = "/api/gitsee",
    apiHeaders: Record<string, string> = {},
    sseEndpoint?: string,
    nodeDelay: number = 800
  ) {
    const originalContainer = d3.select(containerSelector);
    const containerNode = originalContainer.node() as Element;

    // Store the API configuration
    this.apiEndpoint = apiEndpoint;
    this.sseEndpoint = sseEndpoint || apiEndpoint; // Use apiEndpoint as fallback for SSE
    this.apiHeaders = {
      "Content-Type": "application/json",
      ...apiHeaders, // User headers override defaults
    };

    // Store the node delay configuration
    this.nodeDelay = nodeDelay;

    if (!containerNode) {
      throw new Error(`Container element not found: ${containerSelector}`);
    }

    // Get dimensions from container element, not window
    const rect = containerNode.getBoundingClientRect();
    this.width = rect.width || 800; // fallback width
    this.height = rect.height || 600; // fallback height

    // Create a wrapper div for the SVG and panel if we're dealing with an SVG element
    if (containerNode.tagName === 'svg') {
      // Get the parent of the SVG
      const parent = d3.select(containerNode.parentNode as Element);

      // Create wrapper div
      const wrapper = parent.insert("div", () => containerNode)
        .style("position", "relative")
        .style("width", this.width + "px")
        .style("height", this.height + "px")
        .style("overflow", "hidden");

      // Move the SVG into the wrapper
      wrapper.node()!.appendChild(containerNode);

      this.svg = originalContainer;
      this.panelContainer = wrapper.node() as HTMLElement;
    } else {
      // If it's already a div, just use it directly
      originalContainer.style("position", "relative").style("overflow", "hidden");
      this.svg = originalContainer.append("svg");
      this.panelContainer = containerNode as HTMLElement;
    }

    this.svg.attr("width", this.width).attr("height", this.height);

    // Inject required CSS styles for the library
    this.injectStyles();

    this.initializeVisualization();
  }

  private initializeVisualization(): void {
    // Create zoom behavior
    const zoom = d3
      .zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event: any) => {
        this.context.container.attr("transform", event.transform.toString());
      });

    this.svg.call(zoom);

    // Create main container (no more physics simulation!)
    const container = this.svg.append("g").attr("class", "main-container");

    // Create visualization context
    this.context = {
      svg: this.svg,
      container,
      zoom,
      width: this.width,
      height: this.height,
    };

    // Initialize resource visualizations
    this.repositoryViz = new RepositoryVisualization(
      this.context,
      (nodeData) => {
        // Show detail panel when repo node is clicked
        this.showNodePanel(nodeData);
      }
    );
    this.contributorsViz = new ContributorsVisualization(
      this.context,
      (nodeData) => {
        // Show contributor panel when contributor node is clicked
        this.showNodePanel(nodeData);
      }
    );
    this.linksViz = new LinksVisualization(this.context);
    this.filesViz = new FilesVisualization(
      this.context,
      (nodeData) => {
        // Show file panel when file node is clicked
        this.showNodePanel(nodeData);
      },
      this.apiEndpoint,
      this.apiHeaders
    );
    this.statsViz = new StatsVisualization(this.context, (nodeData) => {
      // Stats click also shows repo panel
      this.showNodePanel(nodeData);
    });
    this.conceptsViz = new ConceptVisualization(this.context, (nodeData) => {
      // Concepts click also shows repo panel
      this.showNodePanel(nodeData);
    });

    // Initialize detail panel - pass wrapper container
    this.detailPanel = new DetailPanel(this.panelContainer);

    // Initialize SSE client with separate endpoint
    this.sseClient = new SSEClient(this.sseEndpoint);

    // Create links group first to ensure it's at the bottom
    this.linksViz["getResourceGroup"]();
  }

  /**
   * 🔍 Collision Detection System
   */
  private getNodeRadius(
    nodeType: string,
    contributions?: number,
    nodeData?: NodeData
  ): number {
    if (nodeType === "repo") return 35;
    if (nodeType === "file") return 18; // Files are rectangular but use this for collision
    if (nodeType === "stat") return 22; // Stats are circles
    if (nodeType === "concept") {
      // Concepts are rectangles - use a much smaller effective radius
      // Since we know the largest is 125x25, let's be more conservative
      if (nodeData && nodeData.name) {
        const textLength = nodeData.name.length;
        const estimatedWidth = textLength * 7 + 16; // ~7px per char + 16px padding
        // Use height-based radius since concepts are much wider than tall
        // This creates smaller collision zones that are more realistic
        return 20; // Fixed small radius for all concepts
      }
      return 20; // Much smaller fallback
    }
    // For contributors, calculate size based on contributions
    const baseRadius = 16;
    const maxRadius = 22;
    const contribCount = contributions || 0;
    return Math.min(baseRadius + contribCount * 0.1, maxRadius);
  }

  private checkCollision(
    x: number,
    y: number,
    radius: number,
    nodeType?: string
  ): boolean {
    return this.occupiedSpaces.some((space) => {
      const dx = x - space.x;
      const dy = y - space.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Enhanced buffer system - lenient only for concepts
      let buffer = 25; // Normal base buffer for non-concepts

      // Special handling for concepts
      if (nodeType === "concept") {
        if (space.nodeId.startsWith("concept-")) {
          // Concept to concept: smaller buffer since they're rectangles
          buffer = 15; // Lenient for concept-to-concept
        } else if (space.nodeId.startsWith("file-")) {
          // Concept to file: larger buffer to prevent overlap
          buffer = 35;
        } else {
          // Concept to other nodes: normal buffer
          buffer = 25;
        }
      } else if (space.nodeId.startsWith("concept-")) {
        // Other nodes to concepts: larger buffer for files
        buffer = nodeType === "file" ? 35 : 20;
      } else {
        // Non-concept to non-concept: use larger buffer for good spacing
        if (
          nodeType === "contributor" ||
          space.nodeId.startsWith("contributor-")
        ) {
          buffer = 40; // Contributors need good spacing
        } else if (nodeType === "file" || space.nodeId.startsWith("file-")) {
          buffer = 35; // Files need good spacing
        } else if (nodeType === "stat" || space.nodeId.startsWith("stat-")) {
          buffer = 30; // Stats need good spacing
        }
      }

      const minDistance = radius + space.radius + buffer;
      return distance < minDistance;
    });
  }

  private findNonCollidingPosition(
    nodeType: string,
    index: number,
    contributions?: number,
    nodeData?: NodeData
  ): { x: number; y: number } {
    const radius = this.getNodeRadius(nodeType, contributions, nodeData);
    const centerX = this.width / 2;
    const centerY = this.height / 2;

    // Try the organic position first
    let position = this.calculateOrganicPositionRaw(nodeType, index);

    // If no collision, use it
    if (!this.checkCollision(position.x, position.y, radius, nodeType)) {
      return position;
    }

    // If collision, try spiraling outward from the original position
    const spiralStep = nodeType === "concept" ? 25 : 20; // Smaller steps for more attempts
    // Use configured spiral distance for this node type
    const spiralDistance =
      this.spiralDistances[nodeType as keyof typeof this.spiralDistances] ||
      this.spiralDistances.default;
    let spiralRadius = radius + spiralDistance;
    let attempts = 0;
    const maxAttempts = nodeType === "concept" ? 200 : 50; // Reasonable attempts for concepts

    while (attempts < maxAttempts) {
      const angleStep = (Math.PI * 2) / 16; // 16 positions per ring for more options

      for (let i = 0; i < 16; i++) {
        const angle = i * angleStep;
        const testX = position.x + Math.cos(angle) * spiralRadius;
        const testY = position.y + Math.sin(angle) * spiralRadius;

        // Keep within screen bounds with more margin for concepts
        const margin = nodeType === "concept" ? radius * 1.5 : radius;
        if (
          testX < margin ||
          testX > this.width - margin ||
          testY < margin ||
          testY > this.height - margin
        ) {
          continue;
        }

        if (!this.checkCollision(testX, testY, radius, nodeType)) {
          console.log(
            `🌀 Found collision-free position for ${nodeType} after ${attempts + 1} attempts at radius ${Math.round(spiralRadius)}`
          );
          return { x: testX, y: testY };
        }
      }

      spiralRadius += spiralStep;
      attempts++;
    }

    console.warn(
      `⚠️ Could not find collision-free position for ${nodeType} after ${maxAttempts} attempts, using original`
    );
    return position;
  }

  private registerOccupiedSpace(
    x: number,
    y: number,
    radius: number,
    nodeId: string
  ): void {
    this.occupiedSpaces.push({ x, y, radius, nodeId });
  }

  /**
   * 🌱 Universal Organic Positioning System
   * Calculates natural, plant-like growth positions for any node type
   */
  private calculateOrganicPositionRaw(
    nodeType: string,
    index: number
  ): { x: number; y: number } {
    const centerX = this.width / 2;
    const centerY = this.height / 2;

    // Zone distances by node type (expandable for future node types)
    const zones = {
      repo: { min: 0, max: 0 }, // Center
      stat: { min: 55, max: 75 }, // Close to repo - stats first!
      contributor: { min: 90, max: 130 }, // Contributors after stats
      file: { min: 150, max: 190 }, // Outer ring for files
      concept: { min: 240, max: 300 }, // Expanded zone with more breathing room
      story: { min: 190, max: 230 }, // Future: user stories
      function: { min: 230, max: 270 }, // Future: functions
      component: { min: 270, max: 310 }, // Future: components
      schema: { min: 310, max: 350 }, // Future: schemas
    };

    const zone = zones[nodeType as keyof typeof zones] || zones["contributor"];

    // Repository stays at center
    if (nodeType === "repo") {
      return { x: centerX, y: centerY };
    }

    // Golden angle for natural spiral (~137.5 degrees)
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    // Special angle handling for concepts to improve horizontal distribution
    let angle;
    if (nodeType === "concept") {
      // Use golden angle but with larger spacing multiplier for concepts
      const conceptAngleMultiplier = 1.8; // Spread concepts out more than other nodes
      const baseAngle = index * goldenAngle * conceptAngleMultiplier;
      const randomOffset = (Math.random() - 0.5) * 0.2; // Small randomness for natural look
      angle = baseAngle + randomOffset;
    } else {
      // Base angle with golden spiral + some randomness for other node types
      const baseAngle = index * goldenAngle;
      const randomOffset = (Math.random() - 0.5) * 0.5; // ±15 degrees randomness
      angle = baseAngle + randomOffset;
    }

    // Distance with zone variation + randomness
    const baseDistance = zone.min + (zone.max - zone.min) * Math.random();
    const distanceVariation = (Math.random() - 0.5) * 40; // ±20px variation
    const distance = baseDistance + distanceVariation;

    // Calculate position
    const x = centerX + Math.cos(angle) * distance;
    const y = centerY + Math.sin(angle) * distance;

    console.log(
      `🌱 ${nodeType}[${index}] positioned at (${Math.round(x)}, ${Math.round(y)}) - distance: ${Math.round(distance)}`
    );

    return { x, y };
  }

  // Public interface that includes collision detection
  private calculateOrganicPosition(
    nodeType: string,
    index: number,
    contributions?: number,
    nodeData?: NodeData
  ): { x: number; y: number } {
    return this.findNonCollidingPosition(
      nodeType,
      index,
      contributions,
      nodeData
    );
  }

  private currentZoom: number = 1.0; // Track current zoom level

  private calculateGradualZoomOut(): number {
    // Configurable zoom speed - zoomSpeed of 1 = 1% reduction, 2 = 2% reduction, etc.
    const zoomFactor = 1 - this.zoomSpeed * 0.01;
    this.currentZoom *= zoomFactor;

    // Don't go below 0.1x zoom
    return Math.max(this.currentZoom, 0.1);
  }

  private gradualZoomOut(): void {
    const targetZoom = this.calculateGradualZoomOut();

    // Keep repository at exact screen center - no recentering!
    const repoX = this.width / 2;
    const repoY = this.height / 2;

    const transform = d3.zoomIdentity
      .translate(repoX, repoY)
      .scale(targetZoom)
      .translate(-repoX, -repoY);

    // Very slow, smooth transition
    this.svg
      .transition()
      .duration(1200)
      .ease(d3.easeQuadOut)
      .call(this.context.zoom.transform, transform);

    console.log(
      `🔍 Gradual zoom out to ${targetZoom.toFixed(2)}x (repo stays centered)`
    );
  }

  async visualize(owner: string, repo: string): Promise<void> {
    try {
      console.log(`🚀 Visualizing ${owner}/${repo}...`);

      // Store the current owner/repo for later use
      this.currentOwner = owner;
      this.currentRepo = repo;

      // Connect to SSE for real-time updates (if not already connected)
      if (!this.sseClient.isConnected()) {
        this.connectToSSE(owner, repo);
      } else {
        console.log(`📡 SSE already connected for ${owner}/${repo}`);
      }

      // Clear existing visualization
      this.clearVisualization();

      // Fetch data from API
      const data = await this.fetchRepoData(owner, repo);
      console.log("📦 API Response:", {
        hasRepo: !!data.repo,
        hasContributors: !!data.contributors,
        hasIcon: !!data.icon,
        iconLength: data.icon?.length,
      });

      if (data.error) {
        throw new Error(data.error);
      }

      // No more backend configuration extraction needed

      // Step 1: Store repo data and create repository visualization (without icon first)
      if (data.repo) {
        this.currentRepoData = {
          name: data.repo?.full_name || `${owner}/${repo}`,
          description: data.repo?.description,
          ...data.repo,
        };

        console.log(`🔍 Stored repo data:`, {
          name: this.currentRepoData.name,
          full_name: data.repo?.full_name,
          fallback: `${owner}/${repo}`,
        });

        // Pass repo data to stats visualization
        this.statsViz.setRepoData(this.currentRepoData);

        const repoData = {
          name: this.currentRepoData.name,
          icon: undefined, // Show without icon first
        };
        const repoResources = this.repositoryViz.create(repoData);
        this.addResources(repoResources);
        this.repositoryViz.update(repoResources);

        // Register repository space
        const repoNode = repoResources.nodes[0];
        if (repoNode) {
          const repoRadius = this.getNodeRadius("repo");
          this.registerOccupiedSpace(
            repoNode.x!,
            repoNode.y!,
            repoRadius,
            repoNode.id
          );
        }

        console.log("📍 Repository node created at center");
      }

      // Step 2: Add icon after delay
      if (data.icon) {
        setTimeout(() => {
          // Update the existing repo node with the icon
          const existingRepoNode = this.allNodes.find((n) => n.id === "repo");
          if (existingRepoNode && data.icon) {
            existingRepoNode.avatar = data.icon;
            console.log("🖼️ Repository icon loaded, updating existing node");

            // Update visualization with the modified node
            this.repositoryViz.update({ nodes: [existingRepoNode], links: [] });
          }
        }, 500);
      }

      // Step 3: Add stats after icon loads
      if (data.stats) {
        setTimeout(
          () => {
            this.addStatsAfterIcon(data.stats, () => {
              // Step 4: Add contributors after stats are done
              this.addContributorsAfterStats(
                data.contributors || [],
                data.files || []
              );
            });
          },
          data.icon ? 1000 : 500
        );
      } else {
        // If no stats, go directly to contributors
        setTimeout(
          () => {
            this.addContributorsAfterStats(
              data.contributors || [],
              data.files || []
            );
          },
          data.icon ? 1000 : 500
        );
      }

      console.log(`✅ Successfully started visualization for ${owner}/${repo}`);
    } catch (error) {
      console.error("Error visualizing repository:", error);
    }
  }

  private async fetchRepoData(
    owner: string,
    repo: string
  ): Promise<ApiResponse> {
    const response = await fetch(this.apiEndpoint, {
      method: "POST",
      headers: this.apiHeaders,
      body: JSON.stringify({
        owner,
        repo,
        data: ["repo_info", "contributors", "icon", "files", "stats"],
      }),
    });

    if (!response.ok) {
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }

  private connectToSSE(owner: string, repo: string): void {
    console.log(`📡 Setting up SSE for ${owner}/${repo}...`);

    // Set up event handlers
    this.sseClient.onExplorationStarted((event) => {
      this.showExplorationStatus(
        `🤖 Starting ${event.mode} analysis...`,
        "info"
      );
    });

    this.sseClient.onExplorationProgress((event) => {
      if (event.data?.progress) {
        this.showExplorationStatus(`🔍 ${event.data.progress}`, "info");
      }
    });

    this.sseClient.onExplorationCompleted((event) => {
      console.log(`📨 SSE exploration_completed event received:`, event);
      this.showExplorationStatus(
        `✅ ${event.mode} analysis complete!`,
        "success"
      );

      // If this is first_pass exploration, we could enhance the visualization
      if (event.mode === "first_pass" && event.data?.result) {
        console.log(
          `🎉 First-pass exploration completed for ${owner}/${repo}:`,
          event.data.result
        );
        console.log(
          `🎉 Infrastructure data:`,
          event.data.result.infrastructure
        );
        this.onExplorationComplete(event.data.result, event.mode!);
      }
    });

    this.sseClient.onExplorationFailed((event) => {
      this.showExplorationStatus(`❌ Analysis failed: ${event.error}`, "error");
    });

    this.sseClient.onCloneStarted((event) => {
      this.showExplorationStatus("📥 Cloning repository...", "info");
    });

    this.sseClient.onCloneCompleted((event) => {
      if (event.data?.success) {
        this.showExplorationStatus("✅ Repository cloned", "success");
      } else {
        this.showExplorationStatus("❌ Repository clone failed", "error");
      }
    });

    // Connect to SSE stream (non-blocking)
    this.sseClient.connect(owner, repo).catch((error) => {
      console.error("Failed to connect to SSE:", error);
      this.showExplorationStatus("⚠️ Real-time updates unavailable", "warning");
    });
  }

  private showExplorationStatus(
    message: string,
    type: "info" | "success" | "error" | "warning"
  ): void {
    console.log(`📱 Status: ${message}`);

    // For now, just log to console
    // In the future, this could show a toast notification or status bar
    const emoji = {
      info: "ℹ️",
      success: "✅",
      error: "❌",
      warning: "⚠️",
    }[type];

    console.log(`${emoji} ${message}`);
  }

  private onExplorationComplete(explorationResult: any, mode: string): void {
    console.log(
      `🎊 Processing ${mode} exploration results:`,
      explorationResult
    );

    // Create and show concept visualization based on exploration results
    if (mode === "first_pass" && explorationResult) {
      console.log(
        `🔮 Processing concept visualization from exploration data...`
      );

      if (this.mainVisualizationComplete) {
        // Main visualization is done, add concepts immediately
        console.log(`🔮 Main visualization complete, adding concepts now...`);
        setTimeout(() => {
          this.addConceptsSequentially(explorationResult);
        }, 1000);
      } else {
        // Main visualization still in progress, store concepts for later
        console.log(
          `🔮 Main visualization in progress, storing concepts for later...`
        );
        this.pendingConcepts = explorationResult;
      }
    }

    if (mode === "first_pass" && explorationResult.infrastructure) {
      console.log(
        `🏗️ Infrastructure discovered: ${explorationResult.infrastructure}`
      );
    }

    if (explorationResult.key_files) {
      console.log(`📁 Key files identified: ${explorationResult.key_files}`);
    }
  }

  private clearVisualization(): void {
    console.log("🧹 Clearing visualization...");
    this.allNodes = [];
    this.allLinks = [];
    this.occupiedSpaces = []; // Clear collision tracking
    this.currentZoom = 1.0; // Reset zoom level
    this.mainVisualizationComplete = false; // Reset completion flag
    this.pendingConcepts = null; // Clear pending concepts

    // Don't disconnect SSE here - keep connection for the new visualization
    // SSE will be disconnected only in destroy() method

    // Clear all resource visualizations
    this.repositoryViz.destroy();
    this.contributorsViz.destroy();
    this.linksViz.destroy();
    this.filesViz.destroy();
    this.statsViz.destroy();
    this.conceptsViz.destroy();
  }

  private addResources(resources: ResourceData): void {
    this.allNodes.push(...resources.nodes);
    this.allLinks.push(...resources.links);
  }

  private addStatsAfterIcon(stats: any, onComplete: () => void): void {
    if (!stats) {
      console.log("📊 No stats to add");
      if (onComplete) onComplete();
      return;
    }

    console.log(`📊 Adding stats one by one...`);
    setTimeout(() => {
      this.addStatsSequentially(stats, 0, onComplete);
    }, 300); // Small delay before starting stats
  }

  private addStatsSequentially(
    stats: any,
    index: number,
    onComplete?: () => void
  ): void {
    // Create the 4 stat items
    const statItems = [
      {
        id: "stat-stars",
        name: `${stats.stars} ⭐`,
        label: "Stars",
        value: stats.stars,
      },
      {
        id: "stat-issues",
        name: `${stats.totalIssues} issues`,
        label: "Issues",
        value: stats.totalIssues,
      },
      {
        id: "stat-commits",
        name: `${stats.totalCommits} commits`,
        label: "Total Commits",
        value: stats.totalCommits,
      },
      {
        id: "stat-age",
        name: `${stats.ageInYears}y old`,
        label: "Repository Age",
        value: stats.ageInYears,
      },
    ];

    if (index >= statItems.length) {
      console.log("🎉 All stats added!");
      if (onComplete) {
        setTimeout(onComplete, 500); // Small delay before moving to next phase
      }
      return;
    }

    const stat = statItems[index];
    console.log(
      `📊 Adding stat ${index + 1}/${statItems.length}: ${stat.name}`
    );

    // Calculate collision-free organic position for this stat
    const position = this.calculateOrganicPosition("stat", index);

    console.log(
      `📍 Positioning ${stat.name} organically at (${Math.round(position.x)}, ${Math.round(position.y)})`
    );

    const statNode: NodeData = {
      id: stat.id,
      type: "stat",
      name: stat.name,
      label: stat.label,
      value: stat.value,
      x: position.x,
      y: position.y,
    };

    // Register this stat's space to prevent future overlaps
    const nodeRadius = this.getNodeRadius("stat");
    this.registerOccupiedSpace(position.x, position.y, nodeRadius, statNode.id);

    const statLink: LinkData = {
      id: `link-repo-stat-${stat.id}`,
      source: "repo",
      target: stat.id,
      type: "stat",
    };

    const statResources = {
      nodes: [statNode],
      links: [statLink],
    };

    this.addResources(statResources);

    // Get all stat nodes that should be visible now
    const allStatNodes = this.allNodes.filter((n) => n.type === "stat");

    // Update visualization with all stats (so previous ones don't disappear)
    this.statsViz.updateWithAnimation({
      nodes: allStatNodes,
      links: [],
    });

    // Update links with all stat links
    const allLinks = this.allLinks.filter(
      (l) => l.type === "contribution" || l.type === "stat" || l.type === "file"
    );
    this.linksViz.updateWithAnimation({
      nodes: [],
      links: allLinks,
    });

    // Update link positions
    this.linksViz.updatePositions(this.allNodes);

    // Gradually zoom out (keeping repo centered)
    setTimeout(() => {
      this.gradualZoomOut();
    }, 200); // Small delay after the node appears

    // Add next stat after configurable delay
    setTimeout(() => {
      this.addStatsSequentially(stats, index + 1, onComplete);
    }, this.nodeDelay);
  }

  private addContributorsAfterStats(contributors: any[], files: any[]): void {
    if (!contributors || contributors.length === 0) {
      console.log("👥 No contributors to add, going to files");
      setTimeout(() => {
        this.addFilesAfterContributors(files);
      }, 500);
      return;
    }

    // Sort contributors by contribution count (highest first)
    const sortedContributors = contributors.sort(
      (a, b) => b.contributions - a.contributions
    );
    console.log(
      "📊 Contributors sorted by contributions:",
      sortedContributors.map((c) => `${c.login}: ${c.contributions}`)
    );

    setTimeout(() => {
      this.addContributorsSequentially(sortedContributors, 0, () => {
        // Add files after all contributors are added
        this.addFilesAfterContributors(files);
      });
    }, 500); // Small delay before starting contributors
  }

  private addContributorsSequentially(
    contributors: any[],
    index: number,
    onComplete?: () => void
  ): void {
    if (index >= contributors.length) {
      console.log("🎉 All contributors added!");
      if (onComplete) {
        onComplete();
      }
      return;
    }

    const contributor = contributors[index];
    console.log(
      `👤 Adding contributor ${index + 1}/${contributors.length}: ${contributor.login}`
    );

    // Calculate collision-free organic position for this contributor
    const position = this.calculateOrganicPosition(
      "contributor",
      index,
      contributor.contributions
    );

    console.log(
      `📍 Positioning ${contributor.login} (${contributor.contributions} contributions) organically`
    );

    console.log("====================", contributor);
    const contributorNode: NodeData = {
      id: `contributor-${contributor.id}`,
      type: "contributor",
      name: contributor.login,
      avatar: contributor.avatar_url,
      contributions: contributor.contributions,
      x: position.x,
      y: position.y,
    };

    // Register this contributor's space to prevent future overlaps
    const nodeRadius = this.getNodeRadius(
      "contributor",
      contributor.contributions
    );
    this.registerOccupiedSpace(
      position.x,
      position.y,
      nodeRadius,
      contributorNode.id
    );

    const contributorLink: LinkData = {
      id: `link-repo-contributor-${contributor.id}`,
      source: "repo",
      target: `contributor-${contributor.id}`,
      type: "contribution",
    };

    const contributorResources = {
      nodes: [contributorNode],
      links: [contributorLink],
    };

    this.addResources(contributorResources);

    // Get all contributor nodes that should be visible now
    const allContributorNodes = this.allNodes.filter(
      (n) => n.type === "contributor"
    );
    const allContributorLinks = this.allLinks.filter(
      (l) => l.type === "contribution" || l.type === "stat"
    );

    // Update visualization with all contributors (so previous ones don't disappear)
    this.contributorsViz.updateWithAnimation({
      nodes: allContributorNodes,
      links: [], // Contributors don't create their own links
    });

    // Update links with all contributor links + stat links
    this.linksViz.updateWithAnimation({
      nodes: [],
      links: allContributorLinks,
    });

    // Update link positions since we don't have a tick function anymore
    this.linksViz.updatePositions(this.allNodes);

    // Gradually zoom out (keeping repo centered)
    setTimeout(() => {
      this.gradualZoomOut();
    }, 200); // Small delay after the node appears

    // Add next contributor after configurable delay
    setTimeout(() => {
      this.addContributorsSequentially(contributors, index + 1, onComplete);
    }, this.nodeDelay);
  }

  private addFilesAfterContributors(files: any[]): void {
    if (!files || files.length === 0) {
      console.log("📁 No files to add");
      return;
    }

    console.log(
      `📁 Adding ${files.length} files to visualization one by one...`
    );
    setTimeout(() => {
      this.addFilesSequentially(files, 0);
    }, 500); // Small delay before starting files
  }

  private addFilesSequentially(files: any[], index: number): void {
    if (index >= files.length) {
      console.log("🎉 All files added!");
      this.mainVisualizationComplete = true;
      // Check if we have pending concepts to add
      if (this.pendingConcepts) {
        console.log(
          "🔮 Main visualization complete, adding pending concepts..."
        );
        setTimeout(() => {
          this.addConceptsSequentially(this.pendingConcepts);
          this.pendingConcepts = null;
        }, 1000); // Delay after files complete
      }
      return;
    }

    const file = files[index];
    console.log(`📄 Adding file ${index + 1}/${files.length}: ${file.name}`);

    // Calculate collision-free organic position for this file
    const position = this.calculateOrganicPosition("file", index);

    console.log(
      `📍 Positioning ${file.name} organically at (${Math.round(position.x)}, ${Math.round(position.y)})`
    );

    const fileNode: NodeData = {
      id: `file-${file.name}`,
      type: "file",
      name: file.name,
      path: file.path,
      fileType: file.type,
      x: position.x,
      y: position.y,
    };

    // Register this file's space to prevent future overlaps
    const nodeRadius = this.getNodeRadius("file");
    this.registerOccupiedSpace(position.x, position.y, nodeRadius, fileNode.id);

    const fileLink: LinkData = {
      id: `link-repo-file-${file.name}`,
      source: "repo",
      target: `file-${file.name}`,
      type: "file",
    };

    const fileResources = {
      nodes: [fileNode],
      links: [fileLink],
    };

    this.addResources(fileResources);

    // Get all file nodes that should be visible now
    const allFileNodes = this.allNodes.filter((n) => n.type === "file");

    // Update visualization with all files (so previous ones don't disappear)
    this.filesViz.updateWithAnimation({
      nodes: allFileNodes,
      links: [], // Files don't create their own links in visualization
    });

    // Update links with all file links + contribution links + stat links
    const allLinks = this.allLinks.filter(
      (l) => l.type === "contribution" || l.type === "file" || l.type === "stat"
    );
    this.linksViz.updateWithAnimation({
      nodes: [],
      links: allLinks,
    });

    // Update link positions
    this.linksViz.updatePositions(this.allNodes);

    // Gradually zoom out (keeping repo centered)
    setTimeout(() => {
      this.gradualZoomOut();
    }, 200); // Small delay after the node appears

    // Add next file after configurable delay
    setTimeout(() => {
      this.addFilesSequentially(files, index + 1);
    }, this.nodeDelay);
  }

  private addConceptsSequentially(explorationResult: any): void {
    console.log(`🔮 Starting sequential concept addition...`);

    // Pass repo data to concepts viz for click handling
    this.conceptsViz.setRepoData(this.currentRepoData);

    // Create all concept nodes
    const conceptResourceData = this.conceptsViz.create(explorationResult);

    if (conceptResourceData.nodes.length === 0) {
      console.log("🔮 No concept nodes to add");
      return;
    }

    console.log(
      `🔮 Adding ${conceptResourceData.nodes.length} concept nodes sequentially...`
    );
    this.addConceptNodesSequentially(conceptResourceData.nodes, 0);
  }

  private addConceptNodesSequentially(
    conceptNodes: NodeData[],
    index: number
  ): void {
    if (index >= conceptNodes.length) {
      console.log("🎉 All concept nodes added!");
      return;
    }

    const node = conceptNodes[index];
    console.log(
      `🔮 Adding concept ${index + 1}/${conceptNodes.length}: ${node.name} (${node.kind})`
    );

    // Position the concept node with better collision detection
    const position = this.calculateOrganicPosition(
      "concept",
      index,
      undefined,
      node
    );
    node.x = position.x;
    node.y = position.y;
    const nodeRadius = this.getNodeRadius(node.type, undefined, node);
    this.registerOccupiedSpace(position.x, position.y, nodeRadius, node.id);

    // Add to our node collection
    this.allNodes.push(node);

    // Get all concept nodes added so far (including this one)
    const conceptNodesAddedSoFar = conceptNodes.slice(0, index + 1);

    // Update visualization with all concept nodes added so far
    this.conceptsViz.updateWithAnimation({
      nodes: conceptNodesAddedSoFar,
      links: [],
    });

    // Continue with next concept node after delay
    setTimeout(() => {
      this.addConceptNodesSequentially(conceptNodes, index + 1);
    }, this.nodeDelay);
  }

  // 🌱 No more simulation methods needed - organic positioning is stable!

  // Public methods for library usage
  public setDimensions(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.context.width = width;
    this.context.height = height;

    this.svg.attr("width", width).attr("height", height);

    // Update context dimensions for organic positioning
    this.context.width = width;
    this.context.height = height;
  }

  private injectStyles(): void {
    // Check if styles are already injected
    if (document.getElementById("gitsee-styles")) return;

    const styleSheet = document.createElement("style");
    styleSheet.id = "gitsee-styles";
    styleSheet.textContent = `
      .gitsee-link {
        stroke: #30363d;
        stroke-width: 1.5px;
      }
      
      .gitsee-node {
        cursor: pointer;
      }
      
      .gitsee-node-label {
        fill: #b6b6b6;
        font-size: 12px;
        font-weight: 500;
        text-anchor: middle;
        pointer-events: none;
      }
    `;
    document.head.appendChild(styleSheet);
  }

  private async showNodePanel(nodeData: NodeData): Promise<void> {
    // Get panel content based on node type
    let content;
    if (nodeData.type === "repo" || !nodeData.type) {
      // Stats click passes a fake repo node, so we always show repo content for stats
      // Get all stats nodes to pass to the repository panel
      const statsNodes = this.allNodes.filter((n) => n.type === "stat");
      content = this.repositoryViz.getPanelContent(
        nodeData,
        this.currentRepoData,
        statsNodes
      );
    } else if (nodeData.type === "file") {
      // Use the stored owner/repo from visualize() call
      if (!this.currentOwner || !this.currentRepo) {
        console.error("No current owner/repo stored");
        content = {
          name: nodeData.name,
          sections: [
            {
              title: "Content",
              type: "content" as const,
              data: "// Could not determine repository owner/name",
            },
          ],
        };
      } else {
        content = await this.filesViz.getPanelContent(
          nodeData,
          this.currentOwner,
          this.currentRepo
        );
      }
    } else if (nodeData.type === "contributor") {
      content = this.contributorsViz.getPanelContent(nodeData);
    } else if (nodeData.type === "concept") {
      content = this.conceptsViz.getPanelContent(nodeData);
    } else {
      // Default to repo content for unknown types
      const statsNodes = this.allNodes.filter((n) => n.type === "stat");
      content = this.repositoryViz.getPanelContent(
        nodeData,
        this.currentRepoData,
        statsNodes
      );
    }

    this.detailPanel.updateContent(content);
    this.detailPanel.show();
  }

  public showDetailPanel(): void {
    this.detailPanel.show();
  }

  public hideDetailPanel(): void {
    this.detailPanel.hide();
  }

  public toggleDetailPanel(): void {
    this.detailPanel.toggle();
  }

  public setApiEndpoint(apiEndpoint: string): void {
    this.apiEndpoint = apiEndpoint;
    // Update the files visualization with the new endpoint
    this.filesViz = new FilesVisualization(
      this.context,
      (nodeData) => {
        this.showNodePanel(nodeData);
      },
      this.apiEndpoint,
      this.apiHeaders
    );
  }

  public setSseEndpoint(sseEndpoint: string): void {
    this.sseEndpoint = sseEndpoint;
    // Reinitialize SSE client with new endpoint
    this.sseClient.disconnect();
    this.sseClient = new SSEClient(this.sseEndpoint);
  }

  public setEndpoints(apiEndpoint: string, sseEndpoint?: string): void {
    this.apiEndpoint = apiEndpoint;
    this.sseEndpoint = sseEndpoint || apiEndpoint;

    // Update files visualization
    this.filesViz = new FilesVisualization(
      this.context,
      (nodeData) => {
        this.showNodePanel(nodeData);
      },
      this.apiEndpoint,
      this.apiHeaders
    );

    // Update SSE client
    this.sseClient.disconnect();
    this.sseClient = new SSEClient(this.sseEndpoint);
  }

  public setApiHeaders(apiHeaders: Record<string, string>): void {
    this.apiHeaders = {
      "Content-Type": "application/json",
      ...apiHeaders,
    };
    // Update the files visualization with the new headers
    this.filesViz = new FilesVisualization(
      this.context,
      (nodeData) => {
        this.showNodePanel(nodeData);
      },
      this.apiEndpoint,
      this.apiHeaders
    );
  }

  public getApiEndpoint(): string {
    return this.apiEndpoint;
  }

  public getSseEndpoint(): string {
    return this.sseEndpoint;
  }

  public getApiHeaders(): Record<string, string> {
    return { ...this.apiHeaders };
  }

  public setNodeDelay(nodeDelay: number): void {
    this.nodeDelay = nodeDelay;
  }

  public getNodeDelay(): number {
    return this.nodeDelay;
  }

  public destroy(): void {
    // Clean up visualization
    this.svg.selectAll("*").remove();

    // Clean up SSE connection
    this.sseClient.disconnect();

    // Clean up detail panel
    this.detailPanel.destroy();

    // Optionally remove injected styles if no other instances exist
    const styleSheet = document.getElementById("gitsee-styles");
    if (styleSheet) {
      styleSheet.remove();
    }
  }
}

// Export for library usage
export { GitVisualizer };
