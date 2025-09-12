import * as d3 from 'd3';
import { 
  NodeData, 
  LinkData, 
  ApiResponse, 
  VisualizationContext,
  ResourceData 
} from './types/index.js';
import {
  RepositoryVisualization,
  ContributorsVisualization,
  LinksVisualization,
  FilesVisualization
} from './resources/index.js';

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

  // Configurable timing
  private contributorDelay: number = 800;

  constructor() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.svg = d3.select('#visualization');
    this.svg.attr('width', this.width).attr('height', this.height);

    this.initializeVisualization();
  }

  private initializeVisualization(): void {
    // Create zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event: any) => {
        this.context.container.attr('transform', event.transform.toString());
      });

    this.svg.call(zoom);

    // Create main container (no more physics simulation!)
    const container = this.svg.append('g').attr('class', 'main-container');

    // Create visualization context
    this.context = {
      svg: this.svg,
      container,
      zoom,
      width: this.width,
      height: this.height
    };

    // Initialize resource visualizations
    this.repositoryViz = new RepositoryVisualization(this.context);
    this.contributorsViz = new ContributorsVisualization(this.context);
    this.linksViz = new LinksVisualization(this.context);
    this.filesViz = new FilesVisualization(this.context);

    // Create links group first to ensure it's at the bottom
    this.linksViz['getResourceGroup']();
  }

  /**
   * 🔍 Collision Detection System
   */
  private getNodeRadius(nodeType: string, contributions?: number): number {
    if (nodeType === 'repo') return 25;
    if (nodeType === 'file') return 18; // Files are rectangular but use this for collision
    // For contributors, calculate size based on contributions
    const baseRadius = 16;
    const maxRadius = 22;
    const contribCount = contributions || 0;
    return Math.min(baseRadius + contribCount * 0.1, maxRadius);
  }

  private checkCollision(x: number, y: number, radius: number): boolean {
    return this.occupiedSpaces.some(space => {
      const dx = x - space.x;
      const dy = y - space.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const minDistance = radius + space.radius + 20; // 20px buffer for better spacing
      return distance < minDistance;
    });
  }

  private findNonCollidingPosition(
    nodeType: string, 
    index: number, 
    contributions?: number
  ): { x: number, y: number } {
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
    const spiralStep = 15;
    let spiralRadius = radius + 20;
    let attempts = 0;
    const maxAttempts = 50;
    
    while (attempts < maxAttempts) {
      const angleStep = (Math.PI * 2) / 12; // 12 positions per ring
      
      for (let i = 0; i < 12; i++) {
        const angle = i * angleStep;
        const testX = position.x + Math.cos(angle) * spiralRadius;
        const testY = position.y + Math.sin(angle) * spiralRadius;
        
        // Keep within screen bounds
        if (testX < radius || testX > this.width - radius || 
            testY < radius || testY > this.height - radius) {
          continue;
        }
        
        if (!this.checkCollision(testX, testY, radius)) {
          console.log(`🌀 Found collision-free position for ${nodeType} after ${attempts + 1} attempts`);
          return { x: testX, y: testY };
        }
      }
      
      spiralRadius += spiralStep;
      attempts++;
    }
    
    console.warn(`⚠️ Could not find collision-free position for ${nodeType}, using original`);
    return position;
  }

  private registerOccupiedSpace(x: number, y: number, radius: number, nodeId: string): void {
    this.occupiedSpaces.push({ x, y, radius, nodeId });
  }

  /**
   * 🌱 Universal Organic Positioning System
   * Calculates natural, plant-like growth positions for any node type
   */
  private calculateOrganicPositionRaw(nodeType: string, index: number): { x: number, y: number } {
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    
    // Zone distances by node type (expandable for future node types)
    const zones = {
      'repo': { min: 0, max: 0 },           // Center
      'contributor': { min: 80, max: 120 }, // Inner ring
      'file': { min: 140, max: 180 },       // Outer ring for files
      'story': { min: 180, max: 220 },      // Future: user stories
      'function': { min: 220, max: 260 },   // Future: functions
      'component': { min: 260, max: 300 },  // Future: components
      'schema': { min: 300, max: 340 }      // Future: schemas
    };
    
    const zone = zones[nodeType as keyof typeof zones] || zones['contributor'];
    
    // Repository stays at center
    if (nodeType === 'repo') {
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
    
    console.log(`🌱 ${nodeType}[${index}] positioned at (${Math.round(x)}, ${Math.round(y)}) - distance: ${Math.round(distance)}`);
    
    return { x, y };
  }

  // Public interface that includes collision detection
  private calculateOrganicPosition(nodeType: string, index: number, contributions?: number): { x: number, y: number } {
    return this.findNonCollidingPosition(nodeType, index, contributions);
  }

  /**
   * 🔍 Master Zoom System
   * Gradually zooms out to fit the growing graph
   */
  private calculateBoundingBox(): { minX: number, maxX: number, minY: number, maxY: number } {
    if (this.allNodes.length === 0) {
      return { minX: 0, maxX: this.width, minY: 0, maxY: this.height };
    }

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    this.allNodes.forEach(node => {
      if (node.x !== undefined && node.y !== undefined) {
        const radius = this.getNodeRadius(node.type, node.contributions);
        minX = Math.min(minX, node.x - radius);
        maxX = Math.max(maxX, node.x + radius);
        minY = Math.min(minY, node.y - radius);
        maxY = Math.max(maxY, node.y + radius);
      }
    });

    return { minX, maxX, minY, maxY };
  }

  private currentZoom: number = 1.0; // Track current zoom level

  private calculateGradualZoomOut(): number {
    // Much more gradual zoom out - reduce by 2% each time
    this.currentZoom *= 0.98;
    
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

    console.log(`🔍 Gradual zoom out to ${targetZoom.toFixed(2)}x (repo stays centered)`);
  }

  async visualize(owner: string, repo: string): Promise<void> {
    try {
      console.log(`🚀 Visualizing ${owner}/${repo}...`);
      
      // Clear existing visualization
      this.clearVisualization();

      // Fetch data from API
      const data = await this.fetchRepoData(owner, repo);
      console.log('📦 API Response:', { 
        hasRepo: !!data.repo, 
        hasContributors: !!data.contributors, 
        hasIcon: !!data.icon, 
        iconLength: data.icon?.length 
      });

      if (data.error) {
        throw new Error(data.error);
      }

      // Extract visualization configuration from response
      if (data.options?.contributorDelay) {
        this.contributorDelay = data.options.contributorDelay;
        console.log(`⚙️ Using contributor delay: ${this.contributorDelay}ms`);
      }

      // Step 1: Create repository visualization (without icon first)
      if (data.repo) {
        const repoData = {
          name: data.repo?.full_name || `${owner}/${repo}`,
          icon: undefined // Show without icon first
        };
        const repoResources = this.repositoryViz.create(repoData);
        this.addResources(repoResources);
        this.repositoryViz.update(repoResources);
        
        // Register repository space
        const repoNode = repoResources.nodes[0];
        if (repoNode) {
          const repoRadius = this.getNodeRadius('repo');
          this.registerOccupiedSpace(repoNode.x!, repoNode.y!, repoRadius, repoNode.id);
        }
        
        console.log('📍 Repository node created at center');
      }

      // Step 2: Add icon after delay
      if (data.icon) {
        setTimeout(() => {
          // Update the existing repo node with the icon
          const existingRepoNode = this.allNodes.find(n => n.id === 'repo');
          if (existingRepoNode && data.icon) {
            existingRepoNode.avatar = data.icon;
            console.log('🖼️ Repository icon loaded, updating existing node');
            
            // Update visualization with the modified node
            this.repositoryViz.update({ nodes: [existingRepoNode], links: [] });
          }
        }, 500);
      }

      // Step 3: Add contributors one by one (sorted by contributions)
      if (data.contributors) {
        // Sort contributors by contribution count (highest first)
        const contributors = data.contributors.sort((a, b) => b.contributions - a.contributions);
        console.log('📊 Contributors sorted by contributions:', contributors.map(c => `${c.login}: ${c.contributions}`));
        
        const contributorDelay = data.icon ? 1000 : 500;
        setTimeout(() => {
          this.addContributorsSequentially(contributors, 0, () => {
            // Step 4: Add files after all contributors are added
            this.addFilesAfterContributors(data.files || []);
          });
        }, contributorDelay);
      } else {
        // If no contributors, add files directly
        setTimeout(() => {
          this.addFilesAfterContributors(data.files || []);
        }, data.icon ? 1000 : 500);
      }

      console.log(`✅ Successfully started visualization for ${owner}/${repo}`);
    } catch (error) {
      console.error('Error visualizing repository:', error);
    }
  }

  private async fetchRepoData(owner: string, repo: string): Promise<ApiResponse> {
    const response = await fetch('/api/gitsee', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        owner,
        repo,
        data: ['repo_info', 'contributors', 'icon', 'files']
      })
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private clearVisualization(): void {
    console.log('🧹 Clearing visualization...');
    this.allNodes = [];
    this.allLinks = [];
    this.occupiedSpaces = []; // Clear collision tracking
    this.currentZoom = 1.0; // Reset zoom level
    
    // Clear all resource visualizations
    this.repositoryViz.destroy();
    this.contributorsViz.destroy();
    this.linksViz.destroy();
    this.filesViz.destroy();
  }

  private addResources(resources: ResourceData): void {
    this.allNodes.push(...resources.nodes);
    this.allLinks.push(...resources.links);
  }

  private addContributorsSequentially(contributors: any[], index: number, onComplete?: () => void): void {
    if (index >= contributors.length) {
      console.log('🎉 All contributors added!');
      if (onComplete) {
        onComplete();
      }
      return;
    }

    const contributor = contributors[index];
    console.log(`👤 Adding contributor ${index + 1}/${contributors.length}: ${contributor.login}`);

    // Calculate collision-free organic position for this contributor
    const position = this.calculateOrganicPosition('contributor', index, contributor.contributions);
    
    console.log(`📍 Positioning ${contributor.login} (${contributor.contributions} contributions) organically`);
    
    const contributorNode: NodeData = {
      id: `contributor-${contributor.id}`,
      type: 'contributor',
      name: contributor.login,
      avatar: contributor.avatar_url,
      contributions: contributor.contributions,
      x: position.x,
      y: position.y
    };

    // Register this contributor's space to prevent future overlaps
    const nodeRadius = this.getNodeRadius('contributor', contributor.contributions);
    this.registerOccupiedSpace(position.x, position.y, nodeRadius, contributorNode.id);

    const contributorLink: LinkData = {
      id: `link-repo-contributor-${contributor.id}`,
      source: 'repo',
      target: `contributor-${contributor.id}`,
      type: 'contribution'
    };

    const contributorResources = {
      nodes: [contributorNode],
      links: [contributorLink]
    };

    this.addResources(contributorResources);
    
    // Get all contributor nodes that should be visible now
    const allContributorNodes = this.allNodes.filter(n => n.type === 'contributor');
    const allContributorLinks = this.allLinks.filter(l => l.type === 'contribution');
    
    // Update visualization with all contributors (so previous ones don't disappear)
    this.contributorsViz.updateWithAnimation({
      nodes: allContributorNodes,
      links: [] // Contributors don't create their own links
    });
    
    // Update links with all contributor links
    this.linksViz.updateWithAnimation({
      nodes: [],
      links: allContributorLinks
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
    }, this.contributorDelay);
  }

  private addFilesAfterContributors(files: any[]): void {
    if (!files || files.length === 0) {
      console.log('📁 No files to add');
      return;
    }

    console.log(`📁 Adding ${files.length} files to visualization...`);
    
    // Create file nodes with organic positioning
    const fileNodes: NodeData[] = [];
    const fileLinks: LinkData[] = [];

    files.forEach((file, index) => {
      // Calculate organic position for this file
      const position = this.calculateOrganicPosition('file', index);
      
      const fileNode: NodeData = {
        id: `file-${file.name}`,
        type: 'file',
        name: file.name,
        path: file.path,
        fileType: file.type,
        x: position.x,
        y: position.y
      };

      // Register this file's space to prevent overlaps
      const nodeRadius = this.getNodeRadius('file');
      this.registerOccupiedSpace(position.x, position.y, nodeRadius, fileNode.id);

      fileNodes.push(fileNode);

      // Create link from repo to file
      fileLinks.push({
        id: `link-repo-file-${file.name}`,
        source: 'repo',
        target: `file-${file.name}`,
        type: 'file'
      });

      console.log(`📄 Positioned file: ${file.name} at (${Math.round(position.x)}, ${Math.round(position.y)})`);
    });

    const fileResources = {
      nodes: fileNodes,
      links: fileLinks
    };

    this.addResources(fileResources);
    
    // Update visualization with animated files
    this.filesViz.updateWithAnimation({
      nodes: fileNodes,
      links: [] // Files don't create their own links in visualization
    });
    
    // Update links with all file links
    const allLinks = this.allLinks.filter(l => l.type === 'contribution' || l.type === 'file');
    this.linksViz.updateWithAnimation({
      nodes: [],
      links: allLinks
    });
    
    // Update link positions
    this.linksViz.updatePositions(this.allNodes);
    
    // Final zoom out to accommodate files
    setTimeout(() => {
      this.gradualZoomOut();
    }, 300);

    console.log('✅ All files added to visualization!');
  }

  // 🌱 No more simulation methods needed - organic positioning is stable!

  // Public methods for library usage
  public setDimensions(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.context.width = width;
    this.context.height = height;
    
    this.svg.attr('width', width).attr('height', height);
    
    // Update context dimensions for organic positioning
    this.context.width = width;
    this.context.height = height;
  }

  public destroy(): void {
    // Clean up visualization
    this.svg.selectAll('*').remove();
  }
}

// Initialize the visualizer when the page loads
const urlParams = new URLSearchParams(window.location.search);
const repoParam = urlParams.get('repo') || 'stakwork/hive';
const [owner, repo] = repoParam.split('/');

const visualizer = new GitVisualizer();
if (owner && repo) {
  visualizer.visualize(owner, repo);
} else {
  console.error('Invalid repo format. Use: ?repo=owner/repo');
}

// Export for library usage
export { GitVisualizer };