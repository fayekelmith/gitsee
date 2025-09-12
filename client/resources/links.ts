import * as d3 from 'd3';
import { BaseVisualizationResource } from './base.js';
import { LinkData, ResourceData } from '../types/index.js';

export class LinksVisualization extends BaseVisualizationResource {
  constructor(context: any) {
    super(context, 'links');
  }

  create(linksData: LinkData[]): ResourceData {
    console.log(`🏗️ Creating links visualization for ${linksData.length} links...`);

    return {
      nodes: [], // Links don't create nodes
      links: linksData
    };
  }

  update(resourceData: ResourceData): void {
    console.log('🔄 Updating links visualization...');
    
    const group = this.getResourceGroup();
    
    // Bind data
    const links = group
      .selectAll('.link')
      .data(resourceData.links, (d: LinkData) => d.id);

    // Remove old links
    links.exit().remove();

    // Add new links
    links
      .enter()
      .append('line')
      .attr('class', 'link')
      .style('stroke', (d: LinkData) => this.getLinkColor(d.type))
      .style('stroke-width', (d: LinkData) => this.getLinkWidth(d.type))
      .style('stroke-opacity', 0.8);
  }

  private getLinkColor(linkType?: string): string {
    switch (linkType) {
      case 'contribution':
        return '#30363d';
      case 'commit':
        return '#1f6feb';
      case 'branch':
        return '#238636';
      case 'dependency':
        return '#f85149';
      default:
        return '#30363d';
    }
  }

  private getLinkWidth(linkType?: string): string {
    switch (linkType) {
      case 'contribution':
        return '1.5px';
      case 'commit':
        return '2px';
      case 'branch':
        return '2.5px';
      case 'dependency':
        return '1px';
      default:
        return '1.5px';
    }
  }

  /**
   * Update link positions based on node positions
   * This should be called from the simulation tick function
   */
  updatePositions(): void {
    const group = this.getResourceGroup();
    
    group.selectAll('.link')
      .attr('x1', (d: LinkData) => (d.source as any).x || 0)
      .attr('y1', (d: LinkData) => (d.source as any).y || 0)
      .attr('x2', (d: LinkData) => (d.target as any).x || 0)
      .attr('y2', (d: LinkData) => (d.target as any).y || 0);
  }

  destroy(): void {
    console.log('🗑️ Destroying links visualization...');
    this.getResourceGroup().remove();
  }
}