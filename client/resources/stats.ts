import * as d3 from "d3";
import { BaseVisualizationResource } from "./base.js";
import { NodeData, ResourceData } from "../types/index.js";

export class StatsVisualization extends BaseVisualizationResource {
  private onNodeClick?: (nodeData: NodeData) => void;
  private repoData: any = null;

  constructor(context: any, onNodeClick?: (nodeData: NodeData) => void) {
    super(context, "stats");
    this.onNodeClick = onNodeClick;
  }

  public setRepoData(repoData: any): void {
    this.repoData = repoData;
  }

  create(statsData: any): ResourceData {
    const nodes: NodeData[] = [];

    if (!statsData) return { nodes, links: [] };

    // Create 4 stat nodes: stars, PRs, commits, age
    const stats = [
      {
        id: "stat-stars",
        name: `${statsData.stars} ⭐`,
        label: "Stars",
        value: statsData.stars,
      },
      {
        id: "stat-prs",
        name: `${statsData.totalPRs} PRs`,
        label: "Pull Requests",
        value: statsData.totalPRs,
      },
      {
        id: "stat-commits",
        name: `${statsData.totalCommits} commits`,
        label: "Total Commits",
        value: statsData.totalCommits,
      },
      {
        id: "stat-age",
        name: `${statsData.ageInYears}y old`,
        label: "Repository Age",
        value: statsData.ageInYears,
      },
    ];

    stats.forEach((stat, index) => {
      const node: NodeData = {
        id: stat.id,
        type: "stat",
        name: stat.name,
        label: stat.label,
        value: stat.value,
        // Position will be set by organic positioning system
      };
      nodes.push(node);
    });

    return { nodes, links: [] }; // Stats don't create links by themselves
  }

  update(resourceData: ResourceData): void {
    const group = this.getResourceGroup();

    // Bind data to stat nodes
    const statNodes = group
      .selectAll(".stat-node")
      .data(resourceData.nodes, (d: any) => d.id);

    // Remove old nodes
    statNodes.exit().remove();

    // Add new nodes
    const statEnter = statNodes.enter().append("g").attr("class", "gitsee-node stat-node");

    // Add stat values (the number/text) first so we can measure them
    const textElements = statEnter
      .append("text")
      .attr("class", "stat-value")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", "11px")
      .attr("fill", "#E2E8F0")
      .attr("font-weight", "bold")
      .attr("font-family", "system-ui, -apple-system, sans-serif")
      .text((d: NodeData) => d.name);

    // Add background rectangles sized to fit the text with padding
    statEnter.each(function (this: SVGGElement) {
      const group = d3.select(this);
      const textElement = group.select("text").node() as SVGTextElement;

      if (textElement) {
        const bbox = textElement.getBBox();
        const padding = 8; // 8px padding on each side
        const width = bbox.width + padding * 2;
        const height = bbox.height + padding * 2;

        // Insert rectangle before text so it appears behind
        group
          .insert("rect", "text")
          .attr("width", width)
          .attr("height", height)
          .attr("x", -width / 2)
          .attr("y", -height / 2)
          .attr("rx", 4)
          .attr("ry", 4)
          .attr("fill", "#2D3748")
          .attr("stroke", "#4A5568")
          .attr("stroke-width", "2");
      }
    });

    // Add hover effects to new stat nodes
    this.addHoverEffects(statEnter);

    // Add click handlers to new stat nodes - clicking stats shows repo panel
    if (this.onNodeClick) {
      statEnter.on("click", (event: any, d: NodeData) => {
        event.stopPropagation();
        // Create a fake repo node to trigger repo panel display
        const repoNode: NodeData = {
          id: "repo",
          type: "repo",
          name: this.repoData?.name || "Repository",
          x: 0,
          y: 0
        };
        this.onNodeClick!(repoNode);
      });
    }

    // Update positions for all nodes (new and existing)
    const allStatNodes = statEnter.merge(statNodes);
    allStatNodes.attr("transform", (d: NodeData) =>
      d.x !== undefined && d.y !== undefined
        ? `translate(${d.x}, ${d.y})`
        : "translate(0,0)",
    );
  }

  updateWithAnimation(resourceData: ResourceData): void {
    const group = this.getResourceGroup();

    // Bind data to stat nodes
    const statNodes = group
      .selectAll(".stat-node")
      .data(resourceData.nodes, (d: any) => d.id);

    // Remove old nodes with animation
    statNodes.exit().transition().duration(300).style("opacity", 0).remove();

    // Add new nodes
    const statEnter = statNodes
      .enter()
      .append("g")
      .attr("class", "gitsee-node stat-node")
      .style("opacity", 0); // Start invisible

    // Add stat values (the number/text) first so we can measure them
    const textElements = statEnter
      .append("text")
      .attr("class", "stat-value")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", "11px")
      .attr("fill", "#E2E8F0")
      .attr("font-weight", "bold")
      .attr("font-family", "system-ui, -apple-system, sans-serif")
      .text((d: NodeData) => d.name);

    // Add background rectangles sized to fit the text with padding
    statEnter.each(function (this: SVGGElement) {
      const group = d3.select(this);
      const textElement = group.select("text").node() as SVGTextElement;

      if (textElement) {
        const bbox = textElement.getBBox();
        const padding = 8; // 8px padding on each side
        const width = bbox.width + padding * 2;
        const height = bbox.height + padding * 2;

        // Insert rectangle before text so it appears behind
        group
          .insert("rect", "text")
          .attr("width", width)
          .attr("height", height)
          .attr("x", -width / 2)
          .attr("y", -height / 2)
          .attr("rx", 4)
          .attr("ry", 4)
          .attr("fill", "#2D3748")
          .attr("stroke", "#4A5568")
          .attr("stroke-width", "2");
      }
    });

    // Add hover effects to new stat nodes
    this.addHoverEffects(statEnter);

    // Add click handlers to new stat nodes - clicking stats shows repo panel
    if (this.onNodeClick) {
      statEnter.on("click", (event: any, d: NodeData) => {
        event.stopPropagation();
        // Create a fake repo node to trigger repo panel display
        const repoNode: NodeData = {
          id: "repo",
          type: "repo", 
          name: this.repoData?.name || "Repository",
          x: 0,
          y: 0
        };
        this.onNodeClick!(repoNode);
      });
    }

    // Set initial positions and animate in
    const allStatNodes = statEnter.merge(statNodes);
    allStatNodes
      .attr("transform", (d: NodeData) =>
        d.x !== undefined && d.y !== undefined
          ? `translate(${d.x}, ${d.y})`
          : "translate(0,0)",
      )
      .transition()
      .duration(500)
      .ease(d3.easeBackOut)
      .style("opacity", 1);
  }

  destroy(): void {
    const group = this.context.container.select(
      `.${this.getResourceType()}-group`,
    );
    group.remove();
  }

  protected getResourceType(): string {
    return "stats";
  }

  private addHoverEffects(selection: any): void {
    selection
      .style("cursor", "pointer")
      .on("mouseenter", function (this: any, event: any, d: NodeData) {
        const group = d3.select(this);

        // Scale up slightly and brighten colors
        const scale = 1.05;
        const x = d.x !== undefined ? d.x : 0;
        const y = d.y !== undefined ? d.y : 0;
        group
          .transition()
          .duration(200)
          .attr("transform", `translate(${x}, ${y}) scale(${scale})`);

        // Brighten rectangle
        group
          .select("rect")
          .transition()
          .duration(200)
          .attr("fill", "#4A5568")
          .attr("stroke", "#718096")
          .attr("stroke-width", "3");

        // Brighten text
        group.select("text").transition().duration(200).attr("fill", "#FFFFFF");
      })
      .on("mouseleave", function (this: any, event: any, d: NodeData) {
        const group = d3.select(this);

        // Scale back to normal
        const x = d.x !== undefined ? d.x : 0;
        const y = d.y !== undefined ? d.y : 0;
        group
          .transition()
          .duration(200)
          .attr("transform", `translate(${x}, ${y}) scale(1)`);

        // Return rectangle to original colors
        group
          .select("rect")
          .transition()
          .duration(200)
          .attr("fill", "#2D3748")
          .attr("stroke", "#4A5568")
          .attr("stroke-width", "2");

        // Return text to original color
        group.select("text").transition().duration(200).attr("fill", "#E2E8F0");
      });
  }
}
