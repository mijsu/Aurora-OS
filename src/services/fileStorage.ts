import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

/**
 * FileStorage Service
 * 
 * Handles native file storage using Capacitor Filesystem API.
 * Eliminates Base64 encoding for large files (100MB+) to prevent memory crashes.
 * 
 * Strategy:
 * - Files < 5MB: Store as Base64 in VFS (backwards compatible)
 * - Files >= 5MB: Store in native filesystem, keep URI in VFS
 */

export interface SaveFileResult {
    uri: string;
    size: number;
    mimeType: string;
}

const FILE_SIZE_THRESHOLD = 1 * 1024 * 1024; // 1MB threshold for native storage

export class FileStorage {
    private static instance: FileStorage;

    private constructor() { }

    static getInstance(): FileStorage {
        if (!FileStorage.instance) {
            FileStorage.instance = new FileStorage();
        }
        return FileStorage.instance;
    }

    /**
     * Check if running in Capacitor (native platform)
     */
    isSupportedCapacitor(): boolean {
        return Capacitor.isNativePlatform();
    }

    /**
     * Determine file category based on MIME type
     */
    private getCategory(mimeType: string): string {
        if (mimeType.startsWith('video/')) return 'videos';
        if (mimeType.startsWith('audio/')) return 'audio';
        if (mimeType.startsWith('image/')) return 'images';
        return 'documents';
    }

    /**
     * Generate unique filename
     */
    private generateFilename(originalName: string): string {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const ext = originalName.split('.').pop() || 'bin';
        return `${timestamp}_${random}.${ext}`;
    }

    /**
     * Save a File to native storage (for large files)
     * Returns file URI for use in media elements
     */
    async saveFile(file: File): Promise<SaveFileResult> {
        if (!this.isSupportedCapacitor()) {
            const blobUrl = URL.createObjectURL(file);
            return {
                uri: blobUrl,
                size: file.size,
                mimeType: file.type
            };
        }

        try {
            const category = this.getCategory(file.type);
            const filename = this.generateFilename(file.name);
            const path = `aurora-files/${category}/${filename}`;

            // @ts-expect-error - Capacitor Android may inject 'path' or 'webPath' into the File object
            const sourceUri = file.path || file.webPath;

            if (sourceUri) {
                // BEST CASE: ZERO-BASE64 NATIVE COPY
                // Uses the native path directly to avoid loading bytes into JS
                await Filesystem.copy({
                    from: sourceUri,
                    to: path,
                    toDirectory: Directory.Data,
                    directory: Directory.External // Try to resolve from external/content providers
                }).catch(async () => {
                    // Fallback: If direct copy fails, try without explicit directory for 'from'
                    await Filesystem.copy({
                        from: sourceUri,
                        to: path,
                        toDirectory: Directory.Data
                    });
                });
            } else {
                // MEMORY-SAFE FALLBACK: Chunked write
                // Used when native path is unavailable (e.g. some web pickers)
                console.warn('No native path found. Using memory-safe chunked write.');
                await this.saveFileChunked(file, path);
            }

            const result = await Filesystem.getUri({
                path,
                directory: Directory.Data
            });

            return {
                uri: result.uri,
                size: file.size,
                mimeType: file.type
            };
        } catch (error) {
            console.error('Failed to save file to native storage:', error);
            throw error;
        }
    }

    /**
     * Save a File in chunks (for when native path is unavailable)
     * Reads 1MB at a time to prevent memory crashes on Android.
     */
    private async saveFileChunked(file: File, path: string): Promise<void> {
        const chunkSize = 1024 * 1024; // 1MB chunks
        let offset = 0;
        let isFirstChunk = true;

        while (offset < file.size) {
            const chunk = file.slice(offset, offset + chunkSize);
            const base64 = await this.blobToBase64(chunk);

            if (isFirstChunk) {
                await Filesystem.writeFile({
                    path,
                    data: base64,
                    directory: Directory.Data,
                    recursive: true
                });
                isFirstChunk = false;
            } else {
                await Filesystem.appendFile({
                    path,
                    data: base64,
                    directory: Directory.Data
                });
            }

            offset += chunkSize;
            // Briefly yield to UI thread
            await new Promise(r => setTimeout(r, 0));
        }
    }

    /**
     * Convert Blob/File chunk to Base64
     */
    private blobToBase64(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                resolve(result.split(',')[1]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Check if a file should use native storage based on size
     */
    shouldUseNativeStorage(fileSize: number): boolean {
        return this.isSupportedCapacitor() && fileSize >= FILE_SIZE_THRESHOLD;
    }

    /**
     * Delete a file from native storage
     */
    async deleteFile(uri: string): Promise<void> {
        if (!this.isSupportedCapacitor()) {
            // Revoke blob URL
            if (uri.startsWith('blob:')) {
                URL.revokeObjectURL(uri);
            }
            return;
        }

        try {
            // Extract path from URI
            // URI format: file:///data/user/0/.../aurora-files/videos/file.mp4
            const match = uri.match(/aurora-files\/.+/);
            if (match) {
                await Filesystem.deleteFile({
                    path: match[0],
                    directory: Directory.Data
                });
            }
        } catch (error) {
            console.error('Failed to delete file:', error);
        }
    }

    /**
     * Convert native URI to web-usable URL for media playback
     */
    convertFileSrc(uri: string): string {
        if (!this.isSupportedCapacitor()) {
            return uri; // Already a blob URL or data URL
        }
        return Capacitor.convertFileSrc(uri);
    }

    /**
     * Get statistics about native storage usage
     */
    async getNativeStorageStats(): Promise<{ count: number, size: number }> {
        if (!this.isSupportedCapacitor()) {
            return { count: 0, size: 0 };
        }

        let totalSize = 0;
        let totalCount = 0;

        try {
            const categories = ['videos', 'audio', 'images', 'documents'];
            for (const cat of categories) {
                try {
                    const result = await Filesystem.readdir({
                        path: `aurora-files/${cat}`,
                        directory: Directory.Data
                    });

                    totalCount += result.files.length;

                    // Sum up sizes
                    for (const file of result.files) {
                        try {
                            const stat = await Filesystem.stat({
                                path: `aurora-files/${cat}/${file.name}`,
                                directory: Directory.Data
                            });
                            totalSize += stat.size;
                        } catch {
                            // File might have been deleted mid-scan
                        }
                    }
                } catch {
                    // Category directory might not exist yet
                }
            }
        } catch (error) {
            console.error('Failed to get native storage stats:', error);
        }

        return { count: totalCount, size: totalSize };
    }

    /**
     * Get list of all native storage files with metadata
     */
    async getNativeStorageFiles(): Promise<Array<{ name: string, path: string, category: string, size: number }>> {
        if (!this.isSupportedCapacitor()) {
            return [];
        }

        const files: Array<{ name: string, path: string, category: string, size: number }> = [];

        try {
            const categories = ['videos', 'audio', 'images', 'documents'];
            for (const cat of categories) {
                try {
                    const result = await Filesystem.readdir({
                        path: `aurora-files/${cat}`,
                        directory: Directory.Data
                    });

                    for (const file of result.files) {
                        try {
                            const stat = await Filesystem.stat({
                                path: `aurora-files/${cat}/${file.name}`,
                                directory: Directory.Data
                            });
                            files.push({
                                name: file.name,
                                path: `aurora-files/${cat}/${file.name}`,
                                category: cat,
                                size: stat.size
                            });
                        } catch {
                            // File might have been deleted mid-scan
                        }
                    }
                } catch {
                    // Category directory might not exist yet
                }
            }
        } catch (error) {
            console.error('Failed to get native storage files:', error);
        }

        return files;
    }

    /**
     * Unify URI resolution for all apps.
     * Handles nativeUri, Base64 content, and blob URLs.
     */
    getFileUrl(node: { nativeUri?: string, content?: string }): string {
        if (node.nativeUri) {
            return this.convertFileSrc(node.nativeUri);
        }
        return node.content || '';
    }
}

// Export singleton instance
export const fileStorage = FileStorage.getInstance();
