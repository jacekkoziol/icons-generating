import * as sass from 'sass'
import path from 'path';
import fs from 'fs/promises';
import chalk from 'chalk';

// Get the directory of the current module
const __dirname = path.dirname(new URL(import.meta.url).pathname);

// Source files generated by `generate-icons.mjs`
const SOURCE_DIR = path.resolve(__dirname, 'dist');
const ICONS_DATA_FILE = SOURCE_DIR + '/icons/icons.json';
const ASSETS_FILE_TO_COPY = SOURCE_DIR + '/icons/icons.svg';

// Demo Scss main file
const SCSS_SOURCE_FILE = './_demo-styles.scss';

// Destination files
const DEMO_DEST_FOLDER = path.resolve(__dirname, 'demo');
const DEMO_STYLES_FILE = DEMO_DEST_FOLDER + '/styles.css';
const DEMO_HTML_FILE = DEMO_DEST_FOLDER + '/index.html';

const printLog = (...args) => console.log(chalk.dim('[icons Demo]::'), ...args);

function escapeHtml(unsafe) {
  return unsafe
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

async function createDestinationDir() {
  const dirCreation = await fs.mkdir(DEMO_DEST_FOLDER, { recursive: true });
  dirCreation && printLog(`DEMO Destination directory created:`, chalk.italic.underline(dirCreation));
}

async function compileAndWriteStyles() {
  const scss = sass.compile(SCSS_SOURCE_FILE);
  const scssDemoStyles = sass.compile(SCSS_SOURCE_FILE);
  const cssWithAdjustedPaths = scss.css.toString().replace(/url\(['"]\.\/icons\//g, 'url("');

  try {
    await fs.writeFile(DEMO_STYLES_FILE, cssWithAdjustedPaths, 'utf-8');
    printLog(`Compiled styles file: ${chalk.italic.underline(DEMO_STYLES_FILE)}`);
  } catch (error) {
    throw new Error(`Error generating ${DEMO_STYLES_FILE}: ${error.message}`);
  }
}

async function generateHTMLPreviewDemo() {
  const svgDataContent = await fs.readFile(ICONS_DATA_FILE, 'utf-8');
  const svgData = JSON.parse(svgDataContent);

  const htmlContent = svgData
    .map((data) => {
      return `
        <div class="element">
          <div class="element__icon">
            <i class="o-icon o-icon--${data.iconId}"></i>
          </div>
          <code class="element__usage">
            ${escapeHtml(`<i class="o-icon o-icon--${data.iconId}"></i>`)}
          </code>
        </div>
`
    })
    .join('')
    .trim();

  const htmlPreview = `
<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Icons Demo</title>
    <link rel="stylesheet" href="./styles.css">

    <style>
      :root {
        font-size: 62.5%;
      }

      body {
        padding: 1rem;
        background: #f5f5f5;
      }

      h1 {
        margin-bottom: 1rem;
      }

      .element {
        display: inline-block;
        border: 1px solid #ccc;
        border-radius: 4px;
        padding: 1rem;
        margin: 1rem;
        background: #fff;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        text-align: center;
        font-size: 3.6rem;
        color: #333;
        transition: 0.2s;
      }

      .element:hover {
        color: #2a62cd;
        box-shadow: 0 2px 15px rgba(0, 0, 0, 0.3);
      }

      .element__icon {
       display: flex;
       align-items: center;
       justify-content: center;
      }

      .element__usage {
        display: block;
        font-family: monospace;
        font-size: 1.2rem;
        color: currentcolor;
        margin: 1.5rem 0 0.5rem;
      }
    </style>
  </head>
  <body>
    <h1>Icons Demo</h1>
    <section>
      <h2>Available Icons</h2>
      ${htmlContent}
    </section>

    <section>
      <h2>Custom class Icons with mixin usage</h2>
      <div class="element">
        <div class="element__icon"></div>
          <i class="custom-monochromatic-icon"></i>
        </div>
      </div>
      <div class="element">
        <div class="element__icon"></div>
          <i class="custom-multicolor-icon"></i>
        </div>
      </div>
    </section>
  </body>
</html>
`.trim() + '\n';

  try {
    await fs.writeFile(DEMO_HTML_FILE, htmlPreview, 'utf-8');
    printLog(`Generated HTML preview file: ${chalk.italic.underline(DEMO_HTML_FILE)}`);
  } catch (error) {
    throw new Error(`Error generating ${DEMO_HTML_FILE}: ${error.message}`);
  }
}

async function copyAssets() {
  const dest = `${DEMO_DEST_FOLDER}/icons.svg`
  await fs.copyFile(ASSETS_FILE_TO_COPY, dest);
  printLog(`Copied assets to: ${chalk.italic.underline(DEMO_DEST_FOLDER)}`);
}

async function createDemo() {
  await fs.rm(DEMO_DEST_FOLDER, { recursive: true, force: true });
  await createDestinationDir();
  await compileAndWriteStyles();
  await generateHTMLPreviewDemo();
  await copyAssets();
}

createDemo();