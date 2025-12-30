import * as fs from 'fs';
import * as path from 'path';
import { Browser, chromium } from 'playwright';

export interface RenderOptions {
  syntax: string;
  width?: number;
  height?: number;
  outputPath?: string;
  background?: string; // 背景颜色，默认 white，设为 'transparent' 可透明
}

// Browser instance pool for better performance
let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserInstance) {
    browserInstance = await chromium.launch({
      headless: true,
    });
  }
  return browserInstance;
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

/**
 * Render infographic DSL syntax to PNG image
 */
export async function renderInfographic(options: RenderOptions): Promise<string> {
  const { syntax, width = 800, height = 600, outputPath, background = 'white' } = options;

  // Escape the syntax string for embedding in JavaScript
  const escapedSyntax = syntax
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewportSize({ width, height });

    // HTML template that loads @antv/infographic from CDN
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { 
      width: ${width}px; 
      height: ${height}px; 
      background: ${background}; 
    }
    #container { 
      width: ${width}px; 
      height: ${height}px; 
    }
  </style>
</head>
<body>
  <div id="container"></div>
  <script type="module">
    import { Infographic } from 'https://esm.sh/@antv/infographic@latest';
    
    window.renderReady = false;
    window.renderError = null;
    
    async function render() {
      try {
        const infographic = new Infographic({
          container: '#container',
          width: ${width},
          height: ${height},
          editable: true,
        });
        
        await infographic.render(\`${escapedSyntax}\`);
        
        // Wait for SVG to appear
        const waitForSvg = () => new Promise((resolve, reject) => {
          const check = (attempts = 0) => {
            const svg = document.querySelector('#container svg');
            if (svg) {
              resolve(svg);
            } else if (attempts > 50) {
              reject(new Error('SVG not found after waiting'));
            } else {
              setTimeout(() => check(attempts + 1), 100);
            }
          };
          check();
        });
        
        await waitForSvg();
        await new Promise(resolve => setTimeout(resolve, 500));
        
        window.renderReady = true;
      } catch (error) {
        console.error('Render error:', error);
        window.renderError = error.message || String(error);
      }
    }
    
    render();
  </script>
</body>
</html>
`;

    await page.setContent(html, { waitUntil: 'networkidle' });

    // Wait for render to complete
    await page.waitForFunction(
      () => (window as any).renderReady === true || (window as any).renderError !== null,
      { timeout: 60000 }
    );

    // Check for errors
    const error = await page.evaluate(() => (window as any).renderError);
    if (error) {
      throw new Error(`Infographic render error: ${error}`);
    }

    // Use Playwright screenshot to capture with background
    const screenshot = await page.screenshot({
      type: 'png',
      omitBackground: background === 'transparent',
    });

    const base64 = screenshot.toString('base64');

    // If outputPath is provided, save to file
    if (outputPath) {
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(outputPath, screenshot);
    }

    return base64;
  } finally {
    await page.close();
  }
}
