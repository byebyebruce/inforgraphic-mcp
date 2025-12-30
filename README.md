# Infographic MCP Server

MCP server for rendering infographics using [@antv/infographic](https://github.com/antvis/infographic).

## Installation

```bash
npm install
npx playwright install chromium
npm run build
```

## Usage

### As MCP Server

Add to your Cursor/Claude Desktop MCP configuration:

```json
{
  "mcpServers": {
    "infographic": {
      "command": "node",
      "args": ["/path/to/inforgraphic-mcp/dist/index.js"]
    }
  }
}
```

Or using tsx for development:

```json
{
  "mcpServers": {
    "infographic": {
      "command": "npx",
      "args": ["tsx", "/path/to/inforgraphic-mcp/src/index.ts"]
    }
  }
}
```

### Tool: render_infographic

Renders an infographic from DSL syntax and returns a PNG image.

**Parameters:**
- `syntax` (string, required): Infographic DSL syntax string
- `width` (number, optional): Image width in pixels (default: 800)
- `height` (number, optional): Image height in pixels (default: 600)

**Returns:** PNG image as base64

## DSL Syntax

The DSL uses space-separated key-value format (NOT YAML colon format):

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

## Development

```bash
# Run tests
npm test

# Development mode
npm run dev

# Build
npm run build
```

## License

MIT

