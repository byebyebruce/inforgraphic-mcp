# Infographic MCP Server

MCP server for rendering infographics using [@antv/infographic](https://github.com/antvis/infographic).

## Installation

```bash
npm install
npm run build
```

## Quick Start

### Stdio Mode (Default)

```bash
# Run directly
node dist/index.js

# Or with npx
npx .
```

### HTTP Mode

```bash
node dist/index.js --http --port 3000
```

### SSE Mode

```bash
node dist/index.js --sse --port 3000
```

## Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `--http` | Use Streamable HTTP transport | - |
| `--sse` | Use SSE transport | - |
| `--port <number>` | Server port (for HTTP/SSE) | 3000 |
| `--url=<url>` | Return image URL instead of base64 | - |
| `--output=<dir>` | Image output directory | `./images` |

### URL Mode Example

```bash
# Images saved to ./images/, return URL like http://localhost:3000/images/uuid.png
node dist/index.js --http --port 3000 --url=http://localhost:3000/images

# Custom output directory
node dist/index.js --http --port 3000 --url=http://example.com/img --output=./public/img
```

## MCP Configuration

### Cursor / Claude Desktop

```json
{
  "mcpServers": {
    "infographic": {
      "command": "node",
      "args": ["/path/to/infographic-mcp/dist/index.js"]
    }
  }
}
```

### With URL Mode

```json
{
  "mcpServers": {
    "infographic": {
      "command": "node",
      "args": [
        "/path/to/infographic-mcp/dist/index.js",
        "--http",
        "--port", "3000",
        "--url=http://localhost:3000/images"
      ]
    }
  }
}
```

### Using npx (after npm publish)

```json
{
  "mcpServers": {
    "infographic": {
      "command": "npx",
      "args": ["infographic-mcp"]
    }
  }
}
```

## Tool: render_infographic

Renders an infographic from DSL syntax and returns a PNG image.

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `syntax` | string | Yes | - | Infographic DSL syntax string |
| `width` | number | No | 800 | Image width in pixels |
| `height` | number | No | 600 | Image height in pixels |
| `background` | string | No | `"white"` | Background color (`"white"`, `"#f5f5f5"`, `"transparent"`) |

### Returns

- **Default**: PNG image as base64 (`type: "image"`)
- **With `--url`**: Image URL as text (`type: "text"`)

## DSL Syntax

The DSL uses **space-separated** key-value format (NOT YAML colon format):

```
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
```

### Example

```
infographic list-row-horizontal-icon-arrow
data
  title Product Launch Steps
  items
    - label Step 1
      desc Planning phase
      icon mdi/rocket-launch
    - label Step 2
      desc Development phase
      icon mdi/code-tags
    - label Step 3
      desc Launch phase
      icon mdi/flag-checkered
```

### Available Templates

- `list-row-horizontal-icon-arrow`
- `sequence-zigzag-steps-underline-text`
- `sequence-horizontal-zigzag-underline-text`
- `sequence-circular-simple`
- `compare-binary-horizontal-simple-fold`
- `quadrant-quarter-simple-card`
- `list-grid-badge-card`
- `chart-column-simple`
- `chart-bar-plain-text`
- `chart-pie-plain-text`
- `chart-pie-donut-plain-text`
- `hierarchy-tree-curved-line-rounded-rect-node`
- And ~200 more templates

See [AntV Infographic Gallery](https://infographic.antv.vision/gallery) for all templates.

## Docker

### Build

```bash
docker build -t infographic-mcp .
```

### Run

```bash
# Stdio mode
docker run -i --rm infographic-mcp

# HTTP mode
docker run -p 3000:3000 --rm infographic-mcp --http --port 3000

# HTTP mode with URL
docker run -p 3000:3000 --rm infographic-mcp --http --port 3000 --url=http://localhost:3000/images
```

### MCP Config (Docker)

```json
{
  "mcpServers": {
    "infographic": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "infographic-mcp"]
    }
  }
}
```

## Development

```bash
# Development mode (stdio)
npm run dev

# Development mode (HTTP)
npm run dev:http

# Development mode (SSE)
npm run dev:sse

# Run tests
npm test

# Build
npm run build
```

## License

MIT
