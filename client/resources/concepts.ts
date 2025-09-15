import * as d3 from "d3";
import { BaseVisualizationResource } from "./base.js";
import { NodeData, ResourceData } from "../types/index.js";

export class ConceptVisualization extends BaseVisualizationResource {
  private onNodeClick?: (nodeData: NodeData) => void;
  private repoData: any = null;

  constructor(context: any, onNodeClick?: (nodeData: NodeData) => void) {
    super(context, "concepts");
    this.onNodeClick = onNodeClick;
  }

  public setRepoData(repoData: any): void {
    this.repoData = repoData;
  }

  create(explorationResult: any): ResourceData {
    const nodes: NodeData[] = [];

    if (!explorationResult) return { nodes, links: [] };

    // Create individual concept nodes for each item in the arrays
    const conceptTypes = [
      { kind: "infrastructure", items: explorationResult.infrastructure },
      { kind: "dependencies", items: explorationResult.dependencies },
      { kind: "user_stories", items: explorationResult.user_stories },
      { kind: "pages", items: explorationResult.pages },
    ];

    conceptTypes.forEach((conceptType) => {
      if (conceptType.items && Array.isArray(conceptType.items)) {
        conceptType.items.forEach((item, index) => {
          const node: NodeData = {
            id: `concept-${conceptType.kind}-${index}`,
            type: "concept",
            name: item,
            label: item,
            kind: conceptType.kind,
            content: item,
            // Position will be set by organic positioning system
          };
          nodes.push(node);
        });
      } else if (conceptType.items) {
        // Handle case where it's not an array (fallback)
        const node: NodeData = {
          id: `concept-${conceptType.kind}-0`,
          type: "concept",
          name: conceptType.items.toString(),
          label: conceptType.items.toString(),
          kind: conceptType.kind,
          content: conceptType.items.toString(),
          // Position will be set by organic positioning system
        };
        nodes.push(node);
      }
    });

    return { nodes, links: [] }; // Concepts don't create links by themselves
  }

  update(resourceData: ResourceData): void {
    const group = this.getResourceGroup();

    // Bind data to concept nodes
    const conceptNodes = group
      .selectAll(".concept-node")
      .data(resourceData.nodes, (d: any) => d.id);

    // Remove old nodes
    conceptNodes.exit().remove();

    // Add new nodes
    const conceptEnter = conceptNodes
      .enter()
      .append("g")
      .attr("class", "gitsee-node concept-node");

    // Add concept names (the label text) first so we can measure them
    const textElements = conceptEnter
      .append("text")
      .attr("class", "concept-value")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", "11px")
      .attr("fill", "#E2E8F0")
      .attr("font-weight", "bold")
      .attr("font-family", "system-ui, -apple-system, sans-serif")
      .text((d: NodeData) => d.name);

    // Add background rectangles sized to fit the text with padding
    conceptEnter.each(function (this: SVGGElement) {
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

    // Add hover effects to new concept nodes
    this.addHoverEffects(conceptEnter);

    // Add click handlers to new concept nodes - clicking concepts shows repo panel
    if (this.onNodeClick) {
      conceptEnter.on("click", (event: any, d: NodeData) => {
        event.stopPropagation();
        // Create a fake repo node to trigger repo panel display
        const repoNode: NodeData = {
          id: "repo",
          type: "repo",
          name: this.repoData?.name || "Repository",
          x: 0,
          y: 0,
        };
        this.onNodeClick!(repoNode);
      });
    }

    // Update positions for all nodes (new and existing)
    const allConceptNodes = conceptEnter.merge(conceptNodes);
    allConceptNodes.attr("transform", (d: NodeData) =>
      d.x !== undefined && d.y !== undefined
        ? `translate(${d.x}, ${d.y})`
        : "translate(0,0)",
    );
  }

  updateWithAnimation(resourceData: ResourceData): void {
    const group = this.getResourceGroup();

    // Bind data to concept nodes
    const conceptNodes = group
      .selectAll(".concept-node")
      .data(resourceData.nodes, (d: any) => d.id);

    // Remove old nodes with animation
    conceptNodes.exit().transition().duration(300).style("opacity", 0).remove();

    // Add new nodes
    const conceptEnter = conceptNodes
      .enter()
      .append("g")
      .attr("class", "gitsee-node concept-node")
      .style("opacity", 0); // Start invisible

    // Add concept names (the label text) first so we can measure them
    const textElements = conceptEnter
      .append("text")
      .attr("class", "concept-value")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", "11px")
      .attr("fill", "#E2E8F0")
      .attr("font-weight", "bold")
      .attr("font-family", "system-ui, -apple-system, sans-serif")
      .text((d: NodeData) => d.name);

    // Add background rectangles sized to fit the text with padding
    conceptEnter.each(function (this: SVGGElement) {
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

    // Add hover effects to new concept nodes
    this.addHoverEffects(conceptEnter);

    // Add click handlers to new concept nodes - clicking concepts shows repo panel
    if (this.onNodeClick) {
      conceptEnter.on("click", (event: any, d: NodeData) => {
        event.stopPropagation();
        // Create a fake repo node to trigger repo panel display
        const repoNode: NodeData = {
          id: "repo",
          type: "repo",
          name: this.repoData?.name || "Repository",
          x: 0,
          y: 0,
        };
        this.onNodeClick!(repoNode);
      });
    }

    // Set initial positions and animate in
    const allConceptNodes = conceptEnter.merge(conceptNodes);
    allConceptNodes
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
    return "concepts";
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