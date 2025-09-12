import * as d3 from "d3";
import {
  NodeData,
  LinkData,
  VisualizationContext,
  ResourceData,
} from "../types/index.js";

export abstract class BaseVisualizationResource {
  protected context: VisualizationContext;
  protected resourceType: string;

  constructor(context: VisualizationContext, resourceType: string) {
    this.context = context;
    this.resourceType = resourceType;
  }

  /**
   * Create initial visualization elements for this resource type
   * Called once when data is first loaded
   */
  abstract create(data: any[]): ResourceData;

  /**
   * Update existing visualization elements
   * Called when data changes or needs re-rendering
   */
  abstract update(resourceData: ResourceData): void;

  /**
   * Clean up and remove all elements for this resource type
   */
  abstract destroy(): void;

  /**
   * Get the group element for this resource type
   * Creates it if it doesn't exist, but tries to maintain z-order
   */
  protected getResourceGroup(): any {
    let group = this.context.container.select(`.${this.resourceType}-group`);
    if (group.empty()) {
      // Check if this is the links group and if other groups exist
      if (this.resourceType === "links") {
        // Links should be first - insert at the beginning
        const firstChild = this.context.container.node()?.firstChild;
        group = this.context.container
          .insert("g", () => firstChild)
          .attr("class", `${this.resourceType}-group`);
      } else {
        // Other groups can be appended normally
        group = this.context.container
          .append("g")
          .attr("class", `${this.resourceType}-group`);
      }
    }
    return group;
  }

  /**
   * Helper method to create unique IDs for elements
   */
  protected createElementId(prefix: string, id: string): string {
    return `${this.resourceType}-${prefix}-${id}`;
  }

  /**
   * Helper method for drag behavior (simple drag without physics)
   */
  protected createDragBehavior(): any {
    return d3
      .drag()
      .on("start", () => {
        // Simple drag - just move the element
      })
      .on("drag", (event: any, d: any) => {
        const nodeData = d as NodeData;
        // Update the node's position
        nodeData.x = event.x;
        nodeData.y = event.y;

        // Update the visual position immediately
        d3.select(event.sourceEvent.target.closest("g")).attr(
          "transform",
          `translate(${event.x},${event.y})`
        );
      })
      .on("end", () => {
        // Drag complete - position is already updated
      });
  }

  /**
   * Helper method to create avatar patterns
   */
  protected createAvatarPattern(node: NodeData, circleRadius: number): string {
    if (!node.avatar) return "";

    const patternId = this.createElementId("avatar", node.id);
    const defs = this.context.svg.select("defs").empty()
      ? this.context.svg.append("defs")
      : this.context.svg.select("defs");

    // Remove existing pattern if it exists
    defs.select(`#${patternId}`).remove();

    // Calculate proper sizing for circular fill
    const diameter = circleRadius * 2;

    // Create new pattern - using userSpaceOnUse for better control
    defs
      .append("pattern")
      .attr("id", patternId)
      .attr("patternUnits", "userSpaceOnUse")
      .attr("width", diameter)
      .attr("height", diameter)
      .attr("x", -circleRadius) // Center the pattern
      .attr("y", -circleRadius)
      .append("image")
      .attr("href", node.avatar)
      .attr("width", diameter)
      .attr("height", diameter)
      .attr("x", 0)
      .attr("y", 0)
      .attr("preserveAspectRatio", "xMidYMid slice"); // Crop to fill circle

    return `url(#${patternId})`;
  }

  /**
   * Helper method to create node labels
   */
  protected createNodeLabel(parent: any, node: NodeData, dy: number = 25): any {
    const textColor = node.type === "repo" ? "#e6edf3" : "#b6b6b6";
    return parent
      .append("text")
      .attr("class", "node-label")
      .attr("dy", dy)
      .style("fill", textColor)
      .style("font-size", "12px")
      .style("font-weight", "500")
      .style("text-anchor", "middle")
      .style("pointer-events", "none")
      .text(node.name);
  }
}
