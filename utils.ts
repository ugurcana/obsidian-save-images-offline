import { Notice, TFile, Vault } from 'obsidian';
import * as path from 'path';
import { createHash } from 'crypto';
import { log } from './logger';

// Regular expressions for finding image URLs in markdown
// Modified to support complex URLs like CDN/proxy URLs with image type in query parameters
export const IMAGE_URL_REGEX = /!\[(.*?)\]\((https?:\/\/[^\s\)]+)\)/g;
export const HTML_IMG_REGEX = /<img.*?src=["'](https?:\/\/[^\s"']+)["'].*?>/g;

// Helper function to check if a URL is likely an image URL
export function isLikelyImageUrl(url: string): boolean {
    // Log URL for debugging
    log.debug(`Checking if URL is likely an image: ${url}`);

    // Check for common image extensions in the URL or query parameters
    const imageExtPattern = /\.(png|jpg|jpeg|gif|webp|svg|awebp|bmp|tiff|avif)(\?|$|&|#)/i;

    // Check for type parameter in URL
    const typeParamPattern = /[?&]type=(png|jpg|jpeg|gif|webp|svg|awebp|bmp|tiff|avif)/i;

    // Check for format parameter in URL
    const formatParamPattern = /[?&]format=(png|jpg|jpeg|gif|webp|svg|awebp|bmp|tiff|avif)/i;

    // Check for format parameters in URL
    const formatInParamPattern = /[?&;](cf|fmt|format|type)=(webp|png|jpg|jpeg|gif|avif)/i;

    // Check for URLs with image-related paths
    const imagePathPattern = /\/(images?|photos?|pictures?|media|api\/res|creatr-uploaded-images)\/[\w\-\.]+/i;

    // Check for URLs with date patterns often used in image paths
    const datePathPattern = /\/(\d{4}(\/|-)\d{1,2}(\/|-)\d{1,2}|\d{6,14})\//i;

    // Check if the URL contains nested URLs (common in proxy/CDN services)
    // More comprehensive check for nested URLs
    const hasNestedUrl = url.includes('http') &&
                        (/[?&](url|src|image)=https?%3A/i.test(url) ||
                         url.includes('/https://') ||
                         url.includes('/http://') ||
                         // Pattern for URLs with encoded URLs or complex structures
                         /https?:\/\/[^/]+\/[^/]+\/[^/]+\/[^/]+\/--.+\/https?:\/\//i.test(url) ||
                         // Pattern for URLs with base64 or other encoded content
                         /[?&](token|id|data)=[A-Za-z0-9+/=_-]{20,}/i.test(url));

    // Check for URLs that contain image-related query parameters with extensions
    const nestedImagePattern = /\.(png|jpg|jpeg|gif|webp|svg|awebp|bmp|tiff|avif)/i;

    // Check for common image hosting patterns
    const imageHostingPattern = /\/(api\/res|images?|photos?|pictures?|media|uploads?|content|assets|files?|static)\/[\w\-\.]+/i.test(url);

    // Check for URLs with resource identifiers (common in CDNs and image services)
    const resourceIdPattern = /\/(res|cdn|img|image|photo|media)\/[\d\.]+\//i.test(url);

    // Check for URLs with image IDs (common pattern in many image services)
    const imageIdPattern = /[\w\-]{8,}\-[\w\-]{8,}/i;

    const result = imageExtPattern.test(url) ||
           typeParamPattern.test(url) ||
           formatParamPattern.test(url) ||
           formatInParamPattern.test(url) ||
           imageHostingPattern ||
           resourceIdPattern ||
           (hasNestedUrl && nestedImagePattern.test(url)) ||
           // Check for URLs with image-related paths and numeric IDs (common in image servers)
           (imagePathPattern.test(url) && (/\/\d+(\/$|$)/.test(url) || imageIdPattern.test(url))) ||
           // Check for URLs with date patterns (common in news/blog image URLs)
           (datePathPattern.test(url) && /\.(\w{3,4})$/.test(url));

    log.debug(`URL ${url} is ${result ? 'likely' : 'not likely'} an image`);
    return result;
}

/**
 * Downloads an image from a URL
 * @param url The URL of the image to download
 * @param timeout Timeout in milliseconds
 * @param retries Number of retries if download fails
 * @returns ArrayBuffer of the downloaded image or null if download failed
 */
export async function downloadImage(
    url: string,
    timeout: number = 30000,
    retries: number = 3
): Promise<ArrayBuffer | null> {
    let attempts = 0;

    log.debug(`Attempting to download image from URL: ${url}`);

    while (attempts < retries) {
        try {
            log.debug(`Download attempt ${attempts + 1} for URL: ${url}`);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                log.warn(`Download timeout for URL: ${url}`);
                controller.abort();
            }, timeout);

            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                    'Referer': new URL(url).origin
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            log.info(`Successfully downloaded image from URL: ${url}`);
            return await response.arrayBuffer();
        } catch (error) {
            attempts++;
            log.warn(`Attempt ${attempts} failed for URL: ${url}. Error: ${error.message}`);
            if (attempts >= retries) {
                log.error(`Failed to download image from ${url} after ${retries} attempts: ${error.message}`);
                return null;
            }
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    return null;
}

/**
 * Converts an ArrayBuffer to a base64 string
 * @param buffer The ArrayBuffer to convert
 * @returns Base64 string
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;

    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }

    return window.btoa(binary);
}

/**
 * Converts a PNG image to JPEG
 * @param buffer The PNG image as an ArrayBuffer
 * @param quality JPEG quality (1-100)
 * @returns Promise resolving to the JPEG image as an ArrayBuffer
 */
export async function convertPngToJpeg(
    buffer: ArrayBuffer,
    quality: number = 85
): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const blob = new Blob([buffer], { type: 'image/png' });
        const url = URL.createObjectURL(blob);

        img.onload = () => {
            URL.revokeObjectURL(url);

            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            // Draw image on canvas with white background (for transparent PNGs)
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);

            // Convert to JPEG
            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        reject(new Error('Failed to convert PNG to JPEG'));
                        return;
                    }

                    // Convert blob to ArrayBuffer
                    const reader = new FileReader();
                    reader.onload = () => {
                        if (reader.result instanceof ArrayBuffer) {
                            resolve(reader.result);
                        } else {
                            reject(new Error('Failed to read converted JPEG'));
                        }
                    };
                    reader.onerror = () => reject(reader.error);
                    reader.readAsArrayBuffer(blob);
                },
                'image/jpeg',
                quality / 100
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load PNG image for conversion'));
        };

        img.src = url;
    });
}

/**
 * Calculates MD5 hash of a buffer
 * @param buffer The buffer to hash
 * @returns MD5 hash as a hex string
 */
export function calculateMD5(buffer: ArrayBuffer): string {
    return createHash('md5').update(Buffer.from(buffer)).digest('hex');
}

/**
 * Sanitizes a filename by removing invalid characters
 * @param filename The filename to sanitize
 * @returns Sanitized filename
 */
export function sanitizeFilename(filename: string): string {
    return filename.replace(/[\\/:*?"<>|]/g, '_');
}

/**
 * Gets the file extension from a URL
 * @param url The URL to extract extension from
 * @returns The file extension (without the dot)
 */
export function getFileExtension(url: string): string {
    log.debug(`Getting file extension for URL: ${url}`);

    // Try to extract extension from the URL path
    let extension = '';

    // First, try to extract from the last segment of the path
    const pathMatch = url.match(/\/([^\/?#]+)[^\/?#]*$/);
    if (pathMatch) {
        const lastSegment = pathMatch[1];
        const extMatch = lastSegment.match(/\.([a-zA-Z0-9]+)$/i);
        if (extMatch) {
            extension = extMatch[1].toLowerCase();
            log.debug(`Extracted extension ${extension} from path: ${lastSegment}`);
        }
    }

    // If no extension found in path, try to extract from query parameters
    if (!extension) {
        // Check for type parameter
        const typeMatch = url.match(/[?&]type=([a-zA-Z0-9]+)/i);
        if (typeMatch) {
            extension = typeMatch[1].toLowerCase();
            log.debug(`Extracted extension ${extension} from type parameter`);
        }

        // Check for format parameter
        if (!extension) {
            const formatMatch = url.match(/[?&]format=([a-zA-Z0-9]+)/i);
            if (formatMatch) {
                extension = formatMatch[1].toLowerCase();
                log.debug(`Extracted extension ${extension} from format parameter`);
            }
        }
    }

    // If still no extension found, try to extract from the URL path with query parameters
    if (!extension) {
        const fullUrlMatch = url.match(/\.([a-zA-Z0-9]+)(?:[\?#].*)?$/i);
        if (fullUrlMatch) {
            extension = fullUrlMatch[1].toLowerCase();
            log.debug(`Extracted extension ${extension} from full URL`);
        }
    }

    // If still no extension found, try to extract from nested URLs
    if (!extension) {
        // Look for encoded URLs in parameters - handle multiple encoding patterns
        const nestedUrlPatterns = [
            /[?&](url|src|image)=(https?%3A[^&]+)/i,  // Standard URL encoding
            /[?&](url|src|image)=([^&]+)/i,          // Any parameter that might contain a URL
            /\/(https?%3A%2F%2F[^&\/?#]+)/i,         // Path-based encoded URL
            /\/(https?:\/\/[^&\/?#]+)/i             // Path-based raw URL
        ];

        for (const pattern of nestedUrlPatterns) {
            const nestedUrlMatch = url.match(pattern);
            if (nestedUrlMatch) {
                try {
                    let decodedUrl = nestedUrlMatch[2] || nestedUrlMatch[1];
                    // Try to decode the URL if it appears to be encoded
                    if (decodedUrl.includes('%')) {
                        try {
                            decodedUrl = decodeURIComponent(decodedUrl);
                        } catch (e) {
                            // If decoding fails, use the original string
                            log.warn(`Failed to decode URL: ${decodedUrl}, using as is`);
                        }
                    }

                    log.debug(`Found nested URL: ${decodedUrl}`);

                    // Try to extract extension from the decoded URL
                    const nestedExtMatch = decodedUrl.match(/\.([a-zA-Z0-9]+)(?:[\?#].*)?$/i);
                    if (nestedExtMatch) {
                        extension = nestedExtMatch[1].toLowerCase();
                        log.debug(`Extracted extension ${extension} from nested URL`);
                        break; // Exit the loop once we find an extension
                    }

                    // Try to find extension in query parameters of the nested URL
                    if (decodedUrl.includes('?')) {
                        const nestedQueryMatch = decodedUrl.match(/[?&](type|format)=([a-zA-Z0-9]+)/i);
                        if (nestedQueryMatch) {
                            extension = nestedQueryMatch[2].toLowerCase();
                            log.debug(`Extracted extension ${extension} from nested URL query parameter`);
                            break;
                        }
                    }
                } catch (error) {
                    console.error(`Error processing nested URL: ${error}`);
                }
            }
        }
    }

    // Check for format parameters in URL
    if (!extension) {
        const formatMatch = /[?&;](cf|fmt|format|type)=(webp|png|jpg|jpeg|gif|avif)/i.exec(url);
        if (formatMatch && formatMatch[2]) {
            extension = formatMatch[2].toLowerCase();
            log.debug(`Detected format parameter ${formatMatch[1]}=${formatMatch[2]}, using ${extension} extension`);
        }
    }

    // Try to extract from URL path components for complex URLs
    if (!extension) {
        // Look for image extensions in any part of the URL path
        const complexUrlMatch = url.match(/\/(\w+\.(png|jpg|jpeg|gif|webp|svg|awebp|bmp|tiff|avif))[\/\?#&]/i);
        if (complexUrlMatch && complexUrlMatch[2]) {
            extension = complexUrlMatch[2].toLowerCase();
            log.debug(`Extracted extension ${extension} from complex URL path component`);
        }
    }

    // If no extension could be determined, use a default
    if (!extension) {
        log.debug(`No extension found in URL: ${url}, defaulting to jpg`);
        extension = 'jpg';
    }

    // Handle special cases for certain extensions
    if (extension === 'awebp') {
        log.debug(`Converting awebp extension to jpg for better compatibility`);
        extension = 'jpg';
    } else if (extension === 'webp') {
        log.debug(`Converting webp extension to jpg for better compatibility`);
        extension = 'jpg';
    }

    return extension;
}

/**
 * Ensures a folder exists in the vault
 * @param vault The Obsidian vault
 * @param folderPath The folder path to ensure
 */
export async function ensureFolderExists(vault: Vault, folderPath: string): Promise<void> {
    const folders = folderPath.split('/').filter(p => p.length > 0);
    let currentPath = '';

    for (const folder of folders) {
        currentPath = currentPath ? `${currentPath}/${folder}` : folder;
        if (!(await vault.adapter.exists(currentPath))) {
            await vault.createFolder(currentPath);
        }
    }
}

/**
 * Shows a notification
 * @param message The message to show
 * @param duration Duration in milliseconds
 */
export function showNotice(message: string, duration: number = 3000): void {
    new Notice(message, duration);
}

/**
 * Checks if a URL is from an ignored domain
 * @param url The URL to check
 * @param ignoredDomains Comma-separated list of domains to ignore
 * @returns True if the URL is from an ignored domain
 */
export function isIgnoredDomain(url: string, ignoredDomains: string): boolean {
    if (!ignoredDomains) return false;

    try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname;
        const ignoredList = ignoredDomains.split(',').map(d => d.trim().toLowerCase());

        return ignoredList.some(ignoredDomain =>
            domain === ignoredDomain || domain.endsWith(`.${ignoredDomain}`)
        );
    } catch (error) {
        console.error('Error parsing URL:', error);
        return false;
    }
}
