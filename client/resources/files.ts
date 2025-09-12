import * as d3 from 'd3';
import { BaseVisualizationResource } from './base.js';
import { NodeData, ResourceData } from '../types/index.js';

export class FilesVisualization extends BaseVisualizationResource {
  constructor(context: any) {
    super(context, 'files');
  }
  create(files: any[]): ResourceData {
    const nodes: NodeData[] = [];

    files.forEach((file, index) => {
      const node: NodeData = {
        id: `file-${file.name}`,
        type: 'file',
        name: file.name,
        // Position will be set by organic positioning system
      };
      nodes.push(node);
    });

    return { nodes, links: [] }; // Files don't create links by themselves
  }

  update(resourceData: ResourceData): void {
    const group = this.getResourceGroup();
    
    // Bind data to file nodes
    const fileNodes = group.selectAll('.file-node')
      .data(resourceData.nodes, (d: any) => d.id);
    
    // Remove old nodes
    fileNodes.exit().remove();
    
    // Add new nodes
    const fileEnter = fileNodes.enter()
      .append('g')
      .attr('class', 'file-node');
    
    // Add rectangles for file nodes (instead of circles)
    fileEnter.append('rect')
      .attr('width', 30)
      .attr('height', 20)
      .attr('rx', 3) // Rounded corners
      .attr('ry', 3)
      .attr('fill', '#4A90E2') // Same color for all files as requested
      .attr('stroke', '#2C5282')
      .attr('stroke-width', 1.5)
      .attr('x', -15) // Center the rectangle
      .attr('y', -10);
    
    // Add file icons (simple text for now)
    fileEnter.append('text')
      .attr('class', 'file-icon')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', '10px')
      .attr('fill', 'white')
      .attr('font-weight', 'bold')
      .text('📄');
    
    // Add file labels below the rectangle
    fileEnter.append('text')
      .attr('class', 'file-label')
      .attr('text-anchor', 'middle')
      .attr('y', 18) // Below the rectangle
      .attr('font-size', '10px')
      .attr('fill', '#333')
      .attr('font-family', 'monospace')
      .text((d: NodeData) => d.name);
    
    // Update positions for all nodes (new and existing)
    const allFileNodes = fileEnter.merge(fileNodes);
    allFileNodes.attr('transform', (d: NodeData) => 
      d.x !== undefined && d.y !== undefined ? `translate(${d.x}, ${d.y})` : 'translate(0,0)'
    );
  }

  updateWithAnimation(resourceData: ResourceData): void {
    const group = this.getResourceGroup();
    
    // Bind data to file nodes
    const fileNodes = group.selectAll('.file-node')
      .data(resourceData.nodes, (d: any) => d.id);
    
    // Remove old nodes with animation
    fileNodes.exit()
      .transition()
      .duration(300)
      .style('opacity', 0)
      .remove();
    
    // Add new nodes
    const fileEnter = fileNodes.enter()
      .append('g')
      .attr('class', 'file-node')
      .style('opacity', 0); // Start invisible
    
    // Add rectangles for file nodes
    fileEnter.append('rect')
      .attr('width', 30)
      .attr('height', 20)
      .attr('rx', 3)
      .attr('ry', 3)
      .attr('fill', '#4A90E2') // Same color for all files
      .attr('stroke', '#2C5282')
      .attr('stroke-width', 1.5)
      .attr('x', -15)
      .attr('y', -10);
    
    // Add file icons
    fileEnter.append('text')
      .attr('class', 'file-icon')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', '10px')
      .attr('fill', 'white')
      .attr('font-weight', 'bold')
      .text('📄');
    
    // Add file labels
    fileEnter.append('text')
      .attr('class', 'file-label')
      .attr('text-anchor', 'middle')
      .attr('y', 18)
      .attr('font-size', '10px')
      .attr('fill', '#333')
      .attr('font-family', 'monospace')
      .text((d: NodeData) => d.name);
    
    // Set initial positions and animate in
    const allFileNodes = fileEnter.merge(fileNodes);
    allFileNodes
      .attr('transform', (d: NodeData) => 
        d.x !== undefined && d.y !== undefined ? `translate(${d.x}, ${d.y})` : 'translate(0,0)'
      )
      .transition()
      .duration(600)
      .ease(d3.easeBackOut)
      .style('opacity', 1);
  }

  destroy(): void {
    const group = this.context.container.select(`.${this.getResourceType()}-group`);
    group.remove();
  }

  protected getResourceType(): string {
    return 'files';
  }
}