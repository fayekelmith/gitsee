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
      .force('link', d3.forceLink().id((d: any) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(this.width / 2, this.height / 2))
      .force('collision', d3.forceCollide().radius(35));

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

      // Create repository visualization
      if (data.repo || data.icon) {
        const repoData = {
          name: data.repo?.full_name || `${owner}/${repo}`,
          icon: data.icon
        };
        const repoResources = this.repositoryViz.create(repoData);
        this.addResources(repoResources);
        this.repositoryViz.update(repoResources);
      }

      // Create contributors visualization
      if (data.contributors) {
        const contributorResources = this.contributorsViz.create(data.contributors);
        this.addResources(contributorResources);
        this.contributorsViz.update(contributorResources);
        
        // Create links between repo and contributors
        const linksResources = this.linksViz.create(contributorResources.links);
        this.addResources(linksResources);
        this.linksViz.update(linksResources);
      }

      // Update the simulation
      this.updateSimulation();

      console.log(`✅ Successfully visualized ${owner}/${repo}`);
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

  private updateSimulation(): void {
    console.log(`🔄 Updating simulation with ${this.allNodes.length} nodes and ${this.allLinks.length} links`);
    
    // Update simulation with all nodes and links
    this.context.simulation
      .nodes(this.allNodes);

    const linkForce = this.context.simulation.force('link');
    if (linkForce) {
      linkForce.links(this.allLinks);
    }

    this.context.simulation.alpha(1).restart();
  }

  private tick(): void {
    // Update all node positions
    this.context.container
      .selectAll('.repo-node, .contributor-node')
      .attr('transform', (d: any) => `translate(${d.x || 0},${d.y || 0})`);

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