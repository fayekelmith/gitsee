import * as d3 from 'd3';
import { NodeData, LinkData, VisualizationContext, ResourceData } from '../types/index.js';

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
   * Creates it if it doesn't exist
   */
  protected getResourceGroup(): any {
    let group = this.context.container.select(`.${this.resourceType}-group`);
    if (group.empty()) {
      group = this.context.container
        .append('g')
        .attr('class', `${this.resourceType}-group`);
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
   * Helper method for drag behavior
   */
  protected createDragBehavior(): any {
    const simulation = this.context.simulation;
    
    return d3.drag()
      .on('start', (event: any, d: any) => {
        const nodeData = d as NodeData;
        if (!event.active) simulation.alphaTarget(0.3).restart();
        nodeData.fx = nodeData.x;
        nodeData.fy = nodeData.y;
      })
      .on('drag', (event: any, d: any) => {
        const nodeData = d as NodeData;
        nodeData.fx = event.x;
        nodeData.fy = event.y;
      })
      .on('end', (event: any, d: any) => {
        const nodeData = d as NodeData;
        if (!event.active) simulation.alphaTarget(0);
        // Only free non-fixed nodes
        if (nodeData.type !== 'repo') {
          nodeData.fx = null;
          nodeData.fy = null;
        }
      });
  }

  /**
   * Helper method to create avatar patterns
   */
  protected createAvatarPattern(node: NodeData, circleRadius: number): string {
    if (!node.avatar) return '';

    const patternId = this.createElementId('avatar', node.id);
    const defs = this.context.svg.select('defs').empty() 
      ? this.context.svg.append('defs')
      : this.context.svg.select('defs');

    // Remove existing pattern if it exists
    defs.select(`#${patternId}`).remove();

    // Calculate proper sizing for circular fill
    const diameter = circleRadius * 2;
    
    // Create new pattern - using userSpaceOnUse for better control
    defs.append('pattern')
      .attr('id', patternId)
      .attr('patternUnits', 'userSpaceOnUse')
      .attr('width', diameter)
      .attr('height', diameter)
      .attr('x', -circleRadius) // Center the pattern
      .attr('y', -circleRadius)
      .append('image')
      .attr('href', node.avatar)
      .attr('width', diameter)
      .attr('height', diameter)
      .attr('x', 0)
      .attr('y', 0)
      .attr('preserveAspectRatio', 'xMidYMid slice'); // Crop to fill circle

    return `url(#${patternId})`;
  }

  /**
   * Helper method to create node labels
   */
  protected createNodeLabel(
    parent: any, 
    node: NodeData, 
    dy: number = 25
  ): any {
    return parent
      .append('text')
      .attr('class', 'node-label')
      .attr('dy', dy)
      .style('fill', '#e6edf3')
      .style('font-size', '12px')
      .style('font-weight', '500')
      .style('text-anchor', 'middle')
      .style('pointer-events', 'none')
      .text(node.name);
  }
}