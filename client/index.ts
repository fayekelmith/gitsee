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
  LinksVisualization
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
  
  // Data storage
  private allNodes: NodeData[] = [];
  private allLinks: LinkData[] = [];

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
      width: this.width,
      height: this.height
    };

    // Initialize resource visualizations
    this.repositoryViz = new RepositoryVisualization(this.context);
    this.contributorsViz = new ContributorsVisualization(this.context);
    this.linksViz = new LinksVisualization(this.context);
  }

  /**
   * 🌱 Universal Organic Positioning System
   * Calculates natural, plant-like growth positions for any node type
   */
  private calculateOrganicPosition(nodeType: string, index: number, totalInType: number): { x: number, y: number } {
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    
    // Zone distances by node type (expandable for future node types)
    const zones = {
      'repo': { min: 0, max: 0 },           // Center
      'contributor': { min: 80, max: 120 }, // Inner ring
      'file': { min: 120, max: 160 },       // Future: key files
      'story': { min: 160, max: 200 },      // Future: user stories
      'function': { min: 200, max: 240 },   // Future: functions
      'component': { min: 240, max: 280 },  // Future: components
      'schema': { min: 280, max: 320 }      // Future: schemas
    };
    
    const zone = zones[nodeType] || zones['contributor'];
    
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

      // Step 1: Create repository visualization (without icon first)
      if (data.repo) {
        const repoData = {
          name: data.repo?.full_name || `${owner}/${repo}`,
          icon: undefined // Show without icon first
        };
        const repoResources = this.repositoryViz.create(repoData);
        this.addResources(repoResources);
        this.repositoryViz.update(repoResources);
        
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
        
        setTimeout(() => {
          this.addContributorsSequentially(contributors, 0);
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
        data: ['repo_info', 'contributors', 'icon']
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
    
    // Clear all resource visualizations
    this.repositoryViz.destroy();
    this.contributorsViz.destroy();
    this.linksViz.destroy();
  }

  private addResources(resources: ResourceData): void {
    this.allNodes.push(...resources.nodes);
    this.allLinks.push(...resources.links);
  }

  private addContributorsSequentially(contributors: any[], index: number): void {
    if (index >= contributors.length) {
      console.log('🎉 All contributors added!');
      return;
    }

    const contributor = contributors[index];
    console.log(`👤 Adding contributor ${index + 1}/${contributors.length}: ${contributor.login}`);

    // Calculate organic position for this contributor
    const position = this.calculateOrganicPosition('contributor', index, contributors.length);
    
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
    
    // No simulation needed - positions are calculated and stable!
    
    // Add next contributor after delay (faster since no physics!)
    setTimeout(() => {
      this.addContributorsSequentially(contributors, index + 1);
    }, 400);
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