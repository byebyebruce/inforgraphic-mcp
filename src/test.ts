import { closeBrowser, renderInfographic } from './render.js';

async function main() {
  const syntax = `infographic list-row-horizontal-icon-arrow
data
  title Product Launch Steps
  items
    - label Step 1
      desc Start
    - label Step 2
      desc In Progress
    - label Step 3
      desc Complete`;

  console.log('Rendering infographic...');
  try {
    const base64 = await renderInfographic({
      syntax,
      width: 800,
      height: 400,
      outputPath: 'output.png',
    });
    console.log('PNG saved to: output.png');
    console.log(`Base64 length: ${base64.length}`);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await closeBrowser();
  }
}

main();
