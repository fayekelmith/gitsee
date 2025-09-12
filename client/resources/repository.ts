import * as d3 from 'd3';
import { BaseVisualizationResource } from './base.js';
import { NodeData, ResourceData } from '../types/index.js';

export class RepositoryVisualization extends BaseVisualizationResource {
  constructor(context: any) {
    super(context, 'repository');
  }

  create(repoData: any): ResourceData {
    console.log('🏗️ Creating repository visualization...');

    const repoNode: NodeData = {
      id: 'repo',
      type: 'repo',
      name: repoData.name,
      x: this.context.width / 2,
      y: this.context.height / 2,
      fx: this.context.width / 2, // Fixed position
      fy: this.context.height / 2,
      avatar: repoData.icon
    };

    return {
      nodes: [repoNode],
      links: []
    };
  }

  update(resourceData: ResourceData): void {
    console.log('🔄 Updating repository visualization...');
    
    const group = this.getResourceGroup();
    
    // Bind data
    const nodes = group
      .selectAll('.repo-node')
      .data(resourceData.nodes, (d: NodeData) => d.id);

    // Remove old nodes
    nodes.exit().remove();

    // Add new nodes
    const nodeEnter = nodes
      .enter()
      .append('g')
      .attr('class', 'repo-node')
      .call(this.createDragBehavior());

    // Update existing + new nodes
    const nodeUpdate = nodes.merge(nodeEnter);

    // Clear and rebuild (to handle icon changes)
    nodeUpdate.selectAll('*').remove();

    // Add circles with avatars or default styling
    nodeUpdate.each((d: NodeData, i: number, nodes: any) => {
      const node = d3.select(nodes[i]);
      
      if (d.avatar) {
        // Create avatar pattern and use it as fill (pass radius, not diameter)
        const repoRadius = 25;
        const fillPattern = this.createAvatarPattern(d, repoRadius);
        const circle = node
          .append('circle')
          .attr('r', repoRadius)
          .style('fill', fillPattern)
          .style('stroke', '#0969da')
          .style('stroke-width', '2px');
          
        // Add subtle pulse animation for icon loading
        circle
          .style('opacity', 0.7)
          .transition()
          .duration(300)
          .style('opacity', 1);
      } else {
        // Default repo styling with fallback icon
        node
          .append('circle')
          .attr('r', 25)
          .style('fill', '#1f6feb')
          .style('stroke', '#0969da')
          .style('stroke-width', '2px');

        // Add fallback GitHub folder icon
        node
          .append('path')
          .attr('d', 'M-8,-8 L8,-8 L8,8 L-8,8 Z M-6,-6 L6,-6 M-6,-3 L6,-3 M-6,0 L6,0 M-6,3 L6,3 M-6,6 L6,6')
          .style('fill', 'none')
          .style('stroke', 'white')
          .style('stroke-width', '1.5px');
      }

      // Add label
      this.createNodeLabel(node, d, 35);
    });
  }

  destroy(): void {
    console.log('🗑️ Destroying repository visualization...');
    this.getResourceGroup().remove();
  }
}