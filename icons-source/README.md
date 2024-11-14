# `icons-source` Directory

## Overview

This directory, `icons-source`, serves as the repository for all SVG icons that will be used to generate a bundled SVG icon set.

Icons placed directly in this directory should be a monochromatic SVG file.

For icons that require color variants, a color subdirectory is used:
`icons-source/color/`

```
icons-source/
├── color/
│   ├── chisel_icon.svg
│   └── chisel_logo.svg
├── chisel_icon.svg
├── x_icon.svg
└── ...
```

## Purpose

The purpose of this directory is to store individual SVG icon files, which are used to generate a bundled SVG icon set.

## Guidelines for Adding Icons

The file should contain the icon's SVG code, using the standard SVG format.

To add a new icon to the project:

1. Create or obtain the SVG file for your icon.
2. Optimize the SVG if necessary.
3. Place the SVG file directly in the directory:
   - `icons-source/` for monochromatic icons
   - `icons-source/color/` for color icons
4. The icon will be automatically included in the next build process that generates the icon bundle.

## Notes

- All icons should be in SVG format.
- Use clear, descriptive names for your icon files (e.g., user_icon.svg, settings_gear.svg).
- This directory is monitored for changes, and updates to the bundled SVG icon set will be generated automatically.
