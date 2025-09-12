import * as d3 from 'd3';

interface GitSeeConfig {
  svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any> | SVGSVGElement;
  apiEndpoint: string;
  width?: number;
  height?: number;
}

interface NodeData {
  id: string;
  type: 'repo' | 'contributor';
  name: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  avatar?: string;
  contributions?: number;
}

interface LinkData {
  source: string | NodeData;
  target: string | NodeData;
}

interface ApiResponse {
  repo?: any;
  contributors?: any[];
  icon?: string | null;
  error?: string;
}

export class GitSee {
  private svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>;
  private apiEndpoint: string;
  private width: number;
  private height: number;
  private container: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  private linkGroup: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  private nodeGroup: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  private simulation: d3.Simulation<NodeData, LinkData> | null = null;
  private nodes: NodeData[] = [];
  private links: LinkData[] = [];

  constructor(config: GitSeeConfig) {
    // Handle both d3 selection and raw SVG element
    if ('node' in config.svg) {
      this.svg = config.svg as d3.Selection<SVGSVGElement, unknown, HTMLElement, any>;
    } else {
      this.svg = d3.select(config.svg as SVGSVGElement);
    }
    
    this.apiEndpoint = config.apiEndpoint;
    
    // Get dimensions from SVG or use provided/default values
    const svgNode = this.svg.node();
    const rect = svgNode?.getBoundingClientRect();
    this.width = config.width || rect?.width || 800;
    this.height = config.height || rect?.height || 600;
    
    this.initializeVisualization();
  }

  private initializeVisualization(): void {
    // Clear any existing content
    this.svg.selectAll('*').remove();
    
    // Set SVG dimensions
    this.svg
      .attr('width', this.width)
      .attr('height', this.height);

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        this.container.attr('transform', event.transform.toString());
      });

    this.svg.call(zoom);

    // Create main container
    this.container = this.svg.append('g').attr('class', 'gitsee-container');
    
    // Create groups for links and nodes
    this.linkGroup = this.container.append('g').attr('class', 'gitsee-links');
    this.nodeGroup = this.container.append('g').attr('class', 'gitsee-nodes');

    // Initialize force simulation
    this.simulation = d3.forceSimulation<NodeData, LinkData>()
      .force('link', d3.forceLink<NodeData, LinkData>().id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody<NodeData>().strength(-300))
      .force('center', d3.forceCenter(this.width / 2, this.height / 2))
      .force('collision', d3.forceCollide<NodeData>().radius(35));
  }

  async visualize(owner: string, repo: string): Promise<void> {
    try {
      console.log(`🚀 Visualizing ${owner}/${repo}...`);
      
      // Clear existing visualization
      this.clearVisualization();
      
      // Fetch data from API
      const data = await this.fetchRepoData(owner, repo, ['repo_info', 'contributors', 'icon']);
      
      if (data.error) {
        throw new Error(data.error);
      }

      // Add repo node
      const repoName = data.repo?.full_name || `${owner}/${repo}`;
      this.addRepoNode(repoName, data.icon);

      // Add contributors
      if (data.contributors) {
        this.addContributors(data.contributors);
      }

      // Update visualization
      this.updateVisualization();

      console.log(`✅ Successfully visualized ${owner}/${repo}`);
    } catch (error) {
      console.error('Error visualizing repository:', error);
      throw error;
    }
  }

  async visualizeMultiple(repos: [string, string][]): Promise<void> {
    console.log(`🚀 Visualizing ${repos.length} repositories...`);
    
    this.clearVisualization();
    
    // For now, just visualize them sequentially
    // In the future, we could add more sophisticated multi-repo layouts
    for (let i = 0; i < repos.length; i++) {
      const [owner, repo] = repos[i];
      
      try {
        const data = await this.fetchRepoData(owner, repo, ['repo_info', 'contributors', 'icon']);
        
        if (data.error) {
          console.error(`Error fetching ${owner}/${repo}:`, data.error);
          continue;
        }

        // Position repos in different areas
        const angle = (i / repos.length) * 2 * Math.PI;
        const radius = Math.min(this.width, this.height) * 0.3;
        const centerX = this.width / 2 + Math.cos(angle) * radius;
        const centerY = this.height / 2 + Math.sin(angle) * radius;

        // Add repo node with offset position
        const repoName = data.repo?.full_name || `${owner}/${repo}`;
        this.addRepoNode(repoName, data.icon, centerX, centerY);

        // Add contributors for this repo
        if (data.contributors) {
          this.addContributors(data.contributors, `repo-${i}`);
        }
      } catch (error) {
        console.error(`Error visualizing ${owner}/${repo}:`, error);
      }
    }
    
    this.updateVisualization();
  }

  private async fetchRepoData(owner: string, repo: string, data: string[]): Promise<ApiResponse> {
    const response = await fetch(this.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ owner, repo, data })
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private clearVisualization(): void {
    this.nodes = [];
    this.links = [];
    this.nodeGroup.selectAll('*').remove();
    this.linkGroup.selectAll('*').remove();
  }

  private addRepoNode(name: string, icon?: string | null, x?: number, y?: number): void {
    const repoNode: NodeData = {
      id: `repo-${this.nodes.filter(n => n.type === 'repo').length}`,
      type: 'repo',
      name,
      x: x || this.width / 2,
      y: y || this.height / 2,
      fx: x || this.width / 2,
      fy: y || this.height / 2,
      avatar: icon || undefined
    };

    this.nodes.push(repoNode);
  }

  private addContributors(contributors: any[], repoId: string = 'repo-0'): void {
    contributors.forEach((contributor) => {
      const contributorNode: NodeData = {
        id: `${repoId}-contributor-${contributor.id}`,
        type: 'contributor',
        name: contributor.login,
        avatar: contributor.avatar_url,
        contributions: contributor.contributions
      };

      const link: LinkData = {
        source: repoId,
        target: contributorNode.id
      };

      this.nodes.push(contributorNode);
      this.links.push(link);
    });
  }

  private updateVisualization(): void {
    console.log('🔄 Updating visualization...');

    // Update links
    const links = this.linkGroup
      .selectAll<SVGLineElement, LinkData>('.gitsee-link')
      .data(this.links, (d: LinkData) => {
        const sourceId = typeof d.source === 'string' ? d.source : d.source.id;
        const targetId = typeof d.target === 'string' ? d.target : d.target.id;
        return `${sourceId}-${targetId}`;
      });

    links.enter()
      .append('line')
      .attr('class', 'gitsee-link')
      .style('stroke', '#30363d')
      .style('stroke-width', '1.5px');

    links.exit().remove();

    // Update nodes
    const nodes = this.nodeGroup
      .selectAll<SVGGElement, NodeData>('.gitsee-node')
      .data(this.nodes, (d: NodeData) => d.id);

    const nodeEnter = nodes.enter()
      .append('g')
      .attr('class', 'gitsee-node')
      .style('cursor', 'pointer')
      .call(d3.drag<SVGGElement, NodeData>()
        .on('start', this.dragstarted.bind(this))
        .on('drag', this.dragged.bind(this))
        .on('end', this.dragended.bind(this)));

    const nodeUpdate = nodes.merge(nodeEnter);

    // Clear and rebuild repo nodes
    nodeUpdate.filter((d: NodeData) => d.type === 'repo').selectAll('*').remove();
    const repoNodes = nodeUpdate.filter((d: NodeData) => d.type === 'repo');

    // Add avatar patterns for repo nodes with icons
    repoNodes.filter((d: NodeData) => !!d.avatar)
      .append('defs')
      .append('pattern')
      .attr('id', (d: NodeData) => `gitsee-repo-avatar-${d.id}`)
      .attr('patternUnits', 'objectBoundingBox')
      .attr('width', 1)
      .attr('height', 1)
      .append('image')
      .attr('href', (d: NodeData) => d.avatar || '')
      .attr('width', 50)
      .attr('height', 50)
      .attr('x', 0)
      .attr('y', 0);

    // Add circles for repo nodes
    repoNodes.append('circle')
      .attr('r', 25)
      .style('fill', (d: NodeData) => d.avatar ? `url(#gitsee-repo-avatar-${d.id})` : '#1f6feb')
      .style('stroke', '#0969da')
      .style('stroke-width', '2px');

    // Add fallback icons for repo nodes without avatars
    repoNodes.filter((d: NodeData) => !d.avatar)
      .append('path')
      .attr('d', 'M-8,-8 L8,-8 L8,8 L-8,8 Z M-6,-6 L6,-6 M-6,-3 L6,-3 M-6,0 L6,0 M-6,3 L6,3 M-6,6 L6,6')
      .style('fill', 'none')
      .style('stroke', 'white')
      .style('stroke-width', '1.5px');

    // Add labels for repo nodes
    repoNodes.append('text')
      .attr('dy', 35)
      .style('fill', '#e6edf3')
      .style('font-size', '12px')
      .style('font-weight', '500')
      .style('text-anchor', 'middle')
      .style('pointer-events', 'none')
      .text((d: NodeData) => d.name);

    // Handle contributor nodes (only for new ones)
    const contributorNodes = nodeEnter.filter((d: NodeData) => d.type === 'contributor');

    // Add avatar patterns for contributor nodes
    contributorNodes
      .append('defs')
      .append('pattern')
      .attr('id', (d: NodeData) => `gitsee-avatar-${d.id}`)
      .attr('patternUnits', 'objectBoundingBox')
      .attr('width', 1)
      .attr('height', 1)
      .append('image')
      .attr('href', (d: NodeData) => d.avatar || '')
      .attr('width', 30)
      .attr('height', 30)
      .attr('x', 0)
      .attr('y', 0);

    contributorNodes
      .append('circle')
      .attr('r', 15)
      .style('fill', (d: NodeData) => `url(#gitsee-avatar-${d.id})`)
      .style('stroke', '#1f6feb')
      .style('stroke-width', '1.5px');

    contributorNodes.append('text')
      .attr('dy', 25)
      .style('fill', '#e6edf3')
      .style('font-size', '12px')
      .style('font-weight', '500')
      .style('text-anchor', 'middle')
      .style('pointer-events', 'none')
      .text((d: NodeData) => d.name);

    nodes.exit().remove();

    // Update simulation
    if (this.simulation) {
      this.simulation
        .nodes(this.nodes)
        .on('tick', this.ticked.bind(this));

      const linkForce = this.simulation.force('link') as d3.ForceLink<NodeData, LinkData>;
      if (linkForce) {
        linkForce.links(this.links);
      }

      this.simulation.alpha(1).restart();
    }
  }

  private ticked(): void {
    this.linkGroup.selectAll<SVGLineElement, LinkData>('.gitsee-link')
      .attr('x1', (d: LinkData) => (d.source as NodeData).x || 0)
      .attr('y1', (d: LinkData) => (d.source as NodeData).y || 0)
      .attr('x2', (d: LinkData) => (d.target as NodeData).x || 0)
      .attr('y2', (d: LinkData) => (d.target as NodeData).y || 0);

    this.nodeGroup.selectAll<SVGGElement, NodeData>('.gitsee-node')
      .attr('transform', (d: NodeData) => `translate(${d.x || 0},${d.y || 0})`);
  }

  private dragstarted(event: d3.D3DragEvent<SVGGElement, NodeData, NodeData>, d: NodeData): void {
    if (!event.active && this.simulation) {
      this.simulation.alphaTarget(0.3).restart();
    }
    d.fx = d.x;
    d.fy = d.y;
  }

  private dragged(event: d3.D3DragEvent<SVGGElement, NodeData, NodeData>, d: NodeData): void {
    d.fx = event.x;
    d.fy = event.y;
  }

  private dragended(event: d3.D3DragEvent<SVGGElement, NodeData, NodeData>, d: NodeData): void {
    if (!event.active && this.simulation) {
      this.simulation.alphaTarget(0);
    }
    if (d.type !== 'repo') {
      d.fx = null;
      d.fy = null;
    }
  }

  // Public methods for customization
  public setDimensions(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.svg.attr('width', width).attr('height', height);
    
    if (this.simulation) {
      this.simulation.force('center', d3.forceCenter(width / 2, height / 2));
      this.simulation.alpha(0.3).restart();
    }
  }

  public destroy(): void {
    if (this.simulation) {
      this.simulation.stop();
    }
    this.svg.selectAll('*').remove();
  }
}