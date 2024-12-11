# Generate Icons bundle SVG file - SCSS only approach

This project generates a bundled SVG icon set from individual SVG icon files and allow to use them in your projects with just a CSS classes (similar to the icon fonts).

## Overview

The `generate-icons.mjs` script can be used to generate the bundled SVG file, JSON data file, SCSS styles file and HTML preview page in any project, but the paths configuration needs to be adjusted to the needs of the project.

## How to use this repository

- You need to have Node.js installed on your machine.
- Clone the repository to your local machine.
- Run the `npm i` in the root directory.
- Run the `npm run start` in the root directory.

The script will generate all the files in the `dist/` directory, and the Demo page will be available at `http://localhost:8080`.

## How to use in your project

1. Copy the `generate-icons.mjs` script to your project directory.
2. Copy the `icons-source/` directory to your project directory.
3. Adjust the paths configuration in the `generate-icons.mjs` script to the needs of your project.
4. Run the `generate-icons.mjs` script with `node generate-icons.mjs` command.
5. The files will be created in the directory specified in the configuration.

## Icons usage in your project

The bundled SVG icon set is available in the directory configured in the `generate-icons.mjs` script.

When everything is set and the files are created, you can use the bundled SVG icon set in your project like this:

- In HTML
```html
 <!-- In format -->
 <i class="o-icon o-icon--${iconId}"></i>

 <!-- Example: -->
 <i class="o-icon o-icon--icon-close-line"></i>
```

- In SCSS
```scss
.my-class-icon {
  @include icon();
  color: red;
}

.my-class-icon::before {
  @include icon-close-line();
}
```
