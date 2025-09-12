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

    // Create main container and simulation
    const container = this.svg.append('g').attr('class', 'main-container');
    const simulation = d3.forceSimulation()
      .force('link', d3.forceLink().id((d: any) => d.id).distance(80).strength(0.5))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(this.width / 2, this.height / 2))
      .force('collision', d3.forceCollide().radius((d: any) => {
        // Dynamic collision radius based on node size
        if (d.type === 'repo') return 30;
        const contributions = d.contributions || 0;
        return Math.min(16 + contributions * 0.1, 22) + 3; // Node radius + padding
      }))
      .force('x', d3.forceX(this.width / 2).strength(0.1))
      .force('y', d3.forceY(this.height / 2).strength(0.1));

    // Create visualization context
    this.context = {
      svg: this.svg,
      container,
      simulation,
      width: this.width,
      height: this.height
    };

    // Initialize resource visualizations
    this.repositoryViz = new RepositoryVisualization(this.context);
    this.contributorsViz = new ContributorsVisualization(this.context);
    this.linksViz = new LinksVisualization(this.context);

    // Set up simulation tick handler
    simulation.on('tick', this.tick.bind(this));
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
        this.updateSimulation();
        
        console.log('📍 Repository node created');
      }

      // Step 2: Add icon after delay
      if (data.icon) {
        setTimeout(() => {
          const repoWithIcon = {
            name: data.repo?.full_name || `${owner}/${repo}`,
            icon: data.icon
          };
          const repoResources = this.repositoryViz.create(repoWithIcon);
          // Don't add to allNodes again, just update visualization
          this.repositoryViz.update(repoResources);
          console.log('🖼️ Repository icon loaded');
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

    // Get center position
    const centerX = this.context.width / 2;
    const centerY = this.context.height / 2;
    
    // Position this contributor in a circle around center
    // Higher contributors (lower index) get closer positions
    const angle = (index / contributors.length) * 2 * Math.PI;
    const baseRadius = 100;
    const radiusIncrement = 25;
    const radius = baseRadius + Math.floor(index / 6) * radiusIncrement; // Groups of 6 per ring
    
    console.log(`📍 Positioning ${contributor.login} (${contributor.contributions} contributions) at radius ${radius}`);
    
    // Create contributor with proper positioning
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    
    const contributorNode: NodeData = {
      id: `contributor-${contributor.id}`,
      type: 'contributor',
      name: contributor.login,
      avatar: contributor.avatar_url,
      contributions: contributor.contributions,
      x: x,
      y: y,
      fx: x, // Fix position initially
      fy: y, // Fix position initially
      vx: 0, // Start with no velocity
      vy: 0
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
    
    // Add new node to simulation without disrupting existing ones
    this.addNodeToSimulation(contributorNode, contributorLink);
    
    // Release the fixed position after animation completes
    setTimeout(() => {
      const nodeInSim = this.allNodes.find(n => n.id === contributorNode.id);
      if (nodeInSim) {
        nodeInSim.fx = null;
        nodeInSim.fy = null;
        console.log(`🔓 Released fixed position for ${contributorNode.id}`);
      }
    }, 500);
    
    // Add next contributor after delay (longer to let physics settle)
    setTimeout(() => {
      this.addContributorsSequentially(contributors, index + 1);
    }, 600);
  }

  private addNodeToSimulation(node: NodeData, link?: LinkData): void {
    console.log(`➕ Adding node ${node.id} to simulation gently`);
    
    // Get current simulation state
    const currentAlpha = this.context.simulation.alpha();
    
    // Update nodes in simulation
    this.context.simulation.nodes(this.allNodes);
    
    // Update links if provided
    if (link) {
      const linkForce = this.context.simulation.force('link');
      if (linkForce) {
        linkForce.links(this.allLinks);
      }
    }
    
    // Only gently reheat the simulation if it was cooling down
    if (currentAlpha < 0.1) {
      this.context.simulation.alpha(0.1).restart();
    }
  }

  private updateSimulation(): void {
    console.log(`🔄 Updating simulation with ${this.allNodes.length} nodes and ${this.allLinks.length} links`);
    
    // Update simulation with all nodes and links
    this.context.simulation
      .nodes(this.allNodes);

    const linkForce = this.context.simulation.force('link');
    if (linkForce) {
      linkForce.links(this.allLinks);
    }

    // Gentle restart - don't use full alpha to avoid nodes flying off
    this.context.simulation.alpha(0.3).restart();
  }

  private tick(): void {
    // Update all node positions, but preserve any existing scale transforms
    this.context.container
      .selectAll('.repo-node, .contributor-node')
      .attr('transform', function(this: any, d: any) {
        const currentTransform = d3.select(this).attr('transform') || '';
        const hasScale = currentTransform.includes('scale');
        const x = d.x || 0;
        const y = d.y || 0;
        
        if (hasScale && currentTransform.includes('scale(0)')) {
          // Don't update position during entrance animation
          return currentTransform;
        }
        
        // Update position while preserving any scale
        if (hasScale) {
          const scaleMatch = currentTransform.match(/scale\([^)]+\)/);
          const scale = scaleMatch ? scaleMatch[0] : 'scale(1)';
          return `translate(${x},${y}) ${scale}`;
        }
        
        return `translate(${x},${y})`;
      });

    // Update link positions
    this.linksViz.updatePositions();
  }

  // Public methods for library usage
  public setDimensions(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.context.width = width;
    this.context.height = height;
    
    this.svg.attr('width', width).attr('height', height);
    
    if (this.context.simulation) {
      this.context.simulation.force('center', d3.forceCenter(width / 2, height / 2));
      this.context.simulation.alpha(0.3).restart();
    }
  }

  public destroy(): void {
    if (this.context.simulation) {
      this.context.simulation.stop();
    }
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