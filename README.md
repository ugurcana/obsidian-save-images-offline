# Save Images Offline

This plugin for [Obsidian](https://obsidian.md) automatically downloads online images in your notes and saves them locally for offline viewing. Never worry about broken image links or internet connectivity issues again!

## Demo

![Demo](https://raw.githubusercontent.com/nykkolin/obsidian-save-images-offline/main/screenshots/demo.gif)

## Features

- **Automatic Image Download**: Automatically detects and downloads images from online URLs in your notes
- **Paste Support**: Downloads images when you paste content with image URLs
- **Format Conversion**: Option to convert PNG images to JPEG to save space
- **Customizable Storage**: Configure where and how images are stored
- **Duplicate Prevention**: Uses MD5 hashing to prevent duplicate images
- **Manual Processing**: Commands to manually process individual files or the entire vault

## How It Works

When enabled, the plugin:

1. Scans your notes for image URLs (both Markdown and HTML formats)
2. Downloads the images from those URLs
3. Saves them to a subfolder within the note's folder
4. Updates the links in your notes to point to the local files

This ensures that your notes with images will work even when you're offline.

## Screenshots

![Plugin Settings](https://raw.githubusercontent.com/nykkolin/obsidian-save-images-offline/main/screenshots/settings.png)

*Plugin settings panel with various configuration options*


## Settings

### General Settings

- **Auto-download images**: Automatically download images when a note is opened or modified
- **Download on paste**: Automatically download images when pasting content with image URLs

### Image Storage Settings

- **Image folder**: Folder path where images will be saved (subfolder name within note folder)
- **Use MD5 for filenames**: Use MD5 hash of image content as filename (prevents duplicates)

### Image Processing Settings

- **Convert PNG to JPEG**: Convert PNG images to JPEG to save space
- **JPEG Quality**: Quality of JPEG images when converting from PNG (1-100)

### Advanced Settings

- **Max download retries**: Maximum number of retries when downloading an image fails
- **Download timeout**: Timeout for image downloads in milliseconds
- **Ignored domains**: Comma-separated list of domains to ignore when downloading images

## Commands

- **Save images offline for current file**: Process the currently active file
- **Save images offline for all files**: Process all markdown files in the vault


## Installation

### From Obsidian Community Plugins

1. Open Obsidian Settings
2. Go to Community Plugins
3. Search for "Save Images Offline"
4. Click Install, then Enable



---

<div align="center">
  <p>If you find this plugin useful, consider supporting me:</p>
  <a href="https://www.buymeacoffee.com/xmasterdev" target="_blank">
    <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;">
  </a>
  <p>or</p>
  <a href="https://ko-fi.com/nykkolin" target="_blank">
    <img src="https://img.shields.io/badge/Support%20me%20on-Ko--fi-blue?style=for-the-badge&logo=ko-fi" alt="Support me on Ko-fi">
  </a>
</div>
