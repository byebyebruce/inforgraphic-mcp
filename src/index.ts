#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';
import { closeBrowser, renderInfographic } from './render.js';

// Global config
let config = {
  baseUrl: '',      // e.g., 'http://localhost:3000/images'
  outputDir: '',    // e.g., './images'
};

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
      const uid = randomUUID();
      log('info', 'render_infographic called', { uid, width, height, background, syntaxLength: syntax.length });

      try {
        // Determine output path if URL mode is enabled
        const outputPath = config.baseUrl && config.outputDir 
          ? path.join(config.outputDir, `${uid}.png`)
          : undefined;

        const base64 = await renderInfographic({
          syntax,
          width: width ?? 800,
          height: height ?? 600,
          background: background ?? 'white',
          outputPath,
        });

        const duration = Date.now() - startTime;
        log('info', 'render_infographic success', { uid, duration: `${duration}ms`, imageSize: base64.length });

        // Return URL or base64 based on config
        if (config.baseUrl && outputPath) {
          const imageUrl = `${config.baseUrl}/${uid}.png`;
          log('info', 'Image saved', { uid, path: outputPath, url: imageUrl });
          
          return {
            content: [
              {
                type: 'text',
                text: imageUrl,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: 'image',
                data: base64,
                mimeType: 'image/png',
              },
            ],
          };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const duration = Date.now() - startTime;
        log('error', 'render_infographic failed', { uid, duration: `${duration}ms`, error: message });

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
  log('info', 'Server started', { mode: 'stdio', baseUrl: config.baseUrl || 'disabled' });
}

// SSE transport
async function startSSE(port: number) {
  const server = createServer();
  const app = express();

  // Serve static images if URL mode is enabled
  if (config.outputDir) {
    app.use('/images', express.static(config.outputDir));
    log('info', 'Static file server enabled', { path: '/images', dir: config.outputDir });
  }

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

  // Serve static images if URL mode is enabled
  if (config.outputDir) {
    app.use('/images', express.static(config.outputDir));
    log('info', 'Static file server enabled', { path: '/images', dir: config.outputDir });
  }

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
  let baseUrl = '';
  let outputDir = '';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--sse') mode = 'sse';
    else if (arg === '--http') mode = 'http';
    else if (arg === '--port' && args[i + 1]) port = parseInt(args[++i], 10);
    else if (arg.startsWith('--url=')) baseUrl = arg.substring(6);
    else if (arg.startsWith('--output=')) outputDir = arg.substring(9);
  }

  // Auto-set outputDir if only url is provided
  if (baseUrl && !outputDir) {
    outputDir = './images';
  }

  return { mode, port, baseUrl, outputDir };
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
const { mode, port, baseUrl, outputDir } = parseArgs();

// Set global config
config.baseUrl = baseUrl;
config.outputDir = outputDir;

// Create output directory if needed
if (outputDir && !fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  log('info', 'Created output directory', { dir: outputDir });
}

log('info', 'Starting server', { mode, port, baseUrl: baseUrl || 'disabled', outputDir: outputDir || 'disabled' });

switch (mode) {
  case 'stdio': startStdio(); break;
  case 'sse': startSSE(port); break;
  case 'http': startHTTP(port); break;
}
