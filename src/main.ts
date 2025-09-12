import * as d3 from 'd3';
import { GitHubAPI } from './github-api.js';

interface Contributor {
    id: number;
    login: string;
    avatar_url: string;
    contributions: number;
}

interface NodeData {
    id: string;
    type: 'repo' | 'contributor';
    name: string;
    x?: number;
    y?: number;
    fx?: number | null;
    fy?: number | null;
    avatar?: string;
    contributions?: number;
}

interface LinkData {
    source: string | NodeData;
    target: string | NodeData;
}

type D3Selection = d3.Selection<SVGGElement, unknown, HTMLElement, any>;
type D3Simulation = d3.Simulation<NodeData, LinkData>;

class GitVisualizer {
    private width: number;
    private height: number;
    private svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>;
    private githubAPI: GitHubAPI;
    private simulation: D3Simulation | null;
    private nodes: NodeData[];
    private links: LinkData[];
    private container: D3Selection;
    private linkGroup: D3Selection;
    private nodeGroup: D3Selection;
    
    constructor() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.svg = d3.select('#visualization') as d3.Selection<SVGSVGElement, unknown, HTMLElement, any>;
        this.svg.attr('width', this.width).attr('height', this.height);
        
        this.githubAPI = new GitHubAPI();
        this.simulation = null;
        this.nodes = [];
        this.links = [];
        
        this.initializeVisualization();
    }
    
    private initializeVisualization(): void {
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 4])
            .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
                this.container.attr('transform', event.transform.toString());
            });
        
        this.svg.call(zoom);
        
        this.container = this.svg.append('g');
        this.linkGroup = this.container.append('g').attr('class', 'links');
        this.nodeGroup = this.container.append('g').attr('class', 'nodes');
        
        this.simulation = d3.forceSimulation<NodeData, LinkData>()
            .force('link', d3.forceLink<NodeData, LinkData>().id((d: NodeData) => d.id).distance(100))
            .force('charge', d3.forceManyBody<NodeData>().strength(-300))
            .force('center', d3.forceCenter(this.width / 2, this.height / 2))
            .force('collision', d3.forceCollide<NodeData>().radius(35));
        
        // Will be set when we initialize with actual repo
    }
    
    addRepoNode(repoName: string): void {
        const repoNode: NodeData = {
            id: 'repo',
            type: 'repo',
            name: repoName,
            x: this.width / 2,
            y: this.height / 2,
            fx: this.width / 2,
            fy: this.height / 2
        };
        
        this.nodes.push(repoNode);
        this.updateVisualization();
    }
    
    async addContributors(owner: string, repo: string): Promise<void> {
        try {
            const contributors = await this.githubAPI.getContributors(owner, repo);
            
            // Try to fetch repo icon/favicon
            const repoIcon = await this.fetchRepoIcon(owner, repo);
            
            // Update repo node with icon if found
            const repoNode = this.nodes.find(n => n.type === 'repo');
            if (repoNode && repoIcon) {
                repoNode.avatar = repoIcon;
                console.log('🎨 Updated repo node with icon, re-rendering...');
                // Re-render the visualization to show the icon
                this.updateVisualization();
            }
            
            contributors.forEach((contributor: Contributor) => {
                const contributorNode: NodeData = {
                    id: `contributor-${contributor.id}`,
                    type: 'contributor',
                    name: contributor.login,
                    avatar: contributor.avatar_url,
                    contributions: contributor.contributions
                };
                
                const link: LinkData = {
                    source: 'repo',
                    target: contributorNode.id
                };
                
                this.nodes.push(contributorNode);
                this.links.push(link);
            });
            
            this.updateVisualization();
        } catch (error) {
            console.error('Error fetching contributors:', error);
        }
    }
    
    private async fetchRepoIcon(owner: string, repo: string): Promise<string | null> {
        console.log(`🔍 Fetching repo icon for ${owner}/${repo}`);
        
        try {
            // First get root directory contents
            console.log('📁 Fetching root directory contents...');
            const rootContents = await this.githubAPI.getRepoContents(owner, repo);
            console.log('📁 Root contents:', rootContents.map(f => f.name));
            
            // Look for icon files in root directory
            const iconFiles = rootContents.filter(file => {
                const name = file.name.toLowerCase();
                const isIcon = name.includes('favicon') || 
                              name.includes('logo') || 
                              name.includes('icon') ||
                              (name.startsWith('apple-touch') && name.includes('icon'));
                if (isIcon) {
                    console.log(`🎯 Found potential icon in root: ${file.name}`);
                }
                return isIcon;
            });
            
            console.log(`📊 Found ${iconFiles.length} icon files in root`);
            
            // Try to get common subdirectories that might have icons
            const subdirs = ['public', 'assets', 'static', 'images', 'img'];
            for (const subdir of subdirs) {
                const subdirExists = rootContents.find(item => item.name === subdir && item.type === 'dir');
                if (subdirExists) {
                    console.log(`📂 Checking ${subdir}/ directory...`);
                    const subdirContents = await this.githubAPI.getRepoContents(owner, repo, subdir);
                    console.log(`📂 ${subdir}/ contents:`, subdirContents.map(f => f.name));
                    
                    const subdirIcons = subdirContents.filter(file => {
                        const name = file.name.toLowerCase();
                        const isIcon = name.includes('favicon') || 
                                      name.includes('logo') || 
                                      name.includes('icon');
                        if (isIcon) {
                            console.log(`🎯 Found potential icon in ${subdir}/: ${file.name}`);
                        }
                        return isIcon;
                    });
                    iconFiles.push(...subdirIcons.map(f => ({ ...f, path: `${subdir}/${f.name}` })));
                }
            }
            
            console.log(`📊 Total icon files found: ${iconFiles.length}`);
            
            // Priority order: higher resolution first, then type preference
            const sortedIcons = iconFiles.sort((a, b) => {
                const aName = a.name.toLowerCase();
                const bName = b.name.toLowerCase();
                
                // Extract resolution numbers (e.g. 192x192, 512x512, 32x32)
                const getResolution = (name: string) => {
                    const match = name.match(/(\d+)x\d+/);
                    if (match) return parseInt(match[1]);
                    
                    // Check for common high-res indicators
                    if (name.includes('512')) return 512;
                    if (name.includes('256')) return 256;
                    if (name.includes('192')) return 192;
                    if (name.includes('180')) return 180;
                    if (name.includes('152')) return 152;
                    if (name.includes('144')) return 144;
                    if (name.includes('128')) return 128;
                    if (name.includes('120')) return 120;
                    if (name.includes('114')) return 114;
                    if (name.includes('96')) return 96;
                    if (name.includes('72')) return 72;
                    if (name.includes('64')) return 64;
                    if (name.includes('57')) return 57;
                    if (name.includes('48')) return 48;
                    if (name.includes('32')) return 32;
                    if (name.includes('16')) return 16;
                    
                    // Default priorities for common names
                    if (name.includes('apple-touch')) return 180; // Usually 180x180
                    if (name.includes('android-chrome')) return 192; // Usually 192x192 or higher
                    if (name === 'favicon.ico') return 64; // Usually 32x32 or 64x64
                    if (name.includes('logo')) return 100; // Assume decent size
                    
                    return 50; // Default medium priority
                };
                
                const aRes = getResolution(aName);
                const bRes = getResolution(bName);
                
                // Higher resolution wins
                if (aRes !== bRes) return bRes - aRes;
                
                // If same resolution, prefer by type: logo > apple-touch > android-chrome > favicon
                const getTypeScore = (name: string) => {
                    if (name.includes('logo')) return 4;
                    if (name.includes('apple-touch')) return 3;
                    if (name.includes('android-chrome')) return 2;
                    if (name.includes('favicon')) return 1;
                    return 0;
                };
                
                const aType = getTypeScore(aName);
                const bType = getTypeScore(bName);
                
                return bType - aType;
            });
            
            console.log('🏆 Sorted icon priority:', sortedIcons.map(f => f.path || f.name));
            
            // Try to fetch the best icon
            for (const iconFile of sortedIcons) {
                const filePath = iconFile.path || iconFile.name;
                console.log(`📥 Attempting to fetch: ${filePath}`);
                const iconData = await this.githubAPI.getFileContent(owner, repo, filePath);
                if (iconData) {
                    console.log(`✅ Successfully loaded icon: ${filePath}`);
                    console.log(`📊 Icon data length: ${iconData.length} chars`);
                    return iconData;
                } else {
                    console.log(`❌ Failed to load: ${filePath}`);
                }
            }
            
            console.log('❌ No icons could be loaded');
            
        } catch (error) {
            console.error('💥 Error fetching repo icon:', error);
        }
        
        return null; // No icon found, will use fallback
    }
    
    private updateVisualization(): void {
        console.log('🔄 Updating visualization...', this.nodes.map(n => ({ id: n.id, type: n.type, hasAvatar: !!n.avatar })));
        
        const links = this.linkGroup
            .selectAll<SVGLineElement, LinkData>('.link')
            .data(this.links, (d: LinkData) => {
                const sourceId = typeof d.source === 'string' ? d.source : d.source.id;
                const targetId = typeof d.target === 'string' ? d.target : d.target.id;
                return `${sourceId}-${targetId}`;
            });
        
        links.enter()
            .append('line')
            .attr('class', 'link');
        
        links.exit().remove();
        
        const nodes = this.nodeGroup
            .selectAll<SVGGElement, NodeData>('.node')
            .data(this.nodes, (d: NodeData) => d.id);
        
        const nodeEnter = nodes.enter()
            .append('g')
            .attr('class', 'node')
            .call(d3.drag<SVGGElement, NodeData>()
                .on('start', this.dragstarted.bind(this))
                .on('drag', this.dragged.bind(this))
                .on('end', this.dragended.bind(this)));
        
        const nodeUpdate = nodes.merge(nodeEnter);
        
        // Clear existing repo node content and rebuild
        nodeUpdate.filter((d: NodeData) => d.type === 'repo').selectAll('*').remove();
        
        // Add circles for repo nodes
        const repoNodes = nodeUpdate.filter((d: NodeData) => d.type === 'repo');
        
        console.log('🎯 Processing repo nodes:', repoNodes.data().map(d => ({ id: d.id, hasAvatar: !!d.avatar })));
        
        // Add avatar pattern for repo nodes with icons
        repoNodes.filter((d: NodeData) => {
            const hasAvatar = !!d.avatar;
            console.log(`🖼️ Repo node ${d.id} has avatar:`, hasAvatar);
            return hasAvatar;
        })
            .append('defs')
            .append('pattern')
            .attr('id', (d: NodeData) => `repo-avatar-${d.id}`)
            .attr('patternUnits', 'objectBoundingBox')
            .attr('width', 1)
            .attr('height', 1)
            .append('image')
            .attr('href', (d: NodeData) => {
                console.log(`🔗 Setting avatar href for ${d.id}:`, d.avatar?.substring(0, 50) + '...');
                return d.avatar || '';
            })
            .attr('width', 50)
            .attr('height', 50)
            .attr('x', 0)
            .attr('y', 0);
        
        // Add circles - with avatar pattern if available, otherwise default style
        repoNodes.append('circle')
            .attr('r', 25)
            .attr('fill', (d: NodeData) => {
                const fill = d.avatar ? `url(#repo-avatar-${d.id})` : '#1f6feb';
                console.log(`🎨 Setting fill for ${d.id}:`, fill);
                return fill;
            })
            .attr('stroke', '#0969da')
            .attr('stroke-width', 2);
        
        // Add fallback GitHub icon for repo nodes without avatars
        repoNodes.filter((d: NodeData) => !d.avatar)
            .append('path')
            .attr('class', 'github-icon')
            .attr('d', 'M-8,-8 L8,-8 L8,8 L-8,8 Z M-6,-6 L6,-6 M-6,-3 L6,-3 M-6,0 L6,0 M-6,3 L6,3 M-6,6 L6,6')
            .attr('fill', 'none')
            .attr('stroke', 'white')
            .attr('stroke-width', '1.5');
        
        // Add labels for repo nodes (rebuild after clearing)
        repoNodes.append('text')
            .attr('class', 'node-label')
            .attr('dy', 35)
            .text((d: NodeData) => d.name);
        
        // Handle contributor nodes (only for new ones)
        const contributorNodes = nodeEnter.filter((d: NodeData) => d.type === 'contributor');
        
        // Add avatar images for contributor nodes
        contributorNodes
            .append('defs')
            .append('pattern')
            .attr('id', (d: NodeData) => `avatar-${d.id}`)
            .attr('patternUnits', 'objectBoundingBox')
            .attr('width', 1)
            .attr('height', 1)
            .append('image')
            .attr('href', (d: NodeData) => d.avatar || '')
            .attr('width', 30)
            .attr('height', 30)
            .attr('x', 0)
            .attr('y', 0);
        
        contributorNodes
            .append('circle')
            .attr('r', 15)
            .attr('fill', (d: NodeData) => `url(#avatar-${d.id})`)
            .attr('stroke', '#1f6feb')
            .attr('stroke-width', 1.5);
        
        nodeEnter.append('text')
            .attr('class', 'node-label')
            .attr('dy', (d: NodeData) => d.type === 'repo' ? 35 : 25)
            .text((d: NodeData) => d.name);
        
        nodes.exit().remove();
        
        if (this.simulation) {
            this.simulation
                .nodes(this.nodes)
                .on('tick', this.ticked.bind(this));
            
            const linkForce = this.simulation.force('link') as d3.ForceLink<NodeData, LinkData>;
            if (linkForce) {
                linkForce.links(this.links);
            }
            
            this.simulation.alpha(1).restart();
        }
    }
    
    private ticked(): void {
        this.linkGroup.selectAll<SVGLineElement, LinkData>('.link')
            .attr('x1', (d: LinkData) => (d.source as NodeData).x || 0)
            .attr('y1', (d: LinkData) => (d.source as NodeData).y || 0)
            .attr('x2', (d: LinkData) => (d.target as NodeData).x || 0)
            .attr('y2', (d: LinkData) => (d.target as NodeData).y || 0);
        
        this.nodeGroup.selectAll<SVGGElement, NodeData>('.node')
            .attr('transform', (d: NodeData) => `translate(${d.x || 0},${d.y || 0})`);
    }
    
    private dragstarted(event: d3.D3DragEvent<SVGGElement, NodeData, NodeData>, d: NodeData): void {
        if (!event.active && this.simulation) {
            this.simulation.alphaTarget(0.3).restart();
        }
        d.fx = d.x;
        d.fy = d.y;
    }
    
    private dragged(event: d3.D3DragEvent<SVGGElement, NodeData, NodeData>, d: NodeData): void {
        d.fx = event.x;
        d.fy = event.y;
    }
    
    private dragended(event: d3.D3DragEvent<SVGGElement, NodeData, NodeData>, d: NodeData): void {
        if (!event.active && this.simulation) {
            this.simulation.alphaTarget(0);
        }
        if (d.type !== 'repo') {
            d.fx = null;
            d.fy = null;
        }
    }
}

// Get repo from URL query parameter
const urlParams = new URLSearchParams(window.location.search);
const repoParam = urlParams.get('repo') || 'stakwork/hive';
const [owner, repo] = repoParam.split('/');

const visualizer = new GitVisualizer();
if (owner && repo) {
    visualizer.addRepoNode(`${owner}/${repo}`);
    visualizer.addContributors(owner, repo);
} else {
    console.error('Invalid repo format. Use: ?repo=owner/repo');
}