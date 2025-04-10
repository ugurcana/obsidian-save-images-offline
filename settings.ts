import { App, PluginSettingTab, Setting } from 'obsidian';
import SaveImagesOfflinePlugin from './main';

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
    ignoredDomains: ''
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
            .setDesc('Folder path where images will be saved (relative to vault root)')
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
    }
}
