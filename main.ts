import {
    Plugin,
    TFile,
    MarkdownView,
    Editor,
    Notice,
    TAbstractFile
} from 'obsidian';
import {
    SaveImagesOfflineSettings,
    DEFAULT_SETTINGS,
    SaveImagesOfflineSettingTab
} from './settings';
import {
    processMarkdownFile,
    processContent
} from './imageProcessor';
import {
    showNotice,
    IMAGE_URL_REGEX,
    HTML_IMG_REGEX,
    isLikelyImageUrl
} from './utils';
import { log } from './logger';

export default class SaveImagesOfflinePlugin extends Plugin {
    settings: SaveImagesOfflineSettings;
    // Store event references to properly detach them when needed
    private fileModifyHandler: (file: TAbstractFile) => void;
    private fileCreateHandler: (file: TAbstractFile) => void;
    private pasteHandler: (evt: ClipboardEvent, editor: Editor, view: MarkdownView) => Promise<void>;

    async onload() {
        await this.loadSettings();

        // Add settings tab
        this.addSettingTab(new SaveImagesOfflineSettingTab(this.app, this));

        // Add command to manually process the current file
        this.addCommand({
            id: 'save-images-offline-current-file',
            name: 'Save images offline for current file',
            checkCallback: (checking: boolean) => {
                const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (activeView) {
                    if (!checking) {
                        this.processActiveFile();
                    }
                    return true;
                }
                return false;
            }
        });

        // Add command to process all files in the vault
        this.addCommand({
            id: 'save-images-offline-all-files',
            name: 'Save images offline for all files',
            callback: () => {
                this.processAllFiles();
            }
        });

        // Initialize event handlers
        this.fileModifyHandler = (file: TAbstractFile) => {
            if (file instanceof TFile && file.extension === 'md') {
                this.processFile(file, false);
            }
        };

        this.fileCreateHandler = (file: TAbstractFile) => {
            if (file instanceof TFile && file.extension === 'md') {
                this.processFile(file, false);
            }
        };

        // Initialize paste handler
        this.pasteHandler = this.handlePaste.bind(this);

        // Setup features based on current settings
        this.updateAutoDownloadFeature();
        this.updatePasteFeature();

        // Register for layout-ready event to process the active file when the plugin loads
        this.app.workspace.onLayoutReady(() => {
            const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (activeView && this.settings.autoDownloadImages) {
                if (activeView.file) {
                    this.processFile(activeView.file, false);
                }
            }
        });

        log.info('Plugin loaded');
    }

    onunload() {
        // Clean up all event listeners
        log.info('Plugin unloaded');
    }

    /**
     * Update auto-download feature based on current settings
     */
    updateAutoDownloadFeature() {
        // Unregister existing event handlers to prevent duplicates
        this.app.vault.off('modify', this.fileModifyHandler);
        this.app.vault.off('create', this.fileCreateHandler);

        // Only register events if auto-download is enabled
        if (this.settings.autoDownloadImages) {
            log.info('Enabling auto-download feature');
            this.registerEvent(
                this.app.vault.on('modify', this.fileModifyHandler)
            );

            this.registerEvent(
                this.app.vault.on('create', this.fileCreateHandler)
            );
        } else {
            log.info('Disabling auto-download feature');
        }
    }

    /**
     * Update paste feature based on current settings
     */
    updatePasteFeature() {
        // Remove existing paste handler
        this.app.workspace.off('editor-paste', this.pasteHandler);

        // Only register paste event if download-on-paste is enabled
        if (this.settings.downloadOnPaste) {
            log.info('Enabling download-on-paste feature');
            this.registerEvent(
                this.app.workspace.on('editor-paste', this.pasteHandler)
            );
        } else {
            log.info('Disabling download-on-paste feature');
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        log.setLogLevel(this.settings.logLevel);
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    /**
     * Processes the currently active file
     */
    async processActiveFile() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            showNotice('No active markdown file');
            return;
        }

        if (activeView.file) {
            await this.processFile(activeView.file, true);
        } else {
            showNotice('No file is currently open');
        }
    }

    /**
     * Processes all markdown files in the vault
     */
    async processAllFiles() {
        const notice = new Notice('Processing all files...', 0);

        const files = this.app.vault.getMarkdownFiles();
        let processed = 0;
        let totalDownloaded = 0;
        let totalFailed = 0;

        for (const file of files) {
            const result = await this.processFile(file, false);
            processed++;

            if (result) {
                totalDownloaded += result.downloaded;
                totalFailed += result.failed;
            }

            // Update the notice every 10 files
            if (processed % 10 === 0) {
                notice.setMessage(`Processing files: ${processed}/${files.length}`);
            }
        }

        notice.hide();
        showNotice(`Processed ${processed} files. Downloaded ${totalDownloaded} images. Failed: ${totalFailed}`);
    }

    /**
     * Processes a single markdown file
     * @param file The file to process
     * @param showNotification Whether to show a notification when done
     * @returns Stats about the processing
     */
    async processFile(
        file: TFile,
        showNotification: boolean = true
    ): Promise<{ downloaded: number, failed: number } | null> {
        if (!(file instanceof TFile) || file.extension !== 'md') {
            return null;
        }

        try {
            const { content, stats } = await processMarkdownFile(
                file,
                this.app.vault,
                this.settings
            );

            // Only update the file if changes were made
            if (stats.downloaded > 0) {
                await this.app.vault.modify(file, content);

                if (showNotification) {
                    showNotice(
                        `Downloaded ${stats.downloaded} images. ` +
                        `Failed: ${stats.failed}. ` +
                        `Skipped: ${stats.skipped}.`
                    );
                }
            } else if (showNotification && (stats.total > 0)) {
                showNotice(
                    `No new images downloaded. ` +
                    `Failed: ${stats.failed}. ` +
                    `Skipped: ${stats.skipped}.`
                );
            }

            return {
                downloaded: stats.downloaded,
                failed: stats.failed
            };
        } catch (error) {
            log.error(`Error processing file ${file.path}: ${error.message}`);

            if (showNotification) {
                showNotice(`Error processing file: ${error.message}`);
            }

            return null;
        }
    }

    /**
     * Handles paste events to process pasted content with images
     * @param evt The clipboard event
     * @param editor The editor instance
     * @param view The markdown view
     */
    async handlePaste(
        evt: ClipboardEvent,
        editor: Editor,
        view: MarkdownView
    ) {
        // Skip if the paste event has files (handled by Obsidian) or if clipboardData is null
        if (!evt.clipboardData) {
            return;
        }

        if (evt.clipboardData.files.length > 0) {
            return;
        }

        // Get the pasted text
        const pastedText = evt.clipboardData.getData('text');

        // Check if the pasted text contains image URLs
        const hasImageUrls = IMAGE_URL_REGEX.test(pastedText) || HTML_IMG_REGEX.test(pastedText);

        // Check if the pasted text is a direct image URL
        const isDirectImageUrl = pastedText.trim().startsWith('http') && isLikelyImageUrl(pastedText.trim());

        if (hasImageUrls || isDirectImageUrl) {
            // Prevent default paste behavior
            evt.preventDefault();

            // Initialize stats
            const stats = {
                total: 0,
                downloaded: 0,
                failed: 0,
                skipped: 0
            };

            // Process the pasted content
            let processedText;

            if (isDirectImageUrl && !hasImageUrls) {
                // If it's a direct image URL, wrap it in markdown image syntax
                const wrappedText = `![image](${pastedText.trim()})`;
                processedText = await processContent(
                    wrappedText,
                    view.file || null,
                    this.app.vault,
                    this.settings,
                    stats
                );
            } else {
                processedText = await processContent(
                    pastedText,
                    view.file || null,
                    this.app.vault,
                    this.settings,
                    stats
                );
            }

            // Insert the processed text
            editor.replaceSelection(processedText);

            // Show notification if images were processed
            if (stats.total > 0) {
                showNotice(
                    `Downloaded ${stats.downloaded} images. ` +
                    `Failed: ${stats.failed}. ` +
                    `Skipped: ${stats.skipped}.`
                );
            }
        }
    }
}
