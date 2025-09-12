import * as d3 from 'd3';
import { BaseVisualizationResource } from './base.js';
import { NodeData, LinkData, ResourceData } from '../types/index.js';

export class ContributorsVisualization extends BaseVisualizationResource {
  constructor(context: any) {
    super(context, 'contributors');
  }

  create(contributorsData: any[]): ResourceData {
    console.log(`🏗️ Creating contributors visualization for ${contributorsData.length} contributors...`);

    const nodes: NodeData[] = contributorsData.map(contributor => ({
      id: `contributor-${contributor.id}`,
      type: 'contributor',
      name: contributor.login,
      avatar: contributor.avatar_url,
      contributions: contributor.contributions
    }));

    const links: LinkData[] = contributorsData.map(contributor => ({
      id: `link-repo-contributor-${contributor.id}`,
      source: 'repo',
      target: `contributor-${contributor.id}`,
      type: 'contribution'
    }));

    return {
      nodes,
      links
    };
  }

  update(resourceData: ResourceData): void {
    console.log('🔄 Updating contributors visualization...');
    
    const group = this.getResourceGroup();
    
    // Bind data
    const nodes = group
      .selectAll('.contributor-node')
      .data(resourceData.nodes, (d: NodeData) => d.id);

    // Remove old nodes
    nodes.exit().remove();

    // Add new nodes
    const nodeEnter = nodes
      .enter()
      .append('g')
      .attr('class', 'contributor-node')
      .call(this.createDragBehavior());

    // Add circles with avatar patterns
    nodeEnter.each((d: NodeData, i: number, nodes: any) => {
      const node = d3.select(nodes[i]);
      
      // Create avatar pattern
      const fillPattern = this.createAvatarPattern(d, 30);
      
      // Add circle
      node
        .append('circle')
        .attr('r', 15)
        .style('fill', fillPattern || '#238636')
        .style('stroke', '#1f6feb')
        .style('stroke-width', '1.5px');

      // Add label
      this.createNodeLabel(node, d, 25);
    });

    // Update existing nodes (in case avatar changes)
    const nodeUpdate = nodes.merge(nodeEnter);
    
    nodeUpdate.select('circle')
      .style('fill', (d: NodeData) => {
        if (d.avatar) {
          return this.createAvatarPattern(d, 30);
        }
        return '#238636';
      });
  }

  destroy(): void {
    console.log('🗑️ Destroying contributors visualization...');
    this.getResourceGroup().remove();
  }
}