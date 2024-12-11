import fs from 'fs/promises';
import path from 'path';
import svgo from 'svgo';
import chalk from 'chalk';

// Get the directory of the current module
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const printLog = (...args) => console.log(chalk.dim('[icons]::'), ...args);

const api = {
  resolve: (...args) => path.resolve(__dirname, ...args),
};

const icons = (api) => {
  const svgSourceFilesDirectory = api.resolve('icons-source');
  const svgSourceFilesDirectoryMono = svgSourceFilesDirectory + '/';
  const svgSourceFilesDirectoryColor = svgSourceFilesDirectory + '/color/';

  const iconsDestinationFolder = api.resolve('dist/icons');
  const iconsJsonFileDestinationFile = iconsDestinationFolder + '/icons.json';
  const iconsFileDestinationFile = iconsDestinationFolder + '/icons.svg';

  const iconsScssSettingsFileDestinationFolder = api.resolve('dist');
  const iconsScssMixinsFileDestinationFile = iconsScssSettingsFileDestinationFolder + '/_icons-mixin.scss';
  const iconsScssStyleFileDestinationFile = iconsScssSettingsFileDestinationFolder + '/_icons.scss';

  function optimizeSVG(svgContent, idPrefix, colorfulIcons) {
    const configMono = [
      {
        name: 'removeAttrs',
        params: {
          attrs: ['path:(fill|stroke)', 'fill'],
        },
      },
    ];

    const configColor = [];
    const config = colorfulIcons ? configColor : configMono;

    const result = svgo.optimize(svgContent, {
      removeViewBox: false,
      removeDimensions: false,
      plugins: [
        'preset-default',
        'removeDimensions',
        {
          name: 'prefixIds',
          params: {
            delim: '',
            prefixIds: true,
            prefixClassNames: true,
            prefix: (data) => {
              const prefix =
                data.type === 'element' &&
                data.name === 'use' &&
                data.attributes?.href?.startsWith('#icon-')
                  ? ''
                  : `${idPrefix}__`;
              return prefix;
            },
          },
        },
        ...config,
      ],
    });
    return result.data;
  }

  async function parseSVGFileData(iconSourceFilePath, iconColorful) {
    const iconName = path.basename(iconSourceFilePath, '.svg').replace(/[_|\s]/gm, '-');
    const iconId = iconColorful ? `icon-color-${iconName}` : `icon-${iconName}`;
    const iconViewId = `${iconId}-view`;
    const svgContent = await fs.readFile(iconSourceFilePath, 'utf-8');
    const optimizedSvgContent = optimizeSVG(svgContent, iconId, iconColorful);
    const viewBoxMatch = optimizedSvgContent.match(/viewBox=["']([^'|^"]+)["']/);
    const svgViewBox = viewBoxMatch ? viewBoxMatch[1] : null;
    const defsRegex = /<defs>([\s\S]*?)<\/defs>/gm;
    const defsMatches = optimizedSvgContent.matchAll(defsRegex);
    const svgDefsContent = Array.from(defsMatches)
      .map((data) => data[1].trim())
      .join('\n');

    if (!svgViewBox) {
      throw Error(`SVG viewBox not found in file ${iconSourceFilePath}.`);
    }

    const svgWidth = parseInt(svgViewBox.split(' ')[2], 10);
    const svgHeight = parseInt(svgViewBox.split(' ')[3], 10);
    const svgRectangle = svgWidth !== svgHeight;
    const svgIconDataFull = optimizedSvgContent.replace(/<svg[^>]*>|<\/svg>/gi, '').trim();
    const svgIconDataNoDefs = svgIconDataFull.replace(defsRegex, '');

    return {
      iconSourceFilePath,
      iconName,
      iconColorful,
      iconId,
      iconViewId,
      svgViewBox,
      svgWidth,
      svgHeight,
      svgIconDataFull,
      svgIconDataNoDefs,
      svgDefsContent,
      svgRectangle,
    };
  }

  async function readSVGFilesDataOptimized(sourceDir = svgSourceFilesDirectory, iconsColorful) {
    const sourceDirExists = await fs.access(sourceDir).then(() => true).catch(() => false);
    if (!sourceDirExists) {
      printLog(chalk.yellow(`Path to source SVG files not found!!!`), chalk.italic.underline(sourceDir));
      return [];
    }

    const svgFiles = await fs.readdir(sourceDir);
    const svgFilesDataPromises = svgFiles
      .filter((file) => file.endsWith('.svg'))
      .map((file) => parseSVGFileData(path.join(sourceDir, file), iconsColorful));

    const svgIconsData = await Promise.all(svgFilesDataPromises);
    return svgIconsData;
  }

  async function createDestinationDir() {
    const dirCreation = await fs.mkdir(iconsDestinationFolder, { recursive: true });
    dirCreation && printLog(`Destination directory created:`, chalk.italic.underline(dirCreation));
  }

  /**
   * @param {SvgItemData[]} svgIconsData
   */
  async function generateFileContentDataOfSvgIcons(svgIconsData, viewBoxYStartAt = 0) {
    const iconsViewGap = 10;
    const viewBoxMaxWidth = svgIconsData
      .map((data) => data.svgWidth)
      .reduce((max, width) => (width > max ? width : max), 0);

    const contentData = {
      views: ``,
      groups: ``,
      defs: ``,
      viewBoxTotalHeight: 0,
      viewBoxMaxWidth,
    };

    let viewBoxY = viewBoxYStartAt;

    svgIconsData.forEach((data) => {
      const tmpViewBoxElementPositionY = viewBoxY;
      const tmpViewBoxForView = `0 ${tmpViewBoxElementPositionY} ${data.svgWidth} ${data.svgHeight}`;

      viewBoxY += data.svgHeight + iconsViewGap;
      contentData.viewBoxTotalHeight += data.svgHeight + iconsViewGap;
      contentData.defs += data.svgDefsContent ? `\t\t${data.svgDefsContent}\n` : '';
      contentData.views += `\t<view id="${data.iconId}-view" viewBox="${tmpViewBoxForView}" />\n`;

      contentData.groups += `
  <svg y="${tmpViewBoxElementPositionY}">
    <g id="${data.iconId}">
      ${data.svgIconDataNoDefs}
    </g>
  </svg>`;
    });

    return {contentData, viewBoxY};
  }

  /**
   *
   * @param {SvgItemData[]} svgIconsDataMono
   * @param {SvgItemData[]} svgIconsDataColor
   */
  async function generateIconsFile(svgIconsDataMono, svgIconsDataColor) {
    const {contentData: contentDataMono, viewBoxY} = await generateFileContentDataOfSvgIcons(svgIconsDataMono);
    const {contentData: contentDataColor} = await generateFileContentDataOfSvgIcons(svgIconsDataColor, viewBoxY);

    const iconsSVG =
      `
<!-- This file is auto generated. Do not edit directly. -->

<svg version="1.1" viewBox="0 0 ${contentDataColor.viewBoxMaxWidth} ${contentDataColor.viewBoxTotalHeight}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    ${contentDataColor.defs.trim()}
  </defs>

  <!-- Monochromatic icons -->
  ${contentDataMono.views.trim()}

  ${contentDataMono.groups.trim()}

  <!-- Colored icons -->
  ${contentDataColor.views.trim()}

  ${contentDataColor.groups.trim()}
</svg>`.trim() + '\n';

    try {
      await fs.writeFile(iconsFileDestinationFile, iconsSVG, 'utf-8');
      printLog(`Generated SVG icons file: ${chalk.italic.underline(iconsFileDestinationFile)}`);
    } catch (error) {
      throw new Error(`Error generating ${iconsFileDestinationFile}: ${error.message}`);
    }
  }

  /**
   * @param {SvgItemData[]} svgIconsData
   */
  async function generateScssMixinsFile(svgIconsData) {
    const scssIndividualIconsMixins = svgIconsData
      .map((data) => {
        let mixinContent;

        if (data.iconColorful) {
          mixinContent = `
  background-image: url('./icons/icons.svg#${data.iconViewId}');
  background-repeat: no-repeat;
  background-size: contain;
    `;
        } else {
          mixinContent = `
  mask: url('./icons/icons.svg#${data.iconViewId}');
  mask-repeat: no-repeat;
  mask-size: contain;
  background-color: var(--o-icon-color, currentcolor);
    `;
        }

        if (data.svgRectangle) {
          mixinContent += `width: math.div(${data.svgWidth}, ${data.svgHeight}) * 1em;`
        }

        return `
@mixin ${data.iconId} {
  ${mixinContent.trim()}
}
  `;
      })
      .join('')
      .trim();

    const scssMixinsFileContent =
      `@use 'sass:map';
@use 'sass:math';

/* This file is auto generated. Do not edit directly. */

@mixin icon() {
  height: 1em;
  line-height: 1em;
  font-size: var(--o-icon-size, 1em);

  &::before {
    content: '';
    display: block;
    line-height: 1em;
    height: 1em;
    width: 1em;
  }
}

${scssIndividualIconsMixins}
  `.trim() + '\n';

    try {
      await fs.writeFile(iconsScssMixinsFileDestinationFile, scssMixinsFileContent, 'utf-8');
      printLog(`Generated SCSS mixins file: ${chalk.italic.underline(iconsScssMixinsFileDestinationFile)}`);
    } catch (error) {
      throw new Error(`Error generating ${iconsScssMixinsFileDestinationFile}: ${error.message}`);
    }
  }

  /**
   * @param {SvgItemData[]} svgIconsData
   */
  async function generateScssStylesFile(svgIconsData) {
    const scssIndividualIconsClasses = svgIconsData
      .map((data) => {
        return `
.o-icon--${data.iconId}::before {
  @include ${data.iconId}();
}
`;
      })
      .join('')
      .trim();

    const scssSettingsFileContent =
      `
@use './icons-mixin' as *;

/* This file is auto generated. Do not edit directly. */

.o-icon {
  @include icon();
}

${scssIndividualIconsClasses}
`.trim() + '\n';

    try {
      await fs.writeFile(iconsScssStyleFileDestinationFile, scssSettingsFileContent, 'utf-8');
      printLog(`Generated SCSS styles file: ${chalk.italic.underline(iconsScssStyleFileDestinationFile)}`);
    } catch (error) {
      throw new Error(`Error generating ${iconsScssStyleFileDestinationFile}: ${error.message}`);
    }
  }

  /**
   * @param {SvgItemData[]} svgIconsData
   */
  async function generateIconsJsonFile(svgIconsData) {
    try {
      const jsonContent = JSON.stringify(svgIconsData, null, 2).trim() + '\n';
      await fs.writeFile(iconsJsonFileDestinationFile, jsonContent, 'utf-8');
      printLog(`Generated JSON icons data file: ${chalk.italic.underline(iconsJsonFileDestinationFile)}`);
    } catch (error) {
      throw new Error(`Error generating ${iconsJsonFileDestinationFile}: ${error.message}`);
    }
  }

  async function generateIconsHTMLPreview(svgIconsDataMono = [], svgIconsDataColor = []) {
    const allIconsData = [...svgIconsDataColor, ...svgIconsDataMono];

    const iconsColorHTML = svgIconsDataColor
      .map((data) => {
        return `
      <div class="element">
        <i class="o-icon o-icon--color o-icon--${data.iconId}" style="background-image: url(./icons.svg#${data.iconViewId});"></i>
        <p class="element__name" title="Usage name">${data.iconId.replace('icon-', '')}</p>
        <p class="element__id">View ID: ${data.iconViewId}</p>
      </div>`;
      })
      .join('\n').trim();

    const iconsMonoHTML = svgIconsDataMono
      .map((data) => {
        return `
      <div class="element">
        <i class="o-icon o-icon--mono o-icon--${data.iconId}" style="mask-image: url(./icons.svg#${data.iconViewId});"></i>
        <p class="element__name" title="Usage name">${data.iconId.replace('icon-', '')}</p>
        <p class="element__id">View ID: ${data.iconViewId}</p>
      </div>`;
      })
      .join('\n').trim();

    const cssClasses = allIconsData
      .filter((data) => data.svgWidth / data.svgHeight !== 1)
      .map((data) => {
        return `\t.o-icon--${data.iconId}{ width: calc(${data.svgWidth / data.svgHeight} * 1em); }\n`;
      })
      .join('')
      .trim();

    const htmlContent = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Icons Preview</title>
  <style>
    :root {
      font-size: 62.5%;
    }
    body {
      font-size: 3.6rem;
      background: #f4f4f4;
    }

    h2 {
      display: block;
      margin: 1rem 0;
      width: 100%;
      font-size: 3rem;
    }

    section {
      display: flex;
      gap: 2rem;
      flex-wrap: wrap;
      align-items: center;
      padding: 20px;
    }

    .info {
      font-size: 1.6rem;
      color: #333;
      background: #fff7e3;
      padding: 1rem;
      border: 1px solid #f7d990;
      border-radius: 1rem;
      text-align: center;
    }

    .element {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      border: 1px solid #ccc;
      border-radius: 1rem;
      background: #fff;
      color: #333;
    }

    .element:hover {
      color: #0073aa;
    }

    .element__name {
      font-family: monospace;
      font-size: 1.4rem;
      color: currentcolor;
      margin: 1.5rem 0 0.5rem;
    }

    .element__id {
      font-family: monospace;
      font-size: 0.9rem;
      color: #999;
      margin: 0.5rem 0 0;
    }

    .o-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 1em;
      line-height: 1em;;
      width: 1em;
      font-size: var(--o-icon-size, 1em);
    }

    .o-icon--color {
      background-repeat: no-repeat;
      background-size: contain;
    }

    .o-icon--mono {
      mask-repeat: no-repeat;
      mask-size: contain;
      background-color: var(--o-icon-color, currentcolor);
    }

    ${cssClasses}
  </style>
  </head>
  <body>
    <!-- Potential issues: https://betravis.github.io/icon-methods/svg-sprite-sheets.html -->
    <p class="info">To properly display this file, it shouldn't be opened directly in the browser, but it should be served.</p>
    <section>
      <h2>Colorful Icons</h2>
      ${iconsColorHTML}
    </section>
    <section>
      <h2>Monochromatic Icons</h2>
      ${iconsMonoHTML}
    </section>
  </body>
  </html>
  `.trim();

    const previewDestinationFolder = `${iconsDestinationFolder}/index.html`;

    try {
      await fs.writeFile(previewDestinationFolder, htmlContent, 'utf-8');
      printLog(`Generated HTML preview file: ${chalk.italic.underline(previewDestinationFolder)}`);
    } catch (error) {
      throw new Error(`Error generating icons-preview.html: ${error.message}`);
    }
  }

  return async function generateIcons() {
    printLog(chalk.cyanBright('Starting icons files generation'));
    printLog('Path to source SVG files:', chalk.italic.underline(svgSourceFilesDirectory));

    const svgIconsDataMono = await readSVGFilesDataOptimized(svgSourceFilesDirectoryMono, false);
    const svgIconsDataColor = await readSVGFilesDataOptimized(svgSourceFilesDirectoryColor, true);
    const allIconsData = [...svgIconsDataMono, ...svgIconsDataColor];

    if (allIconsData.length === 0) {
      printLog(chalk.yellow('No icons found!!!'));
      printLog(chalk.yellow('Warning: Skipping icons files generation!'));
      return;
    }

    await createDestinationDir();
    await Promise.all([
      generateIconsFile(svgIconsDataMono, svgIconsDataColor),
      generateScssMixinsFile(allIconsData),
      generateScssStylesFile(allIconsData),
      generateIconsJsonFile(allIconsData),
      generateIconsHTMLPreview(svgIconsDataMono, svgIconsDataColor),
    ]);

    printLog(chalk.green('Icons files generated successfully'));
  }
}

await fs.rm(api.resolve('dist/'), { recursive: true, force: true });
icons(api)();


/**
 * @typedef SvgItemData
 * @type {object}
 * @property {string} iconSourceFilePath - path to the source SVG file
 * @property {string} iconName - the name of the icon
 * @property {boolean} iconColorful - whether the icon is colorful or not
 * @property {string} iconId - the ID of the icon
 * @property {string} iconViewId - the ID of the icon view
 * @property {string} svgViewBox - the viewBox of the SVG
 * @property {number} svgWidth - the width of the SVG
 * @property {number} svgHeight - the height of the SVG
 * @property {string} svgIconDataFull - the full SVG data
 * @property {string} svgIconDataNoDefs - the SVG data without defs
 * @property {string} svgDefsContent - the defs content
 * @property {boolean} svgRectangle - whether the SVG is a rectangle
 */