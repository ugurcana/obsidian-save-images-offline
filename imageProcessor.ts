import { TFile, Vault } from 'obsidian';
import * as path from 'path';
import {
    IMAGE_URL_REGEX,
    HTML_IMG_REGEX,
    downloadImage,
    calculateMD5,
    sanitizeFilename,
    getFileExtension,
    ensureFolderExists,
    convertPngToJpeg,
    isIgnoredDomain,
    isLikelyImageUrl
} from './utils';
import { SaveImagesOfflineSettings } from './settings';
import { log } from './logger';

/**
 * Processes a markdown file to find and download images
 * @param file The markdown file to process
 * @param vault The Obsidian vault
 * @param settings Plugin settings
 * @returns Object containing the updated content and stats about the processing
 */
export async function processMarkdownFile(
    file: TFile,
    vault: Vault,
    settings: SaveImagesOfflineSettings
): Promise<{
    content: string,
    stats: {
        total: number,
        downloaded: number,
        failed: number,
        skipped: number
    }
}> {
    // Read the file content
    const content = await vault.read(file);

    // Initialize stats
    const stats = {
        total: 0,
        downloaded: 0,
        failed: 0,
        skipped: 0
    };

    // Process the content
    const newContent = await processContent(content, file, vault, settings, stats);

    return { content: newContent, stats };
}

/**
 * Processes content to find and download images
 * @param content The markdown content to process
 * @param file The markdown file (for context)
 * @param vault The Obsidian vault
 * @param settings Plugin settings
 * @param stats Stats object to update
 * @returns The updated content with local image paths
 */
export async function processContent(
    content: string,
    file: TFile | null,
    vault: Vault,
    settings: SaveImagesOfflineSettings,
    stats: { total: number, downloaded: number, failed: number, skipped: number }
): Promise<string> {
    // Determine the base folder for saving images
    let basePath = '';
    if (file) {
        // Get the directory of the current file
        basePath = file.path.substring(0, file.path.lastIndexOf('/') + 1);

        // If imageFolder is specified, it's a subfolder within the note folder
        if (settings.imageFolder) {
            // Ensure we don't add trailing slash if imageFolder already has one
            const folderName = settings.imageFolder.endsWith('/') ?
                settings.imageFolder : settings.imageFolder;
            basePath += folderName;
        }
    } else {
        // Fallback to the global image folder setting if no file is provided
        basePath = settings.imageFolder;
    }

    // Ensure the image folder exists
    await ensureFolderExists(vault, basePath);

    // Process markdown image syntax
    let newContent = await replaceAsync(content, IMAGE_URL_REGEX, async (match, altText, imageUrl) => {
        // Check if this URL is likely an image URL
        if (!isLikelyImageUrl(imageUrl)) {
            log.debug(`Skipping URL that doesn't appear to be an image: ${imageUrl}`);
            return match; // Skip URLs that don't appear to be images
        }

        stats.total++;

        // Check if the URL is from an ignored domain
        if (isIgnoredDomain(imageUrl, settings.ignoredDomains)) {
            stats.skipped++;
            return match;
        }

        log.debug(`Processing image URL: ${imageUrl}`);
        const result = await downloadAndSaveImage(imageUrl, vault, settings, basePath);

        if (result.success && result.localPath) {
            stats.downloaded++;
            // Create the new markdown with the local image path
            // If the image is saved in the note's folder, use a relative path
            let imagePath = result.localPath;
            if (file && result.localPath.startsWith(file.path.substring(0, file.path.lastIndexOf('/') + 1))) {
                // Extract just the filename and subfolder if any
                const notePath = file.path.substring(0, file.path.lastIndexOf('/') + 1);
                imagePath = result.localPath.substring(notePath.length);

                // Ensure there are no double slashes in the path
                imagePath = imagePath.replace(/\/\//g, '/');
            }
            return `![${altText}](${imagePath})`;
        } else {
            stats.failed++;
            console.error(`Failed to download image: ${imageUrl}`, result.error);
            return match;
        }
    });

    // Process HTML image tags
    newContent = await replaceAsync(newContent, HTML_IMG_REGEX, async (match, imageUrl) => {
        // Check if this URL is likely an image URL
        if (!isLikelyImageUrl(imageUrl)) {
            log.debug(`Skipping HTML URL that doesn't appear to be an image: ${imageUrl}`);
            return match; // Skip URLs that don't appear to be images
        }

        stats.total++;

        // Check if the URL is from an ignored domain
        if (isIgnoredDomain(imageUrl, settings.ignoredDomains)) {
            stats.skipped++;
            return match;
        }

        log.debug(`Processing HTML image URL: ${imageUrl}`);
        const result = await downloadAndSaveImage(imageUrl, vault, settings, basePath);

        if (result.success && result.localPath) {
            stats.downloaded++;
            // Extract any attributes from the original tag
            const altMatch = match.match(/alt=["']([^"']*)["']/);
            const altText = altMatch ? altMatch[1] : '';

            // Create the new markdown with the local image path
            let imagePath = result.localPath.split('/').pop();
            
            return `![${altText}](${imagePath})`;
        } else {
            stats.failed++;
            console.error(`Failed to download image: ${imageUrl}`, result.error);
            return match;
        }
    });

    return newContent;
}

/**
 * Downloads and saves an image to the vault
 * @param imageUrl The URL of the image to download
 * @param vault The Obsidian vault
 * @param settings Plugin settings
 * @param basePath The base path where the image should be saved
 * @returns Object with success status, local path, and error if any
 */
async function downloadAndSaveImage(
    imageUrl: string,
    vault: Vault,
    settings: SaveImagesOfflineSettings,
    basePath: string
): Promise<{ success: boolean, localPath?: string, error?: Error }> {
    log.debug(`Starting download and save process for image URL: ${imageUrl}`);
    try {
        // Download the image
        const imageData = await downloadImage(
            imageUrl,
            settings.downloadTimeout,
            settings.maxDownloadRetries
        );

        if (!imageData) {
            return {
                success: false,
                error: new Error(`Failed to download image from ${imageUrl}`)
            };
        }

        // Determine file extension and prepare the image data
        let finalImageData = imageData;
        let fileExtension = getFileExtension(imageUrl);

        // Always try to detect the file type from the binary data for verification
        const header = new Uint8Array(imageData.slice(0, 12));
        let detectedExtension = '';

        // Check for common image signatures
        if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
            detectedExtension = 'png';
            log.debug(`Detected PNG signature in binary data`);
        } else if (header[0] === 0xFF && header[1] === 0xD8) {
            detectedExtension = 'jpg';
            log.debug(`Detected JPEG signature in binary data`);
        } else if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46) {
            detectedExtension = 'gif';
            log.debug(`Detected GIF signature in binary data`);
        } else if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46) {
            // WEBP files start with RIFF and have WEBP at offset 8
            if (header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50) {
                detectedExtension = 'jpg'; // Convert webp to jpg for better compatibility
                log.debug(`Detected WEBP signature in binary data, using jpg for compatibility`);
            } else {
                detectedExtension = 'jpg'; // Default for RIFF but not WEBP
                log.debug(`Detected RIFF signature but not WEBP in binary data, using jpg`);
            }
        } else if (header[0] === 0x42 && header[1] === 0x4D) {
            detectedExtension = 'bmp';
            log.debug(`Detected BMP signature in binary data`);
        }

        // If we detected a different extension than what we parsed from the URL
        if (detectedExtension && detectedExtension !== fileExtension) {
            log.debug(`Extension mismatch: URL suggests ${fileExtension} but binary data indicates ${detectedExtension}`);
            // Use the detected extension as it's more reliable
            fileExtension = detectedExtension;
        }

        // Ensure we have a valid file extension
        if (!fileExtension) {
            // Default to jpg if we can't detect the type
            fileExtension = 'jpg';
            log.debug(`Could not detect file type for ${imageUrl}, defaulting to jpg`);
        }

        // Special handling for awebp extension
        if (fileExtension === 'awebp') {
            log.debug(`Converting awebp extension to jpg for better compatibility`);
            fileExtension = 'jpg';
        }

        // Convert PNG to JPEG if enabled
        if (settings.convertPngToJpeg && fileExtension.toLowerCase() === 'png') {
            try {
                finalImageData = await convertPngToJpeg(imageData, settings.jpegQuality);
                fileExtension = 'jpg';
            } catch (error) {
                console.error('Error converting PNG to JPEG:', error);
                // Continue with the original PNG if conversion fails
            }
        }

        // Generate filename
        let filename: string;
        if (settings.useMD5ForFilenames) {
            // Use MD5 hash of the image content as filename
            const hash = calculateMD5(finalImageData);

            // Try to extract a meaningful name from the URL
            let meaningfulName = '';
            try {
                const urlObj = new URL(imageUrl);
                const urlPath = urlObj.pathname;

                // Try to find a meaningful segment in the path
                const pathSegments = urlPath.split('/').filter(segment => segment.length > 0);
                if (pathSegments.length > 0) {
                    // Use the last segment that's not just a hash or ID
                    for (let i = pathSegments.length - 1; i >= 0; i--) {
                        const segment = pathSegments[i];
                        // Skip segments that look like hashes or IDs
                        if (!/^[0-9a-f]{8,}$/i.test(segment) && !/^\d+$/.test(segment)) {
                            // Remove extension if present
                            meaningfulName = segment.replace(/\.[^.]+$/, '');
                            break;
                        }
                    }
                }

                // If we couldn't find a meaningful name, try to use the hostname
                if (!meaningfulName) {
                    const hostname = urlObj.hostname.replace(/\./g, '-');
                    meaningfulName = hostname;
                }
            } catch (error) {
                console.error('Error extracting meaningful name from URL:', error);
            }

            // Combine meaningful name with hash for uniqueness
            if (meaningfulName) {
                meaningfulName = sanitizeFilename(meaningfulName);
                // Limit the length of the meaningful name
                if (meaningfulName.length > 30) {
                    meaningfulName = meaningfulName.substring(0, 30);
                }
                filename = `${meaningfulName}-${hash.substring(0, 8)}.${fileExtension}`;
            } else {
                filename = `${hash}.${fileExtension}`;
            }
        } else {
            // Use the original filename from the URL
            const urlObj = new URL(imageUrl);
            const urlPath = urlObj.pathname;
            const originalFilename = path.basename(urlPath);
            filename = sanitizeFilename(originalFilename);

            // Add extension if missing
            if (!filename.includes('.')) {
                filename = `${filename}.${fileExtension}`;
            }
        }

        // Final check to ensure filename has an extension
        if (!filename.includes('.')) {
            filename = `${filename}.${fileExtension}`;
            log.debug(`Added missing extension to filename: ${filename}`);
        }

        // Full path in the vault
        // Ensure we don't have double slashes in the path
        const localPath = basePath.endsWith('/') ?
            `${basePath}${filename}` :
            `${basePath}/${filename}`;

        // Check if file already exists
        if (await vault.adapter.exists(localPath)) {
            // File already exists, no need to save again
            return { success: true, localPath };
        }

        // Save the image to the vault
        await vault.createBinary(localPath, finalImageData);

        return { success: true, localPath };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error : new Error(String(error))
        };
    }
}

/**
 * Helper function to replace async in a string
 * @param str The string to process
 * @param regex The regex to match
 * @param asyncFn The async function to call for each match
 * @returns The processed string
 */
async function replaceAsync(
    str: string,
    regex: RegExp,
    asyncFn: (...args: string[]) => Promise<string>
): Promise<string> {
    const promises: Promise<string>[] = [];
    str.replace(regex, (match, ...args) => {
        const promise = asyncFn(match, ...args);
        promises.push(promise);
        return match;
    });
    const data = await Promise.all(promises);
    return str.replace(regex, () => data.shift() || '');
}
