import * as d3 from 'd3';
import { BaseVisualizationResource } from './base.js';
import { NodeData, ResourceData } from '../types/index.js';

export class StatsVisualization extends BaseVisualizationResource {
  constructor(context: any) {
    super(context, 'stats');
  }

  create(statsData: any): ResourceData {
    const nodes: NodeData[] = [];

    if (!statsData) return { nodes, links: [] };

    // Create 4 stat nodes: stars, PRs, commits, age
    const stats = [
      { id: 'stat-stars', name: `${statsData.stars} ⭐`, label: 'Stars', value: statsData.stars },
      { id: 'stat-prs', name: `${statsData.totalPRs} PRs`, label: 'Pull Requests', value: statsData.totalPRs },
      { id: 'stat-commits', name: `${statsData.totalCommits} commits`, label: 'Total Commits', value: statsData.totalCommits },
      { id: 'stat-age', name: `${statsData.ageInYears}y old`, label: 'Repository Age', value: statsData.ageInYears }
    ];

    stats.forEach((stat, index) => {
      const node: NodeData = {
        id: stat.id,
        type: 'stat',
        name: stat.name,
        label: stat.label,
        value: stat.value,
        // Position will be set by organic positioning system
      };
      nodes.push(node);
    });

    return { nodes, links: [] }; // Stats don't create links by themselves
  }

  update(resourceData: ResourceData): void {
    const group = this.getResourceGroup();
    
    // Bind data to stat nodes
    const statNodes = group.selectAll('.stat-node')
      .data(resourceData.nodes, (d: any) => d.id);
    
    // Remove old nodes
    statNodes.exit().remove();
    
    // Add new nodes
    const statEnter = statNodes.enter()
      .append('g')
      .attr('class', 'stat-node');
    
    // Add stat values (the number/text) first so we can measure them
    const textElements = statEnter.append('text')
      .attr('class', 'stat-value')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', '11px')
      .attr('fill', '#E2E8F0')
      .attr('font-weight', 'bold')
      .attr('font-family', 'system-ui, -apple-system, sans-serif')
      .text((d: NodeData) => d.name);
    
    // Add background rectangles sized to fit the text with padding
    statEnter.each(function() {
      const group = d3.select(this);
      const textElement = group.select('text').node() as SVGTextElement;
      
      if (textElement) {
        const bbox = textElement.getBBox();
        const padding = 8; // 8px padding on each side
        const width = bbox.width + (padding * 2);
        const height = bbox.height + (padding * 2);
        
        // Insert rectangle before text so it appears behind
        group.insert('rect', 'text')
          .attr('width', width)
          .attr('height', height)
          .attr('x', -width / 2)
          .attr('y', -height / 2)
          .attr('rx', 4)
          .attr('ry', 4)
          .attr('fill', '#2D3748')
          .attr('stroke', '#4A5568')
          .attr('stroke-width', '2');
      }
    });
    
    
    // Update positions for all nodes (new and existing)
    const allStatNodes = statEnter.merge(statNodes);
    allStatNodes.attr('transform', (d: NodeData) => 
      d.x !== undefined && d.y !== undefined ? `translate(${d.x}, ${d.y})` : 'translate(0,0)'
    );
  }

  updateWithAnimation(resourceData: ResourceData): void {
    const group = this.getResourceGroup();
    
    // Bind data to stat nodes
    const statNodes = group.selectAll('.stat-node')
      .data(resourceData.nodes, (d: any) => d.id);
    
    // Remove old nodes with animation
    statNodes.exit()
      .transition()
      .duration(300)
      .style('opacity', 0)
      .remove();
    
    // Add new nodes
    const statEnter = statNodes.enter()
      .append('g')
      .attr('class', 'stat-node')
      .style('opacity', 0); // Start invisible
    
    // Add stat values (the number/text) first so we can measure them
    const textElements = statEnter.append('text')
      .attr('class', 'stat-value')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', '11px')
      .attr('fill', '#E2E8F0')
      .attr('font-weight', 'bold')
      .attr('font-family', 'system-ui, -apple-system, sans-serif')
      .text((d: NodeData) => d.name);
    
    // Add background rectangles sized to fit the text with padding
    statEnter.each(function() {
      const group = d3.select(this);
      const textElement = group.select('text').node() as SVGTextElement;
      
      if (textElement) {
        const bbox = textElement.getBBox();
        const padding = 8; // 8px padding on each side
        const width = bbox.width + (padding * 2);
        const height = bbox.height + (padding * 2);
        
        // Insert rectangle before text so it appears behind
        group.insert('rect', 'text')
          .attr('width', width)
          .attr('height', height)
          .attr('x', -width / 2)
          .attr('y', -height / 2)
          .attr('rx', 4)
          .attr('ry', 4)
          .attr('fill', '#2D3748')
          .attr('stroke', '#4A5568')
          .attr('stroke-width', '2');
      }
    });
    
    
    // Set initial positions and animate in
    const allStatNodes = statEnter.merge(statNodes);
    allStatNodes
      .attr('transform', (d: NodeData) => 
        d.x !== undefined && d.y !== undefined ? `translate(${d.x}, ${d.y})` : 'translate(0,0)'
      )
      .transition()
      .duration(500)
      .ease(d3.easeBackOut)
      .style('opacity', 1);
  }

  destroy(): void {
    const group = this.context.container.select(`.${this.getResourceType()}-group`);
    group.remove();
  }

  protected getResourceType(): string {
    return 'stats';
  }
}