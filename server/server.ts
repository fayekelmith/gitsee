import { IncomingMessage, ServerResponse, createServer } from 'http';
import { URL } from 'url';
import { GitSeeHandler } from './handler.js';
import type { GitSeeOptions } from './types/index.js';

export function createGitSeeServer(options: GitSeeOptions = {}) {
  const handler = new GitSeeHandler(options);

  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);

      // Handle SSE endpoint: /api/gitsee/events/:owner/:repo
      if (url.pathname.startsWith('/api/gitsee/events/')) {
        const pathParts = url.pathname.split('/');
        if (pathParts.length >= 6) {
          const owner = pathParts[4];
          const repo = pathParts[5];

          console.log(`📡 SSE request for ${owner}/${repo}`);
          return await handler.handleEvents(req, res, owner, repo);
        }
      }

      // Handle regular API endpoint: /api/gitsee
      if (url.pathname === '/api/gitsee') {
        return await handler.handle(req, res);
      }

      // Handle CORS preflight for SSE
      if (req.method === 'OPTIONS') {
        res.writeHead(200, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Cache-Control',
        });
        res.end();
        return;
      }

      // 404 for other routes
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));

    } catch (error) {
      console.error('Server error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error'
      }));
    }
  });
}

// Factory function for easy integration (keeps compatibility)
export function createGitSeeHandler(options: GitSeeOptions = {}) {
  const handler = new GitSeeHandler(options);
  return (req: IncomingMessage, res: ServerResponse) => handler.handle(req, res);
}

// Export the handler class
export { GitSeeHandler };