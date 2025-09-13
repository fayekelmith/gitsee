import * as d3 from "d3";
import { BaseVisualizationResource } from "./base.js";
import { NodeData, ResourceData } from "../types/index.js";
import { PanelContent } from "../panel/types.js";

export class FilesVisualization extends BaseVisualizationResource {
  private onNodeClick?: (nodeData: NodeData) => void;

  constructor(context: any, onNodeClick?: (nodeData: NodeData) => void) {
    super(context, "files");
    this.onNodeClick = onNodeClick;
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
    const fileEnter = fileNodes
      .enter()
      .append("g")
      .attr("class", "gitsee-node file-node");

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

    // Add hover effects to new file nodes
    this.addHoverEffects(fileEnter);

    // Add click handlers to new file nodes
    if (this.onNodeClick) {
      fileEnter.on("click", (event: any, d: NodeData) => {
        event.stopPropagation();
        this.onNodeClick!(d);
      });
    }

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
      .attr("class", "gitsee-node file-node")
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

    // Add hover effects to new file nodes
    this.addHoverEffects(fileEnter);

    // Add click handlers to new file nodes
    if (this.onNodeClick) {
      fileEnter.on("click", (event: any, d: NodeData) => {
        event.stopPropagation();
        this.onNodeClick!(d);
      });
    }

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

  private addHoverEffects(selection: any): void {
    selection
      .style("cursor", "pointer")
      .on("mouseenter", function (this: any, event: any, d: NodeData) {
        const group = d3.select(this);

        // Scale up slightly
        const scale = 1.05;
        const x = d.x !== undefined ? d.x : 0;
        const y = d.y !== undefined ? d.y : 0;
        group
          .transition()
          .duration(200)
          .attr("transform", `translate(${x}, ${y}) scale(${scale})`);

        // Brighten file icon
        group
          .select("path")
          .transition()
          .duration(200)
          .attr("fill", "#999999")
          .attr("stroke", "#FFFFFF")
          .attr("stroke-width", "2");

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

        // Return file icon to original colors
        group
          .select("path")
          .transition()
          .duration(200)
          .attr("fill", "#666666")
          .attr("stroke", "white")
          .attr("stroke-width", "1.5");

        // Return text to original color
        group.select("text").transition().duration(200).attr("fill", "#b6b6b6");
      });
  }

  public getPanelContent(nodeData: NodeData, fileData?: any): PanelContent {
    return {
      name: nodeData.name,
      sections: [
        {
          title: "Content",
          type: "content",
          data: fileData?.content || "// File content would be loaded here...",
        },
      ],
    };
  }
}
