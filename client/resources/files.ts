import * as d3 from "d3";
import { BaseVisualizationResource } from "./base.js";
import { NodeData, ResourceData } from "../types/index.js";

export class FilesVisualization extends BaseVisualizationResource {
  constructor(context: any) {
    super(context, "files");
  }
  create(files: any[]): ResourceData {
    const nodes: NodeData[] = [];

    files.forEach((file, index) => {
      const node: NodeData = {
        id: `file-${file.name}`,
        type: "file",
        name: file.name,
        // Position will be set by organic positioning system
      };
      nodes.push(node);
    });

    return { nodes, links: [] }; // Files don't create links by themselves
  }

  update(resourceData: ResourceData): void {
    const group = this.getResourceGroup();

    // Bind data to file nodes
    const fileNodes = group
      .selectAll(".file-node")
      .data(resourceData.nodes, (d: any) => d.id);

    // Remove old nodes
    fileNodes.exit().remove();

    // Add new nodes
    const fileEnter = fileNodes.enter().append("g").attr("class", "file-node");

    // Add file icons (SVG path for a clean file icon) - white outline with grey fill
    fileEnter
      .append("path")
      .attr("class", "file-icon")
      .attr("d", "M-8,-10 L3,-10 L8,-5 L8,10 L-8,10 Z M3,-10 L3,-5 L8,-5")
      .attr("fill", "#666666") // Grey fill
      .attr("stroke", "white")
      .attr("stroke-width", "1.5")
      .attr("stroke-linejoin", "round");

    // Add file labels below the icon with better visibility
    fileEnter
      .append("text")
      .attr("class", "file-label")
      .attr("text-anchor", "middle")
      .attr("y", 22) // Below the icon
      .attr("font-size", "11px")
      .attr("fill", "#b6b6b6") // Light color for better visibility
      .attr("font-family", "system-ui, -apple-system, sans-serif")
      .attr("font-weight", "500")
      .text((d: NodeData) => d.name);

    // Update positions for all nodes (new and existing)
    const allFileNodes = fileEnter.merge(fileNodes);
    allFileNodes.attr("transform", (d: NodeData) =>
      d.x !== undefined && d.y !== undefined
        ? `translate(${d.x}, ${d.y})`
        : "translate(0,0)",
    );
  }

  updateWithAnimation(resourceData: ResourceData): void {
    const group = this.getResourceGroup();

    // Bind data to file nodes
    const fileNodes = group
      .selectAll(".file-node")
      .data(resourceData.nodes, (d: any) => d.id);

    // Remove old nodes with animation
    fileNodes.exit().transition().duration(300).style("opacity", 0).remove();

    // Add new nodes
    const fileEnter = fileNodes
      .enter()
      .append("g")
      .attr("class", "file-node")
      .style("opacity", 0); // Start invisible

    // Add file icons (SVG path for a clean file icon) - white outline with grey fill
    fileEnter
      .append("path")
      .attr("class", "file-icon")
      .attr("d", "M-8,-10 L3,-10 L8,-5 L8,10 L-8,10 Z M3,-10 L3,-5 L8,-5")
      .attr("fill", "#666666") // Grey fill
      .attr("stroke", "white")
      .attr("stroke-width", "1.5")
      .attr("stroke-linejoin", "round");

    // Add file labels below the icon with better visibility
    fileEnter
      .append("text")
      .attr("class", "file-label")
      .attr("text-anchor", "middle")
      .attr("y", 22) // Below the icon
      .attr("font-size", "11px")
      .attr("fill", "#b6b6b6") // Light color for better visibility
      .attr("font-family", "system-ui, -apple-system, sans-serif")
      .attr("font-weight", "500")
      .text((d: NodeData) => d.name);

    // Set initial positions and animate in
    const allFileNodes = fileEnter.merge(fileNodes);
    allFileNodes
      .attr("transform", (d: NodeData) =>
        d.x !== undefined && d.y !== undefined
          ? `translate(${d.x}, ${d.y})`
          : "translate(0,0)",
      )
      .transition()
      .duration(600)
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
    return "files";
  }
}
