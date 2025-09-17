import fs from 'fs/promises';
import path from 'path';
import { optimize } from 'svgo';
import chalk from 'chalk';

/*
  npm install --save-dev chalk svgo
*/

/**
 * To properly support Safari Browser, mask-size/background-size needs to be set to 'cover' instead of 'contain'.
 */

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
  const iconsJsonDestinationFile = iconsDestinationFolder + '/icons.json';

  const iconsSVGBundleFileName = `icons.svg`;
  const iconsSVGBundleDestinationFile = iconsDestinationFolder + '/' + iconsSVGBundleFileName;

  const iconsScssDestinationFolder = api.resolve('dist');
  const iconsScssMixinsDestinationFile = iconsScssDestinationFolder + '/_icons-mixin.scss';
  const iconsScssStyleDestinationFile = iconsScssDestinationFolder + '/_icons.scss';

  const iconMonoIdPrefix = 'mono-icon';
  const iconColorIdPrefix = 'color-icon';

  const cssVarNameIconSize = '--o-icon-size';
  const cssVarNameIconColor = '--o-icon-color';
  const cssVarNameIconUrl = '--o-icon-svg-url';
  const cssVarNameIconHeight = '--o-icon-svg-height'; // for square icons

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

    const result = optimize(svgContent, {
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
    const iconName = path.basename(iconSourceFilePath, '.svg').replace(/[_|\s]/gm, '-').toLowerCase();;
    const iconId = iconColorful ? `${iconColorIdPrefix}-${iconName}` : `${iconMonoIdPrefix}-${iconName}`;
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

    const svgWidth = parseFloat(svgViewBox.split(' ')[2], 10);
    const svgHeight = parseFloat(svgViewBox.split(' ')[3], 10);
    const svgRectangle = svgWidth !== svgHeight;
    const svgIconDataFull = optimizedSvgContent.replace(/<svg[^>]*>|<\/svg>/gi, '').trim();
    const svgIconDataNoDefs = svgIconDataFull.replace(defsRegex, '');
    const iconSourceFilePathRel = iconSourceFilePath.replace(__dirname, '');

    return {
      iconSourceFilePathRel,
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

    const totalHeight = contentDataMono.viewBoxTotalHeight + contentDataColor.viewBoxTotalHeight;
    const totalWidth = Math.max(contentDataMono.viewBoxMaxWidth, contentDataColor.viewBoxMaxWidth);
    const viewBox = `0 0 ${totalWidth} ${totalHeight}`;

    const iconsSVG =
      `
<!-- This file is auto generated. Do not edit directly. -->

<svg version="1.1" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
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
      await fs.writeFile(iconsSVGBundleDestinationFile, iconsSVG, 'utf-8');
      printLog(`Generated SVG icons file: ${chalk.italic.underline(iconsSVGBundleDestinationFile)}`);
    } catch (error) {
      throw new Error(`Error generating ${iconsSVGBundleDestinationFile}: ${error.message}`);
    }
  }

  /**
   * @param {SvgItemData[]} svgIconsData
   */
  async function generateScssMixinsFile(svgIconsData) {
    const qp = `v=${Date.now()}`;
    const scssIndividualIconsMixins = svgIconsData
      .map((data) => {
        let mixinContent;

        mixinContent = `${cssVarNameIconUrl}: url('./icons/${iconsSVGBundleFileName}?${qp}#${data.iconViewId}');`;

        if (data.svgRectangle) {
          mixinContent += `
  ${cssVarNameIconHeight}: ${data.svgHeight / data.svgWidth}em;
  width: math.div(${data.svgWidth}, ${data.svgHeight}) * 1em;`
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
@use "sass:string";

/* This file is auto generated. Do not edit directly. */

/** Mixin that creates a set of classes for SVG icon
 * @param {boolean} $multicolor - whether the icon is multicolor (true) or monochromatic (false)
 * @param {boolean} $forceSquare - whether to force square aspect ratio (true) or not (false)
 */
@mixin icon($multicolor: false, $forceSquare: false) {
  display: flex;
  align-items: center;
  justify-items: center;
  height: 1em;
  line-height: 1em;
  font-size: var(--o-icon-size, 1em);

  &::before {
    @include icon-element($multicolor, $forceSquare);
  }

  &--inline {
    display: inline-flex;
  }

  /* Force square aspect ratio */
  &--square {
    &::before {
      width: 1em !important;
      height: var(${cssVarNameIconHeight}, 1em);
    }
  }
}

/** Container for SVG icon - usually ::before pseudo element */
@mixin icon-element($multicolor: false, $forceSquare: false) {
  content: '';
  display: block;
  line-height: 1em;

  @if $forceSquare {
    width: 1em !important;
    height: var(${cssVarNameIconHeight}, 1em);
  } @else {
    height: 1em;
    width: 1em;
  }

  @if $multicolor {
    background-image: var(--o-icon-svg-url);
    background-repeat: no-repeat;
    background-size: cover;
    background-position: center;
  } @else {
    mask-image: var(--o-icon-svg-url);
    mask-repeat: no-repeat;
    mask-size: cover;
    mask-position: center;
    background-color: var(--o-icon-color, currentcolor);
  }
}

${scssIndividualIconsMixins}
  `.trim() + '\n';

    try {
      await fs.writeFile(iconsScssMixinsDestinationFile, scssMixinsFileContent, 'utf-8');
      printLog(`Generated SCSS mixins file: ${chalk.italic.underline(iconsScssMixinsDestinationFile)}`);
    } catch (error) {
      throw new Error(`Error generating ${iconsScssMixinsDestinationFile}: ${error.message}`);
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
  display: flex;
  align-items: center;
  justify-items: center;
  height: 1em;
  line-height: 1em;
  font-size: var(${cssVarNameIconSize}, 1em);

  &::before {
    content: '';
    display: block;
    line-height: 1em;
    height: 1em;
    width: 1em;
  }

  &[class*="${iconMonoIdPrefix}"]::before {
    mask-image: var(${cssVarNameIconUrl});
    mask-repeat: no-repeat;
    mask-size: cover;
    mask-position: center;
    background-color: var(${cssVarNameIconColor}, currentcolor);
  }

  &[class*="${iconColorIdPrefix}"]::before {
    background-image: var(${cssVarNameIconUrl});
    background-repeat: no-repeat;
    background-size: cover;
    background-position: center;
  }

  &--inline {
    display: inline-flex;
  }

  /* Force square aspect ratio */
  &--square {
    &::before {
      width: 1em !important;
      height: var(${cssVarNameIconHeight}, 1em);
    }
  }
}

${scssIndividualIconsClasses}
`.trim() + '\n';

    try {
      await fs.writeFile(iconsScssStyleDestinationFile, scssSettingsFileContent, 'utf-8');
      printLog(`Generated SCSS styles file: ${chalk.italic.underline(iconsScssStyleDestinationFile)}`);
    } catch (error) {
      throw new Error(`Error generating ${iconsScssStyleDestinationFile}: ${error.message}`);
    }
  }

  /**
   * @param {SvgItemData[]} svgIconsData
   */
  async function generateIconsJsonFile(svgIconsData) {
    try {
      const jsonContent = JSON.stringify(svgIconsData, null, 2).trim() + '\n';
      await fs.writeFile(iconsJsonDestinationFile, jsonContent, 'utf-8');
      printLog(`Generated JSON icons data file: ${chalk.italic.underline(iconsJsonDestinationFile)}`);
    } catch (error) {
      throw new Error(`Error generating ${iconsJsonDestinationFile}: ${error.message}`);
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
      font-size: var(${cssVarNameIconSize}, 1em);
    }

    .o-icon--color {
      background-repeat: no-repeat;
      background-size: contain;
    }

    .o-icon--mono {
      mask-repeat: no-repeat;
      mask-size: contain;
      background-color: var(${cssVarNameIconColor}, currentcolor);
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
 * @property {string} iconSourceFilePathRel - path to the source SVG file relative to the current script
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