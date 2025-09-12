import http from 'http';
import { createGitSeeHandler } from './index.js';

// Create the handler with GitHub token
const gitSeeHandler = createGitSeeHandler({
  token: process.env.GITHUB_TOKEN, // Set this environment variable
  cache: { ttl: 300 } // 5 minute cache
});

// Simple HTTP server
const server = http.createServer(async (req, res) => {
  console.log(`${req.method} ${req.url}`);

  if (req.url === '/api/gitsee' && req.method === 'POST') {
    return gitSeeHandler(req, res);
  }

  if (req.url === '/api/gitsee' && req.method === 'OPTIONS') {
    return gitSeeHandler(req, res);
  }

  // Serve a simple test page
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
<!DOCTYPE html>
<html>
<head>
    <title>GitSee Test</title>
    <style>
        body { 
            background: #0d1117; 
            color: #e6edf3; 
            font-family: system-ui; 
            margin: 0; 
            padding: 20px;
        }
        #visualization { 
            border: 1px solid #30363d; 
            background: #010409;
        }
        button {
            background: #238636;
            color: white;
            border: none;
            padding: 10px 20px;
            margin: 10px;
            border-radius: 6px;
            cursor: pointer;
        }
        button:hover {
            background: #2ea043;
        }
    </style>
    <script src="https://d3js.org/d3.v7.min.js"></script>
</head>
<body>
    <h1>GitSee Test</h1>
    <p>Test the GitSee library with different repositories:</p>
    
    <button onclick="visualizeRepo('stakwork', 'hive')">Stakwork Hive</button>
    <button onclick="visualizeRepo('facebook', 'react')">Facebook React</button>
    <button onclick="visualizeRepo('microsoft', 'vscode')">Microsoft VS Code</button>
    <button onclick="visualizeMultiple()">Multiple Repos</button>
    
    <svg id="visualization" width="800" height="600"></svg>
    
    <script type="module">
        // Simple inline version of GitSee for testing
        class GitSeeTest {
            constructor(svg, apiEndpoint) {
                this.svg = d3.select(svg);
                this.apiEndpoint = apiEndpoint;
                this.width = 800;
                this.height = 600;
                this.nodes = [];
                this.links = [];
                this.init();
            }
            
            init() {
                this.svg.selectAll('*').remove();
                this.container = this.svg.append('g');
                this.linkGroup = this.container.append('g');
                this.nodeGroup = this.container.append('g');
                
                const zoom = d3.zoom().on('zoom', (event) => {
                    this.container.attr('transform', event.transform);
                });
                this.svg.call(zoom);
                
                this.simulation = d3.forceSimulation()
                    .force('link', d3.forceLink().id(d => d.id).distance(100))
                    .force('charge', d3.forceManyBody().strength(-300))
                    .force('center', d3.forceCenter(400, 300))
                    .force('collision', d3.forceCollide().radius(35));
            }
            
            async visualize(owner, repo) {
                try {
                    console.log(\`Fetching \${owner}/\${repo}...\`);
                    const response = await fetch(this.apiEndpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            owner, repo,
                            data: ['repo_info', 'contributors', 'icon']
                        })
                    });
                    
                    const data = await response.json();
                    console.log('API response:', data);
                    
                    this.clear();
                    this.addRepoNode(data.repo?.full_name || \`\${owner}/\${repo}\`, data.icon);
                    
                    if (data.contributors) {
                        data.contributors.forEach(c => {
                            this.addContributorNode(c.login, c.avatar_url);
                        });
                    }
                    
                    this.update();
                } catch (error) {
                    console.error('Visualization error:', error);
                    alert('Error: ' + error.message);
                }
            }
            
            clear() {
                this.nodes = [];
                this.links = [];
            }
            
            addRepoNode(name, icon) {
                this.nodes.push({
                    id: 'repo',
                    type: 'repo',
                    name,
                    avatar: icon,
                    fx: 400,
                    fy: 300
                });
            }
            
            addContributorNode(name, avatar) {
                const id = \`contributor-\${this.nodes.length}\`;
                this.nodes.push({ id, type: 'contributor', name, avatar });
                this.links.push({ source: 'repo', target: id });
            }
            
            update() {
                // Update links
                const links = this.linkGroup.selectAll('line').data(this.links);
                links.enter().append('line').style('stroke', '#30363d').style('stroke-width', '1.5px');
                links.exit().remove();
                
                // Update nodes
                const nodes = this.nodeGroup.selectAll('g').data(this.nodes);
                const nodeEnter = nodes.enter().append('g');
                
                // Repo nodes
                nodeEnter.filter(d => d.type === 'repo').append('circle')
                    .attr('r', 25)
                    .style('fill', '#1f6feb')
                    .style('stroke', '#0969da')
                    .style('stroke-width', '2px');
                
                // Contributor nodes  
                nodeEnter.filter(d => d.type === 'contributor').append('circle')
                    .attr('r', 15)
                    .style('fill', '#238636')
                    .style('stroke', '#1f6feb')
                    .style('stroke-width', '1.5px');
                
                // Labels
                nodeEnter.append('text')
                    .attr('dy', d => d.type === 'repo' ? 35 : 25)
                    .style('fill', '#e6edf3')
                    .style('font-size', '12px')
                    .style('text-anchor', 'middle')
                    .text(d => d.name);
                
                nodes.exit().remove();
                
                // Update simulation
                this.simulation.nodes(this.nodes).on('tick', () => {
                    this.linkGroup.selectAll('line')
                        .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
                        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
                    this.nodeGroup.selectAll('g')
                        .attr('transform', d => \`translate(\${d.x},\${d.y})\`);
                });
                
                this.simulation.force('link').links(this.links);
                this.simulation.alpha(1).restart();
            }
        }
        
        window.gitsee = new GitSeeTest('#visualization', '/api/gitsee');
        
        window.visualizeRepo = (owner, repo) => {
            window.gitsee.visualize(owner, repo);
        };
        
        window.visualizeMultiple = async () => {
            alert('Multiple repo visualization not implemented in test version');
        };
    </script>
</body>
</html>
    `);
    return;
  }

  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`GitSee test server running on http://localhost:${PORT}`);
  console.log(`Set GITHUB_TOKEN environment variable for full functionality`);
  console.log(`Example: GITHUB_TOKEN=your_token npm run server`);
});