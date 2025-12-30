#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { closeBrowser, renderInfographic } from './render.js';

// Simple logger
function log(level: 'info' | 'error' | 'debug', message: string, data?: object) {
  const timestamp = new Date().toISOString();
  const logData = data ? ` ${JSON.stringify(data)}` : '';
  console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}${logData}`);
}

// Create MCP server
function createServer() {
  const server = new McpServer({
    name: 'infographic-server',
    version: '1.0.0',
  });

  // Register the render_infographic tool
  server.registerTool(
    'render_infographic',
    {
      title: 'Render Infographic',
      description: `Render an infographic from DSL syntax and return as PNG image.

DSL syntax format (space-separated key-value, NOT YAML colon format):
\`\`\`
infographic <template-name>
data
  title My Title
  desc My Description
  items
    - label Item 1
      desc Description 1
      value 100
      icon mdi/icon-name
    - label Item 2
      desc Description 2
theme
  palette #3b82f6 #8b5cf6 #f97316
\`\`\`

Available templates include:
- list-row-horizontal-icon-arrow
- sequence-zigzag-steps-underline-text
- compare-binary-horizontal-simple-fold
- chart-pie-plain-text
- hierarchy-tree-curved-line-rounded-rect-node
- And more (~200 templates available)`,
      inputSchema: {
        syntax: z.string().describe('Infographic DSL syntax string'),
        width: z.number().optional().default(800).describe('Image width in pixels'),
        height: z.number().optional().default(600).describe('Image height in pixels'),
        background: z.string().optional().default('white').describe('Background color (e.g., "white", "#f5f5f5", "transparent")'),
      },
    },
    async ({ syntax, width, height, background }) => {
      const startTime = Date.now();
      log('info', 'render_infographic called', { width, height, background, syntaxLength: syntax.length });

      try {
        const base64 = await renderInfographic({
          syntax,
          width: width ?? 800,
          height: height ?? 600,
          background: background ?? 'white',
        });

        const duration = Date.now() - startTime;
        log('info', 'render_infographic success', { duration: `${duration}ms`, imageSize: base64.length });

        return {
          content: [
            {
              type: 'image',
              data: base64,
              mimeType: 'image/png',
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const duration = Date.now() - startTime;
        log('error', 'render_infographic failed', { duration: `${duration}ms`, error: message });

        return {
          content: [{ type: 'text', text: `Error rendering infographic: ${message}` }],
          isError: true,
        };
      }
    }
  );

  return server;
}

// Stdio transport
async function startStdio() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('info', 'Server started', { mode: 'stdio' });
}

// SSE transport
async function startSSE(port: number) {
  const server = createServer();
  const app = express();

  app.get('/sse', async (req, res) => {
    log('info', 'SSE connection established', { ip: req.ip });
    const transport = new SSEServerTransport('/messages', res);
    await server.connect(transport);
  });

  app.post('/messages', async (req, res) => {
    log('debug', 'SSE message received');
    res.status(200).end();
  });

  app.listen(port, () => {
    log('info', 'Server started', { mode: 'sse', port, url: `http://localhost:${port}/sse` });
  });
}

// Streamable HTTP transport
async function startHTTP(port: number) {
  const app = express();
  app.use(express.json());

  const transports: Record<string, StreamableHTTPServerTransport> = {};

  app.post('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      log('debug', 'Reusing session', { sessionId });
      transport = transports[sessionId];
    } else {
      const newSessionId = randomUUID();
      log('info', 'Creating new session', { sessionId: newSessionId });

      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => newSessionId,
        onsessioninitialized: (id) => {
          transports[id] = transport;
          log('info', 'Session initialized', { sessionId: id });
        },
      });

      const server = createServer();
      await server.connect(transport);
    }

    await transport.handleRequest(req, res, req.body);
  });

  app.get('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string;
    log('debug', 'GET /mcp', { sessionId });

    const transport = transports[sessionId];
    if (transport) {
      await transport.handleRequest(req, res);
    } else {
      log('error', 'Invalid session', { sessionId });
      res.status(400).send('Invalid session');
    }
  });

  app.delete('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string;
    log('info', 'Session closing', { sessionId });

    const transport = transports[sessionId];
    if (transport) {
      await transport.handleRequest(req, res);
      delete transports[sessionId];
      log('info', 'Session closed', { sessionId });
    } else {
      log('error', 'Invalid session for delete', { sessionId });
      res.status(400).send('Invalid session');
    }
  });

  app.listen(port, () => {
    log('info', 'Server started', { mode: 'http', port, url: `http://localhost:${port}/mcp` });
  });
}

// Parse args and start
function parseArgs() {
  const args = process.argv.slice(2);
  let mode: 'stdio' | 'sse' | 'http' = 'stdio';
  let port = 3000;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--sse') mode = 'sse';
    else if (args[i] === '--http') mode = 'http';
    else if (args[i] === '--port' && args[i + 1]) port = parseInt(args[++i], 10);
  }
  return { mode, port };
}

// Graceful shutdown
process.on('SIGINT', async () => {
  log('info', 'Shutting down (SIGINT)');
  await closeBrowser();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  log('info', 'Shutting down (SIGTERM)');
  await closeBrowser();
  process.exit(0);
});

// Main
const { mode, port } = parseArgs();
log('info', 'Starting server', { mode, port });

switch (mode) {
  case 'stdio': startStdio(); break;
  case 'sse': startSSE(port); break;
  case 'http': startHTTP(port); break;
}
