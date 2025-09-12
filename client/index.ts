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
} from "./resources/index.js";

class GitVisualizer {
  private width: number;
  private height: number;
  private svg: any;
  private context!: VisualizationContext;

  // Resource visualizations
  private repositoryViz!: RepositoryVisualization;
  private contributorsViz!: ContributorsVisualization;
  private linksViz!: LinksVisualization;
  private filesViz!: FilesVisualization;
  private statsViz!: StatsVisualization;

  // Data storage
  private allNodes: NodeData[] = [];
  private allLinks: LinkData[] = [];

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
    repo: 40,        // Repository nodes (not used much since repo is centered)
    contributor: 40, // Contributors start close to center  
    stat: 40,        // Stats close to center
    file: 80,        // Files farther out for better separation
    default: 40      // Fallback for any other node types
  };

  constructor() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.svg = d3.select("#visualization");
    this.svg.attr("width", this.width).attr("height", this.height);

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
    this.repositoryViz = new RepositoryVisualization(this.context);
    this.contributorsViz = new ContributorsVisualization(this.context);
    this.linksViz = new LinksVisualization(this.context);
    this.filesViz = new FilesVisualization(this.context);
    this.statsViz = new StatsVisualization(this.context);

    // Create links group first to ensure it's at the bottom
    this.linksViz["getResourceGroup"]();
  }

  /**
   * 🔍 Collision Detection System
   */
  private getNodeRadius(nodeType: string, contributions?: number): number {
    if (nodeType === "repo") return 35;
    if (nodeType === "file") return 18; // Files are rectangular but use this for collision
    if (nodeType === "stat") return 22; // Stats are circles
    // For contributors, calculate size based on contributions
    const baseRadius = 16;
    const maxRadius = 22;
    const contribCount = contributions || 0;
    return Math.min(baseRadius + contribCount * 0.1, maxRadius);
  }

  private checkCollision(x: number, y: number, radius: number): boolean {
    return this.occupiedSpaces.some((space) => {
      const dx = x - space.x;
      const dy = y - space.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const minDistance = radius + space.radius + 40; // 40px buffer for much better spacing
      return distance < minDistance;
    });
  }

  private findNonCollidingPosition(
    nodeType: string,
    index: number,
    contributions?: number
  ): { x: number; y: number } {
    const radius = this.getNodeRadius(nodeType, contributions);
    const centerX = this.width / 2;
    const centerY = this.height / 2;

    // Try the organic position first
    let position = this.calculateOrganicPositionRaw(nodeType, index);

    // If no collision, use it
    if (!this.checkCollision(position.x, position.y, radius)) {
      return position;
    }

    // If collision, try spiraling outward from the original position
    const spiralStep = 20;
    // Use configured spiral distance for this node type
    const spiralDistance = this.spiralDistances[nodeType as keyof typeof this.spiralDistances] || this.spiralDistances.default;
    let spiralRadius = radius + spiralDistance;
    let attempts = 0;
    const maxAttempts = 50;

    while (attempts < maxAttempts) {
      const angleStep = (Math.PI * 2) / 12; // 12 positions per ring

      for (let i = 0; i < 12; i++) {
        const angle = i * angleStep;
        const testX = position.x + Math.cos(angle) * spiralRadius;
        const testY = position.y + Math.sin(angle) * spiralRadius;

        // Keep within screen bounds
        if (
          testX < radius ||
          testX > this.width - radius ||
          testY < radius ||
          testY > this.height - radius
        ) {
          continue;
        }

        if (!this.checkCollision(testX, testY, radius)) {
          console.log(
            `🌀 Found collision-free position for ${nodeType} after ${attempts + 1} attempts`
          );
          return { x: testX, y: testY };
        }
      }

      spiralRadius += spiralStep;
      attempts++;
    }

    console.warn(
      `⚠️ Could not find collision-free position for ${nodeType}, using original`
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

    // Base angle with golden spiral + some randomness
    const baseAngle = index * goldenAngle;
    const randomOffset = (Math.random() - 0.5) * 0.5; // ±15 degrees randomness
    const angle = baseAngle + randomOffset;

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
    contributions?: number
  ): { x: number; y: number } {
    return this.findNonCollidingPosition(nodeType, index, contributions);
  }

  private currentZoom: number = 1.0; // Track current zoom level

  private calculateGradualZoomOut(): number {
    // Configurable zoom speed - zoomSpeed of 1 = 1% reduction, 2 = 2% reduction, etc.
    const zoomFactor = 1 - (this.zoomSpeed * 0.01);
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

      // Extract visualization configuration from response
      if (data.options?.nodeDelay) {
        this.nodeDelay = data.options.nodeDelay;
        console.log(`⚙️ Using node delay: ${this.nodeDelay}ms`);
      }

      // Step 1: Create repository visualization (without icon first)
      if (data.repo) {
        const repoData = {
          name: data.repo?.full_name || `${owner}/${repo}`,
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
        setTimeout(() => {
          this.addStatsAfterIcon(data.stats, () => {
            // Step 4: Add contributors after stats are done
            this.addContributorsAfterStats(data.contributors || [], data.files || []);
          });
        }, data.icon ? 1000 : 500);
      } else {
        // If no stats, go directly to contributors
        setTimeout(() => {
          this.addContributorsAfterStats(data.contributors || [], data.files || []);
        }, data.icon ? 1000 : 500);
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
    const response = await fetch("/api/gitsee", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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

  private clearVisualization(): void {
    console.log("🧹 Clearing visualization...");
    this.allNodes = [];
    this.allLinks = [];
    this.occupiedSpaces = []; // Clear collision tracking
    this.currentZoom = 1.0; // Reset zoom level

    // Clear all resource visualizations
    this.repositoryViz.destroy();
    this.contributorsViz.destroy();
    this.linksViz.destroy();
    this.filesViz.destroy();
    this.statsViz.destroy();
  }

  private addResources(resources: ResourceData): void {
    this.allNodes.push(...resources.nodes);
    this.allLinks.push(...resources.links);
  }

  private addStatsAfterIcon(stats: any, onComplete: () => void): void {
    if (!stats) {
      console.log('📊 No stats to add');
      if (onComplete) onComplete();
      return;
    }

    console.log(`📊 Adding stats one by one...`);
    setTimeout(() => {
      this.addStatsSequentially(stats, 0, onComplete);
    }, 300); // Small delay before starting stats
  }

  private addStatsSequentially(stats: any, index: number, onComplete?: () => void): void {
    // Create the 4 stat items
    const statItems = [
      { id: 'stat-stars', name: `${stats.stars} ⭐`, label: 'Stars', value: stats.stars },
      { id: 'stat-prs', name: `${stats.totalPRs} PRs`, label: 'Pull Requests', value: stats.totalPRs },
      { id: 'stat-commits', name: `${stats.totalCommits} commits`, label: 'Total Commits', value: stats.totalCommits },
      { id: 'stat-age', name: `${stats.ageInYears}y old`, label: 'Repository Age', value: stats.ageInYears }
    ];

    if (index >= statItems.length) {
      console.log('🎉 All stats added!');
      if (onComplete) {
        setTimeout(onComplete, 500); // Small delay before moving to next phase
      }
      return;
    }

    const stat = statItems[index];
    console.log(`📊 Adding stat ${index + 1}/${statItems.length}: ${stat.name}`);

    // Calculate collision-free organic position for this stat
    const position = this.calculateOrganicPosition('stat', index);
    
    console.log(`📍 Positioning ${stat.name} organically at (${Math.round(position.x)}, ${Math.round(position.y)})`);
    
    const statNode: NodeData = {
      id: stat.id,
      type: 'stat',
      name: stat.name,
      label: stat.label,
      value: stat.value,
      x: position.x,
      y: position.y
    };

    // Register this stat's space to prevent future overlaps
    const nodeRadius = this.getNodeRadius('stat');
    this.registerOccupiedSpace(position.x, position.y, nodeRadius, statNode.id);

    const statLink: LinkData = {
      id: `link-repo-stat-${stat.id}`,
      source: 'repo',
      target: stat.id,
      type: 'stat'
    };

    const statResources = {
      nodes: [statNode],
      links: [statLink]
    };

    this.addResources(statResources);
    
    // Get all stat nodes that should be visible now
    const allStatNodes = this.allNodes.filter(n => n.type === 'stat');
    
    // Update visualization with all stats (so previous ones don't disappear)
    this.statsViz.updateWithAnimation({
      nodes: allStatNodes,
      links: []
    });
    
    // Update links with all stat links
    const allLinks = this.allLinks.filter(l => l.type === 'contribution' || l.type === 'stat' || l.type === 'file');
    this.linksViz.updateWithAnimation({
      nodes: [],
      links: allLinks
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
      console.log('👥 No contributors to add, going to files');
      setTimeout(() => {
        this.addFilesAfterContributors(files);
      }, 500);
      return;
    }

    // Sort contributors by contribution count (highest first)
    const sortedContributors = contributors.sort((a, b) => b.contributions - a.contributions);
    console.log('📊 Contributors sorted by contributions:', sortedContributors.map(c => `${c.login}: ${c.contributions}`));
    
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

  public destroy(): void {
    // Clean up visualization
    this.svg.selectAll("*").remove();
  }
}

// Initialize the visualizer when the page loads
const urlParams = new URLSearchParams(window.location.search);
const repoParam = urlParams.get("repo") || "stakwork/hive";
const [owner, repo] = repoParam.split("/");

const visualizer = new GitVisualizer();
if (owner && repo) {
  visualizer.visualize(owner, repo);
} else {
  console.error("Invalid repo format. Use: ?repo=owner/repo");
}

// Export for library usage
export { GitVisualizer };
