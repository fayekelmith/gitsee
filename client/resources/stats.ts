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
    
    // Add background circles for stats
    statEnter.append('circle')
      .attr('r', 20)
      .attr('fill', '#2D3748')
      .attr('stroke', '#4A5568')
      .attr('stroke-width', '2');
    
    // Add stat values (the number/text)
    statEnter.append('text')
      .attr('class', 'stat-value')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', '11px')
      .attr('fill', '#E2E8F0')
      .attr('font-weight', 'bold')
      .attr('font-family', 'system-ui, -apple-system, sans-serif')
      .text((d: NodeData) => d.name);
    
    
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
    
    // Add background circles for stats
    statEnter.append('circle')
      .attr('r', 20)
      .attr('fill', '#2D3748')
      .attr('stroke', '#4A5568')
      .attr('stroke-width', '2');
    
    // Add stat values
    statEnter.append('text')
      .attr('class', 'stat-value')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', '11px')
      .attr('fill', '#E2E8F0')
      .attr('font-weight', 'bold')
      .attr('font-family', 'system-ui, -apple-system, sans-serif')
      .text((d: NodeData) => d.name);
    
    
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