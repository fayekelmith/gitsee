import * as d3 from "d3";
import { BaseVisualizationResource } from "./base.js";
import { LinkData, ResourceData } from "../types/index.js";

export class LinksVisualization extends BaseVisualizationResource {
  constructor(context: any) {
    super(context, "links");
  }

  create(linksData: LinkData[]): ResourceData {
    console.log(
      `🏗️ Creating links visualization for ${linksData.length} links...`,
    );

    return {
      nodes: [], // Links don't create nodes
      links: linksData,
    };
  }

  update(resourceData: ResourceData): void {
    console.log("🔄 Updating links visualization...");

    const group = this.getResourceGroup();

    // Bind data
    const links = group
      .selectAll(".gitsee-link")
      .data(resourceData.links, (d: LinkData) => d.id);

    // Remove old links
    links.exit().remove();

    // Add new links
    links
      .enter()
      .append("line")
      .attr("class", "gitsee-link")
      .style("stroke", (d: LinkData) => this.getLinkColor(d.type))
      .style("stroke-width", (d: LinkData) => this.getLinkWidth(d.type))
      .style("stroke-opacity", 0.8);
  }

  updateWithAnimation(resourceData: ResourceData): void {
    console.log(
      `🎭 Updating links visualization with animation for ${resourceData.links.length} links...`,
    );

    const group = this.getResourceGroup();

    // Bind data
    const links = group
      .selectAll(".gitsee-link")
      .data(resourceData.links, (d: LinkData) => d.id);

    // Remove old links
    links.exit().remove();

    // Add new links with entrance animation (only NEW links will enter)
    const linksEnter = links
      .enter()
      .append("line")
      .attr("class", "gitsee-link")
      .style("stroke", (d: LinkData) => this.getLinkColor(d.type))
      .style("stroke-width", (d: LinkData) => this.getLinkWidth(d.type))
      .style("stroke-opacity", 0);

    // Animate entrance for new links only
    linksEnter.transition().duration(400).style("stroke-opacity", 0.8);

    console.log(
      `✅ Links update complete. Total visible: ${links.merge(linksEnter).size()}`,
    );

    // Note: Positions will be updated by the caller using updatePositions()
  }

  private getLinkColor(linkType?: string): string {
    switch (linkType) {
      case "contribution":
        return "#30363d";
      case "commit":
        return "#1f6feb";
      case "branch":
        return "#238636";
      case "dependency":
        return "#f85149";
      default:
        return "#30363d";
    }
  }

  private getLinkWidth(linkType?: string): string {
    switch (linkType) {
      case "contribution":
        return "1.5px";
      case "commit":
        return "2px";
      case "branch":
        return "2.5px";
      case "dependency":
        return "1px";
      default:
        return "1.5px";
    }
  }

  /**
   * Update link positions based on node positions
   * Now works with string IDs and finds actual node positions
   */
  updatePositions(allNodes: any[] = []): void {
    const group = this.getResourceGroup();

    group
      .selectAll(".gitsee-link")
      .attr("x1", (d: LinkData) => {
        const sourceId = typeof d.source === "string" ? d.source : d.source.id;
        const sourceNode = allNodes.find((n) => n.id === sourceId);
        return sourceNode?.x || 0;
      })
      .attr("y1", (d: LinkData) => {
        const sourceId = typeof d.source === "string" ? d.source : d.source.id;
        const sourceNode = allNodes.find((n) => n.id === sourceId);
        return sourceNode?.y || 0;
      })
      .attr("x2", (d: LinkData) => {
        const targetId = typeof d.target === "string" ? d.target : d.target.id;
        const targetNode = allNodes.find((n) => n.id === targetId);
        return targetNode?.x || 0;
      })
      .attr("y2", (d: LinkData) => {
        const targetId = typeof d.target === "string" ? d.target : d.target.id;
        const targetNode = allNodes.find((n) => n.id === targetId);
        return targetNode?.y || 0;
      });
  }

  destroy(): void {
    console.log("🗑️ Destroying links visualization...");
    this.getResourceGroup().remove();
  }
}
