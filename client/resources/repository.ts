import * as d3 from "d3";
import { BaseVisualizationResource } from "./base.js";
import { NodeData, ResourceData } from "../types/index.js";

export class RepositoryVisualization extends BaseVisualizationResource {
  constructor(context: any) {
    super(context, "repository");
  }

  create(repoData: any): ResourceData {
    console.log("🏗️ Creating repository visualization...");

    const centerX = this.context.width / 2;
    const centerY = this.context.height / 2;

    console.log(
      `📏 Context dimensions: ${this.context.width} x ${this.context.height}`,
    );
    console.log(
      `🎯 Positioning repository at center: (${centerX}, ${centerY})`,
    );

    const repoNode: NodeData = {
      id: "repo",
      type: "repo",
      name: repoData.name,
      x: centerX,
      y: centerY,
      avatar: repoData.icon,
    };

    return {
      nodes: [repoNode],
      links: [],
    };
  }

  update(resourceData: ResourceData): void {
    console.log("🔄 Updating repository visualization...");

    const group = this.getResourceGroup();

    // Bind data
    const nodes = group
      .selectAll(".repo-node")
      .data(resourceData.nodes, (d: NodeData) => d.id);

    // Remove old nodes
    nodes.exit().remove();

    // Add new nodes
    const nodeEnter = nodes
      .enter()
      .append("g")
      .attr("class", "repo-node")
      .call(this.createDragBehavior());

    // Position all nodes at their calculated positions
    const nodeUpdate = nodes.merge(nodeEnter);
    nodeUpdate.attr("transform", (d: NodeData) => {
      const x = d.x || 0;
      const y = d.y || 0;
      console.log(`🎯 Positioning repo node at (${x}, ${y})`);
      return `translate(${x},${y})`;
    });

    // Only build visual elements for NEW nodes (nodeEnter)
    nodeEnter.each((d: NodeData, i: number, nodes: any) => {
      const node = d3.select(nodes[i]);

      if (d.avatar) {
        // Create avatar pattern and use it as fill (pass radius, not diameter)
        const repoRadius = 25;
        const fillPattern = this.createAvatarPattern(d, repoRadius);
        const circle = node
          .append("circle")
          .attr("r", repoRadius)
          .style("fill", fillPattern)
          .style("stroke", "#0969da")
          .style("stroke-width", "2px");

        // Add subtle pulse animation for icon loading
        circle
          .style("opacity", 0.7)
          .transition()
          .duration(300)
          .style("opacity", 1);
      } else {
        // Default repo styling with fallback icon
        node
          .append("circle")
          .attr("r", 25)
          .style("fill", "#1f6feb")
          .style("stroke", "#0969da")
          .style("stroke-width", "2px");

        // Add fallback GitHub folder icon
        node
          .append("path")
          .attr(
            "d",
            "M-8,-8 L8,-8 L8,8 L-8,8 Z M-6,-6 L6,-6 M-6,-3 L6,-3 M-6,0 L6,0 M-6,3 L6,3 M-6,6 L6,6",
          )
          .style("fill", "none")
          .style("stroke", "white")
          .style("stroke-width", "1.5px");
      }

      // Add label
      this.createNodeLabel(node, d, 35);
    });

    // Update existing nodes that now have avatars (for icon loading)
    nodes.each((d: NodeData, i: number, nodeElements: any) => {
      const node = d3.select(nodeElements[i]);
      const existingCircle = node.select("circle");

      // If node has avatar but circle doesn't have avatar pattern, update it
      if (d.avatar && existingCircle.size() > 0) {
        const currentFill = existingCircle.style("fill");
        if (!currentFill || currentFill.indexOf("url(") === -1) {
          console.log("🖼️ Updating existing repo node with avatar");

          // Remove the fallback GitHub folder icon first
          node.select("path").remove();

          const repoRadius = 25;
          const fillPattern = this.createAvatarPattern(d, repoRadius);
          existingCircle
            .style("fill", fillPattern)
            .style("opacity", 0.7)
            .transition()
            .duration(300)
            .style("opacity", 1);
        }
      }
    });
  }

  destroy(): void {
    console.log("🗑️ Destroying repository visualization...");
    this.getResourceGroup().remove();
  }
}
