import * as d3 from 'd3';
import { BaseVisualizationResource } from './base.js';
import { NodeData, LinkData, ResourceData } from '../types/index.js';

export class ContributorsVisualization extends BaseVisualizationResource {
  constructor(context: any) {
    super(context, 'contributors');
  }

  create(contributorsData: any[]): ResourceData {
    console.log(`🏗️ Creating contributors visualization for ${contributorsData.length} contributors...`);

    // Get center position from context
    const centerX = this.context.width / 2;
    const centerY = this.context.height / 2;

    const nodes: NodeData[] = contributorsData.map((contributor, index) => {
      // Position contributors in a circle around the center
      const angle = (index / contributorsData.length) * 2 * Math.PI;
      const radius = 120 + Math.random() * 80; // Some variation in distance
      
      return {
        id: `contributor-${contributor.id}`,
        type: 'contributor',
        name: contributor.login,
        avatar: contributor.avatar_url,
        contributions: contributor.contributions,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius
      };
    });

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
      .attr('transform', (d: NodeData) => {
        const x = d.x || 0;
        const y = d.y || 0;
        return `translate(${x},${y})`;
      })
      .call(this.createDragBehavior());

    // Add circles with avatar patterns
    nodeEnter.each((d: NodeData, i: number, nodes: any) => {
      const node = d3.select(nodes[i]);
      
      // Calculate size based on contributions (more subtle sizing)
      const baseRadius = 16;
      const maxRadius = 22;
      const contributions = d.contributions || 0;
      const radius = Math.min(baseRadius + contributions * 0.1, maxRadius);
      
      // Create avatar pattern (pass radius, not diameter)
      const fillPattern = this.createAvatarPattern(d, radius);
      
      // Add circle
      node
        .append('circle')
        .attr('r', radius)
        .style('fill', fillPattern || '#238636')
        .style('stroke', '#1f6feb')
        .style('stroke-width', '2px');

      // Add label
      this.createNodeLabel(node, d, radius + 15);
    });

    // Only create visual elements for NEW nodes - don't touch existing ones
    // Existing nodes already have their circles and patterns - leave them alone!
  }

  updateWithAnimation(resourceData: ResourceData): void {
    console.log(`🎭 Updating contributors visualization with animation for ${resourceData.nodes.length} nodes...`);
    
    const group = this.getResourceGroup();
    
    // Bind data
    const nodes = group
      .selectAll('.contributor-node')
      .data(resourceData.nodes, (d: NodeData) => d.id);

    // Remove old nodes
    nodes.exit().remove();

    // Add new nodes with entrance animation (only NEW nodes will enter)
    const nodeEnter = nodes
      .enter()
      .append('g')
      .attr('class', 'contributor-node')
      .attr('transform', (d: NodeData) => {
        // Position at the node's actual coordinates, not (0,0)
        const x = d.x || 0;
        const y = d.y || 0;
        console.log(`🎯 NEW node ${d.id} positioned at (${x}, ${y})`);
        return `translate(${x},${y}) scale(0)`;
      })
      .style('opacity', 0)
      .call(this.createDragBehavior());

    // Don't reposition existing nodes - they're already stable!

    // Add circles with avatar patterns to NEW nodes only
    nodeEnter.each((d: NodeData, i: number, nodes: any) => {
      const node = d3.select(nodes[i]);
      console.log(`🆕 Creating visual elements for new node: ${d.id} (${d.contributions} contributions)`);
      
      // Calculate size based on contributions (more subtle sizing)
      const baseRadius = 16;
      const maxRadius = 22;
      const contributions = d.contributions || 0;
      const radius = Math.min(baseRadius + contributions * 0.1, maxRadius);
      
      // Create avatar pattern (pass radius, not diameter)
      const fillPattern = this.createAvatarPattern(d, radius);
      
      // Add circle
      node
        .append('circle')
        .attr('r', radius)
        .style('fill', fillPattern || '#238636')
        .style('stroke', '#1f6feb')
        .style('stroke-width', '2px');

      // Add label positioned based on circle size
      this.createNodeLabel(node, d, radius + 15);
    });

    // Animate entrance - scale from 0 to 1 while keeping position (only NEW nodes)
    nodeEnter
      .transition()
      .duration(400)
      .style('opacity', 1)
      .attr('transform', (d: NodeData) => {
        const x = d.x || 0;
        const y = d.y || 0;
        return `translate(${x},${y}) scale(1)`;
      });

    // Don't touch existing nodes - they're already perfect!
    // Only the NEW nodes (nodeEnter) get their visual elements created above
    
    console.log(`✅ Contributors update complete. Total visible: ${nodes.size() + nodeEnter.size()}`);
  }

  destroy(): void {
    console.log('🗑️ Destroying contributors visualization...');
    this.getResourceGroup().remove();
  }
}