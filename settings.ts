import { App, PluginSettingTab, Setting } from 'obsidian';
import SaveImagesOfflinePlugin from './main';
import { LogLevel } from './logger';

export interface SaveImagesOfflineSettings {
    // General settings
    autoDownloadImages: boolean;
    downloadOnPaste: boolean;

    // Image storage settings
    imageFolder: string;
    useMD5ForFilenames: boolean;

    // Image processing settings
    convertPngToJpeg: boolean;
    jpegQuality: number;

    // Advanced settings
    maxDownloadRetries: number;
    downloadTimeout: number;
    ignoredDomains: string;
    logLevel: LogLevel;
}

export const DEFAULT_SETTINGS: SaveImagesOfflineSettings = {
    autoDownloadImages: true,
    downloadOnPaste: true,

    imageFolder: 'attachments',
    useMD5ForFilenames: true,

    convertPngToJpeg: false,
    jpegQuality: 85,

    maxDownloadRetries: 3,
    downloadTimeout: 30000,
    ignoredDomains: '',
    logLevel: LogLevel.ERROR
};

export class SaveImagesOfflineSettingTab extends PluginSettingTab {
    plugin: SaveImagesOfflinePlugin;

    constructor(app: App, plugin: SaveImagesOfflinePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Save Images Offline Settings' });

        // General Settings
        containerEl.createEl('h3', { text: 'General Settings' });

        new Setting(containerEl)
            .setName('Auto-download images')
            .setDesc('Automatically download images when a note is opened or modified')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoDownloadImages)
                .onChange(async (value) => {
                    this.plugin.settings.autoDownloadImages = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Download on paste')
            .setDesc('Automatically download images when pasting content with image URLs')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.downloadOnPaste)
                .onChange(async (value) => {
                    this.plugin.settings.downloadOnPaste = value;
                    await this.plugin.saveSettings();
                }));

        // Image Storage Settings
        containerEl.createEl('h3', { text: 'Image Storage Settings' });

        new Setting(containerEl)
            .setName('Image folder')
            .setDesc('Folder path where images will be saved (subfolder name within note folder)')
            .addText(text => text
                .setPlaceholder('attachments')
                .setValue(this.plugin.settings.imageFolder)
                .onChange(async (value) => {
                    this.plugin.settings.imageFolder = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Use MD5 for filenames')
            .setDesc('Use MD5 hash of image content as filename (prevents duplicates)')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.useMD5ForFilenames)
                .onChange(async (value) => {
                    this.plugin.settings.useMD5ForFilenames = value;
                    await this.plugin.saveSettings();
                }));

        // Image Processing Settings
        containerEl.createEl('h3', { text: 'Image Processing Settings' });

        new Setting(containerEl)
            .setName('Convert PNG to JPEG')
            .setDesc('Convert PNG images to JPEG to save space')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.convertPngToJpeg)
                .onChange(async (value) => {
                    this.plugin.settings.convertPngToJpeg = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('JPEG Quality')
            .setDesc('Quality of JPEG images when converting from PNG (1-100)')
            .addSlider(slider => slider
                .setLimits(1, 100, 1)
                .setValue(this.plugin.settings.jpegQuality)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.jpegQuality = value;
                    await this.plugin.saveSettings();
                }));

        // Advanced Settings
        containerEl.createEl('h3', { text: 'Advanced Settings' });

        new Setting(containerEl)
            .setName('Max download retries')
            .setDesc('Maximum number of retries when downloading an image fails')
            .addSlider(slider => slider
                .setLimits(1, 10, 1)
                .setValue(this.plugin.settings.maxDownloadRetries)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.maxDownloadRetries = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Download timeout (ms)')
            .setDesc('Timeout for image downloads in milliseconds')
            .addText(text => text
                .setValue(String(this.plugin.settings.downloadTimeout))
                .onChange(async (value) => {
                    const timeout = Number(value);
                    if (!isNaN(timeout) && timeout > 0) {
                        this.plugin.settings.downloadTimeout = timeout;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('Ignored domains')
            .setDesc('Comma-separated list of domains to ignore when downloading images')
            .addTextArea(text => text
                .setPlaceholder('example.com, another-domain.com')
                .setValue(this.plugin.settings.ignoredDomains)
                .onChange(async (value) => {
                    this.plugin.settings.ignoredDomains = value;
                    await this.plugin.saveSettings();
                }));

        // Sponsor section
        containerEl.createEl('hr');

        const sponsorDiv = containerEl.createDiv('sponsor-container');
        sponsorDiv.addClass('sponsor-container');
        sponsorDiv.style.display = 'flex';
        sponsorDiv.style.flexDirection = 'column';
        sponsorDiv.style.alignItems = 'center';
        sponsorDiv.style.marginTop = '1rem';

        const sponsorText = sponsorDiv.createDiv();
        sponsorText.setText('If you like this Plugin, consider donating to support continued development.');
        sponsorText.style.marginBottom = '1rem';
        sponsorText.style.textAlign = 'center';

        const buttonsDiv = sponsorDiv.createDiv();
        buttonsDiv.style.display = 'flex';
        buttonsDiv.style.gap = '1rem';
        buttonsDiv.style.justifyContent = 'center';
        buttonsDiv.style.flexWrap = 'wrap';
        buttonsDiv.style.alignItems = 'center';

        // Ko-fi button
        const kofiLink = buttonsDiv.createEl('a', {
            href: 'https://ko-fi.com/nykkolin'
        });
        kofiLink.setAttribute('target', '_blank');
        kofiLink.setAttribute('rel', 'noopener');

        // Use inline SVG instead of external image
        kofiLink.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="38" viewBox="0 0 82.25 28" role="img" aria-label="KO-FI" class="sponsor-image"><title>KO-FI</title><g shape-rendering="crispEdges"><rect width="82.25" height="28" fill="#f16061"/></g><g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="100"><image x="9" y="7" width="14" height="14" href="data:image/svg+xml;base64,PHN2ZyBmaWxsPSJ3aGl0ZSIgcm9sZT0iaW1nIiB2aWV3Qm94PSIwIDAgMjQgMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHRpdGxlPktvLWZpPC90aXRsZT48cGF0aCBkPSJNMTEuMzUxIDIuNzE1Yy0yLjcgMC00Ljk4Ni4wMjUtNi44My4yNkMyLjA3OCAzLjI4NSAwIDUuMTU0IDAgOC42MWMwIDMuNTA2LjE4MiA2LjEzIDEuNTg1IDguNDkzIDEuNTg0IDIuNzAxIDQuMjMzIDQuMTgyIDcuNjYyIDQuMTgyaC44M2M0LjIwOSAwIDYuNDk0LTIuMjM0IDcuNjM3LTRhOS41IDkuNSAwIDAgMCAxLjA5MS0yLjMzOEMyMS43OTIgMTQuNjg4IDI0IDEyLjIyIDI0IDkuMjA4di0uNDE1YzAtMy4yNDctMi4xMy01LjUwNy01Ljc5Mi01Ljg3LTEuNTU4LS4xNTYtMi42NS0uMjA4LTYuODU3LS4yMDhtMCAxLjk0N2M0LjIwOCAwIDUuMDkuMDUyIDYuNTcxLjE4MiAyLjYyNC4zMTEgNC4xMyAxLjU4NCA0LjEzIDR2LjM5YzAgMi4xNTYtMS43OTIgMy44NDQtMy44NyAzLjg0NGgtLjkzNWwtLjE1Ni42NDljLS4yMDggMS4wMTMtLjU5NyAxLjgxOC0xLjAzOSAyLjU0Ni0uOTA5IDEuNDI4LTIuNTQ1IDMuMDY0LTUuOTIyIDMuMDY0aC0uODA1Yy0yLjU3MSAwLTQuODMxLS44ODMtNi4wNzgtMy4xOTUtMS4wOS0yLTEuMjk4LTQuMTU1LTEuMjk4LTcuNTA2IDAtMi4xODEuODU3LTMuNDAyIDMuMDEyLTMuNzE0IDEuNTMzLS4yMzMgMy41NTktLjI2IDYuMzktLjI2bTYuNTQ3IDIuMjg3Yy0uNDE2IDAtLjY1LjIzNC0uNjUuNTQ2djIuOTM1YzAgLjMxMS4yMzQuNTQ1LjY1LjU0NSAxLjMyNCAwIDIuMDUxLS43NTQgMi4wNTEtMnMtLjcyNy0yLjAyNi0yLjA1Mi0yLjAyNm0tMTAuMzkuMTgyYy0xLjgxOCAwLTMuMDEzIDEuNDgtMy4wMTMgMy4xNDIgMCAxLjUzMy44NTggMi44NTcgMS45NDkgMy44OTcuNzI3LjcwMSAxLjg3IDEuNDI5IDIuNjQ5IDEuODk2YTEuNDcgMS40NyAwIDAgMCAxLjUwNyAwYy43OC0uNDY3IDEuOTIyLTEuMTk1IDIuNjIzLTEuODk2IDEuMTE3LTEuMDM5IDEuOTc0LTIuMzY0IDEuOTc0LTMuODk3IDAtMS42NjItMS4yNDctMy4xNDItMy4wMzktMy4xNDItMS4wNjUgMC0xLjc5Mi41NDUtMi4zMzggMS4yOTgtLjQ5My0uNzUzLTEuMjQ2LTEuMjk4LTIuMzEyLTEuMjk4Ii8+PC9zdmc+"/><text transform="scale(.1)" x="511.25" y="175" textLength="382.5" fill="#fff" font-weight="bold">KO-FI</text></g></svg>`;

        // Buy Me a Coffee button
        const bmcLink = buttonsDiv.createEl('a', {
            href: 'https://buymeacoffee.com/xmasterdev'
        });
        bmcLink.setAttribute('target', '_blank');
        bmcLink.setAttribute('rel', 'noopener');

        // Use inline SVG instead of external image
        bmcLink.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="38" viewBox="0 0 217 60" class="sponsor-image">
  <!-- Background -->
  <rect width="217" height="60" rx="12" fill="#FFDD00"/>
  <!-- Coffee cup emoji -->
  <text x="19" y="42" font-size="30">☕️</text>
  <!-- "Buy me a coffee" text -->
  <text x="59" y="39" font-family="'Brush Script MT', 'Comic Sans MS', cursive" font-size="28" font-weight="normal" fill="#000000" font-style="italic">Buy me a coffee</text>
</svg>`;

    }
}
