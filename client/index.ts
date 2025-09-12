import * as d3 from 'd3';

interface NodeData {
  id: string;
  type: "repo" | "contributor";
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

class GitVisualizer {
  private width: number;
  private height: number;
  private svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>;
  private simulation: d3.Simulation<NodeData, LinkData> | null;
  private nodes: NodeData[];
  private links: LinkData[];
  private container!: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  private linkGroup!: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  private nodeGroup!: d3.Selection<SVGGElement, unknown, HTMLElement, any>;

  constructor() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.svg = d3.select("#visualization") as d3.Selection<
      SVGSVGElement,
      unknown,
      HTMLElement,
      any
    >;
    this.svg.attr("width", this.width).attr("height", this.height);

    this.simulation = null;
    this.nodes = [];
    this.links = [];

    this.initializeVisualization();
  }

  private initializeVisualization(): void {
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        this.container.attr("transform", event.transform.toString());
      });

    this.svg.call(zoom);

    this.container = this.svg.append("g");
    this.linkGroup = this.container.append("g").attr("class", "links");
    this.nodeGroup = this.container.append("g").attr("class", "nodes");

    this.simulation = d3
      .forceSimulation<NodeData, LinkData>()
      .force(
        "link",
        d3
          .forceLink<NodeData, LinkData>()
          .id((d: NodeData) => d.id)
          .distance(100)
      )
      .force("charge", d3.forceManyBody<NodeData>().strength(-300))
      .force("center", d3.forceCenter(this.width / 2, this.height / 2))
      .force("collision", d3.forceCollide<NodeData>().radius(35));
  }

  async visualize(owner: string, repo: string): Promise<void> {
    try {
      console.log(`🚀 Visualizing ${owner}/${repo}...`);

      // Clear existing visualization
      this.nodes = [];
      this.links = [];

      // Fetch data from API
      const data = await this.fetchRepoData(owner, repo);
      console.log('📦 API Response:', { hasRepo: !!data.repo, hasContributors: !!data.contributors, hasIcon: !!data.icon, iconLength: data.icon?.length });

      if (data.error) {
        throw new Error(data.error);
      }

      // Add repo node
      const repoName = data.repo?.full_name || `${owner}/${repo}`;
      console.log('🎨 Adding repo node with icon:', !!data.icon);
      this.addRepoNode(repoName, data.icon);

      // Add contributors
      if (data.contributors) {
        this.addContributors(data.contributors);
      }

      // Update visualization
      this.updateVisualization();

      console.log(`✅ Successfully visualized ${owner}/${repo}`);
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
        data: ["repo_info", "contributors", "icon"],
      }),
    });

    if (!response.ok) {
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }

  private addRepoNode(name: string, icon?: string | null): void {
    const repoNode: NodeData = {
      id: "repo",
      type: "repo",
      name,
      x: this.width / 2,
      y: this.height / 2,
      fx: this.width / 2,
      fy: this.height / 2,
      avatar: icon || undefined,
    };

    this.nodes.push(repoNode);
  }

  private addContributors(contributors: any[]): void {
    contributors.forEach((contributor) => {
      const contributorNode: NodeData = {
        id: `contributor-${contributor.id}`,
        type: "contributor",
        name: contributor.login,
        avatar: contributor.avatar_url,
        contributions: contributor.contributions,
      };

      const link: LinkData = {
        source: "repo",
        target: contributorNode.id,
      };

      this.nodes.push(contributorNode);
      this.links.push(link);
    });
  }

  private updateVisualization(): void {
    console.log("🔄 Updating visualization...");

    // Update links
    const links = this.linkGroup
      .selectAll<SVGLineElement, LinkData>(".link")
      .data(this.links, (d: LinkData) => {
        const sourceId = typeof d.source === "string" ? d.source : d.source.id;
        const targetId = typeof d.target === "string" ? d.target : d.target.id;
        return `${sourceId}-${targetId}`;
      });

    links.enter().append("line").attr("class", "link");

    links.exit().remove();

    // Update nodes
    const nodes = this.nodeGroup
      .selectAll<SVGGElement, NodeData>(".node")
      .data(this.nodes, (d: NodeData) => d.id);

    const nodeEnter = nodes
      .enter()
      .append("g")
      .attr("class", "node")
      .call(
        d3
          .drag<SVGGElement, NodeData>()
          .on("start", this.dragstarted.bind(this))
          .on("drag", this.dragged.bind(this))
          .on("end", this.dragended.bind(this))
      );

    const nodeUpdate = nodes.merge(nodeEnter);

    // Clear and rebuild repo nodes
    nodeUpdate
      .filter((d: NodeData) => d.type === "repo")
      .selectAll("*")
      .remove();
    const repoNodes = nodeUpdate.filter((d: NodeData) => d.type === "repo");

    // Add avatar patterns for repo nodes with icons
    repoNodes
      .filter((d: NodeData) => !!d.avatar)
      .append("defs")
      .append("pattern")
      .attr("id", (d: NodeData) => `repo-avatar-${d.id}`)
      .attr("patternUnits", "objectBoundingBox")
      .attr("width", 1)
      .attr("height", 1)
      .append("image")
      .attr("href", (d: NodeData) => d.avatar || "")
      .attr("width", 50)
      .attr("height", 50)
      .attr("x", 0)
      .attr("y", 0);

    // Add circles for repo nodes
    repoNodes
      .append("circle")
      .attr("r", 25)
      .attr("fill", (d: NodeData) =>
        d.avatar ? `url(#repo-avatar-${d.id})` : "#1f6feb"
      )
      .attr("stroke", "#0969da")
      .attr("stroke-width", 2);

    // Add fallback icons for repo nodes without avatars
    repoNodes
      .filter((d: NodeData) => !d.avatar)
      .append("path")
      .attr(
        "d",
        "M-8,-8 L8,-8 L8,8 L-8,8 Z M-6,-6 L6,-6 M-6,-3 L6,-3 M-6,0 L6,0 M-6,3 L6,3 M-6,6 L6,6"
      )
      .attr("fill", "none")
      .attr("stroke", "white")
      .attr("stroke-width", "1.5");

    // Add labels for repo nodes
    repoNodes
      .append("text")
      .attr("class", "node-label")
      .attr("dy", 35)
      .text((d: NodeData) => d.name);

    // Handle contributor nodes (only for new ones)
    const contributorNodes = nodeEnter.filter(
      (d: NodeData) => d.type === "contributor"
    );

    // Add avatar patterns for contributor nodes
    contributorNodes
      .append("defs")
      .append("pattern")
      .attr("id", (d: NodeData) => `avatar-${d.id}`)
      .attr("patternUnits", "objectBoundingBox")
      .attr("width", 1)
      .attr("height", 1)
      .append("image")
      .attr("href", (d: NodeData) => d.avatar || "")
      .attr("width", 30)
      .attr("height", 30)
      .attr("x", 0)
      .attr("y", 0);

    contributorNodes
      .append("circle")
      .attr("r", 15)
      .attr("fill", (d: NodeData) => `url(#avatar-${d.id})`)
      .attr("stroke", "#1f6feb")
      .attr("stroke-width", 1.5);

    contributorNodes
      .append("text")
      .attr("class", "node-label")
      .attr("dy", 25)
      .text((d: NodeData) => d.name);

    nodes.exit().remove();

    // Update simulation
    if (this.simulation) {
      this.simulation.nodes(this.nodes).on("tick", this.ticked.bind(this));

      const linkForce = this.simulation.force("link") as d3.ForceLink<
        NodeData,
        LinkData
      >;
      if (linkForce) {
        linkForce.links(this.links);
      }

      this.simulation.alpha(1).restart();
    }
  }

  private ticked(): void {
    this.linkGroup
      .selectAll<SVGLineElement, LinkData>(".link")
      .attr("x1", (d: LinkData) => (d.source as NodeData).x || 0)
      .attr("y1", (d: LinkData) => (d.source as NodeData).y || 0)
      .attr("x2", (d: LinkData) => (d.target as NodeData).x || 0)
      .attr("y2", (d: LinkData) => (d.target as NodeData).y || 0);

    this.nodeGroup
      .selectAll<SVGGElement, NodeData>(".node")
      .attr("transform", (d: NodeData) => `translate(${d.x || 0},${d.y || 0})`);
  }

  private dragstarted(
    event: d3.D3DragEvent<SVGGElement, NodeData, NodeData>,
    d: NodeData
  ): void {
    if (!event.active && this.simulation) {
      this.simulation.alphaTarget(0.3).restart();
    }
    d.fx = d.x;
    d.fy = d.y;
  }

  private dragged(
    event: d3.D3DragEvent<SVGGElement, NodeData, NodeData>,
    d: NodeData
  ): void {
    d.fx = event.x;
    d.fy = event.y;
  }

  private dragended(
    event: d3.D3DragEvent<SVGGElement, NodeData, NodeData>,
    d: NodeData
  ): void {
    if (!event.active && this.simulation) {
      this.simulation.alphaTarget(0);
    }
    if (d.type !== "repo") {
      d.fx = null;
      d.fy = null;
    }
  }
}

// Get repo from URL query parameter and initialize
const urlParams = new URLSearchParams(window.location.search);
const repoParam = urlParams.get("repo") || "stakwork/hive";
const [owner, repo] = repoParam.split("/");

const visualizer = new GitVisualizer();
if (owner && repo) {
  visualizer.visualize(owner, repo);
} else {
  console.error("Invalid repo format. Use: ?repo=owner/repo");
}
