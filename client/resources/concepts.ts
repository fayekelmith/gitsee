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

  private getConceptColors(kind: string): { fill: string; stroke: string; hoverFill: string; hoverStroke: string } {
    const colors = {
      infrastructure: {
        fill: "#402D38", // More noticeable red tint
        stroke: "#604548", // Red-tinted border
        hoverFill: "#503540",
        hoverStroke: "#804A4A",
      },
      dependencies: {
        fill: "#2D3850", // More noticeable blue tint
        stroke: "#404A65", // Blue-tinted border
        hoverFill: "#354060",
        hoverStroke: "#506A85",
      },
      user_stories: {
        fill: "#354030", // More noticeable green tint
        stroke: "#505A48", // Green-tinted border
        hoverFill: "#404A40",
        hoverStroke: "#607A50",
      },
      pages: {
        fill: "#453530", // More noticeable orange tint
        stroke: "#654D40", // Orange-tinted border
        hoverFill: "#554040",
        hoverStroke: "#856A50",
      },
    };

    return colors[kind as keyof typeof colors] || colors.infrastructure;
  }

  public setRepoData(repoData: any): void {
    this.repoData = repoData;
  }

  public getPanelContent(nodeData: NodeData): any {
    // Map kind to display names and colors
    const kindConfig = {
      infrastructure: { label: "Infrastructure", color: "#804A4A" },
      dependencies: { label: "Dependency", color: "#506A85" },
      user_stories: { label: "User Story", color: "#607A50" },
      pages: { label: "Page", color: "#856A50" },
    };

    const config = kindConfig[nodeData.kind as keyof typeof kindConfig] || kindConfig.infrastructure;

    return {
      name: nodeData.content || nodeData.name,
      sections: [
        {
          title: "Type",
          type: "text" as const,
          data: `<div style="display: inline-block; background: ${config.color}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">${config.label}</div>`
        }
      ]
    };
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
    conceptEnter.each((d: NodeData, i: number, nodes: any[]) => {
      const group = d3.select(nodes[i] as SVGGElement);
      const textElement = group.select("text").node() as SVGTextElement;

      if (textElement) {
        const bbox = textElement.getBBox();
        const padding = 8; // 8px padding on each side
        const width = bbox.width + padding * 2;
        const height = bbox.height + padding * 2;

        // Get colors based on concept kind
        const colors = this.getConceptColors(d.kind || 'infrastructure');

        // Insert rectangle before text so it appears behind
        group
          .insert("rect", "text")
          .attr("width", width)
          .attr("height", height)
          .attr("x", -width / 2)
          .attr("y", -height / 2)
          .attr("rx", 4)
          .attr("ry", 4)
          .attr("fill", colors.fill)
          .attr("stroke", colors.stroke)
          .attr("stroke-width", "2");
      }
    });

    // Add hover effects to new concept nodes
    this.addHoverEffects(conceptEnter);

    // Add click handlers to new concept nodes - clicking concepts shows concept panel
    if (this.onNodeClick) {
      conceptEnter.on("click", (event: any, d: NodeData) => {
        event.stopPropagation();
        // Pass the actual concept node data to show concept panel
        this.onNodeClick!(d);
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
    conceptEnter.each((d: NodeData, i: number, nodes: any[]) => {
      const group = d3.select(nodes[i] as SVGGElement);
      const textElement = group.select("text").node() as SVGTextElement;

      if (textElement) {
        const bbox = textElement.getBBox();
        const padding = 8; // 8px padding on each side
        const width = bbox.width + padding * 2;
        const height = bbox.height + padding * 2;

        // Get colors based on concept kind
        const colors = this.getConceptColors(d.kind || 'infrastructure');

        // Insert rectangle before text so it appears behind
        group
          .insert("rect", "text")
          .attr("width", width)
          .attr("height", height)
          .attr("x", -width / 2)
          .attr("y", -height / 2)
          .attr("rx", 4)
          .attr("ry", 4)
          .attr("fill", colors.fill)
          .attr("stroke", colors.stroke)
          .attr("stroke-width", "2");
      }
    });

    // Add hover effects to new concept nodes
    this.addHoverEffects(conceptEnter);

    // Add click handlers to new concept nodes - clicking concepts shows concept panel
    if (this.onNodeClick) {
      conceptEnter.on("click", (event: any, d: NodeData) => {
        event.stopPropagation();
        // Pass the actual concept node data to show concept panel
        this.onNodeClick!(d);
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
      .on("mouseenter", (event: any, d: NodeData) => {
        const group = d3.select(event.currentTarget);
        const colors = this.getConceptColors(d.kind || 'infrastructure');

        // Scale up slightly and brighten colors
        const scale = 1.05;
        const x = d.x !== undefined ? d.x : 0;
        const y = d.y !== undefined ? d.y : 0;
        group
          .transition()
          .duration(200)
          .attr("transform", `translate(${x}, ${y}) scale(${scale})`);

        // Brighten rectangle with concept-specific hover colors
        group
          .select("rect")
          .transition()
          .duration(200)
          .attr("fill", colors.hoverFill)
          .attr("stroke", colors.hoverStroke)
          .attr("stroke-width", "3");

        // Brighten text
        group.select("text").transition().duration(200).attr("fill", "#FFFFFF");
      })
      .on("mouseleave", (event: any, d: NodeData) => {
        const group = d3.select(event.currentTarget);
        const colors = this.getConceptColors(d.kind || 'infrastructure');

        // Scale back to normal
        const x = d.x !== undefined ? d.x : 0;
        const y = d.y !== undefined ? d.y : 0;
        group
          .transition()
          .duration(200)
          .attr("transform", `translate(${x}, ${y}) scale(1)`);

        // Return rectangle to original concept-specific colors
        group
          .select("rect")
          .transition()
          .duration(200)
          .attr("fill", colors.fill)
          .attr("stroke", colors.stroke)
          .attr("stroke-width", "2");

        // Return text to original color
        group.select("text").transition().duration(200).attr("fill", "#E2E8F0");
      });
  }
}