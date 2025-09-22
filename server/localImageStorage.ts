import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export class LocalImageStorage {
  private uploadsDir: string;
  private baseUrl: string;

  constructor() {
    // Create uploads directory in the public folder
    this.uploadsDir = path.join(process.cwd(), 'public', 'product-images');
    this.baseUrl = '/product-images';
    this.ensureUploadDirectory();
  }

  private async ensureUploadDirectory(): Promise<void> {
    try {
      await fs.access(this.uploadsDir);
    } catch {
      // Directory doesn't exist, create it
      await fs.mkdir(this.uploadsDir, { recursive: true });
      console.log(`📁 [LOCAL-STORAGE] Created uploads directory: ${this.uploadsDir}`);
    }
  }

  /**
   * Upload image data to local storage
   * @param fileName Original filename
   * @param imageBuffer Image data as buffer
   * @param contentType MIME type (optional)
   * @returns Public URL for the uploaded image
   */
  async uploadImage(fileName: string, imageBuffer: Buffer, contentType: string = 'image/png'): Promise<string> {
    try {
      // Ensure directory exists
      await this.ensureUploadDirectory();

      // Generate unique filename to avoid collisions
      const ext = path.extname(fileName) || '.png';
      const baseName = path.basename(fileName, ext);
      const uniqueFileName = `${baseName}_${Date.now()}${ext}`;
      
      const filePath = path.join(this.uploadsDir, uniqueFileName);

      // Write the file
      await fs.writeFile(filePath, imageBuffer);

      // Return the public URL
      const publicUrl = `${this.baseUrl}/${uniqueFileName}`;
      
      console.log(`✅ [LOCAL-STORAGE] Image uploaded successfully: ${uniqueFileName}`);
      return publicUrl;

    } catch (error) {
      console.error(`❌ [LOCAL-STORAGE] Failed to upload image ${fileName}:`, error);
      throw new Error(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if an image exists in local storage
   * @param fileName Filename to check
   * @returns True if file exists
   */
  async imageExists(fileName: string): Promise<boolean> {
    try {
      const filePath = path.join(this.uploadsDir, fileName);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete an image from local storage
   * @param fileName Filename to delete
   * @returns True if file was deleted or didn't exist
   */
  async deleteImage(fileName: string): Promise<boolean> {
    try {
      const filePath = path.join(this.uploadsDir, fileName);
      await fs.unlink(filePath);
      console.log(`🗑️ [LOCAL-STORAGE] Image deleted: ${fileName}`);
      return true;
    } catch (error) {
      console.warn(`⚠️ [LOCAL-STORAGE] Could not delete image ${fileName}:`, error);
      return false;
    }
  }

  /**
   * Get the local file path for an image
   * @param fileName Filename
   * @returns Full local path
   */
  getImagePath(fileName: string): string {
    return path.join(this.uploadsDir, fileName);
  }

  /**
   * Get the public URL for an image
   * @param fileName Filename
   * @returns Public URL
   */
  getImageUrl(fileName: string): string {
    return `${this.baseUrl}/${fileName}`;
  }

  /**
   * List all images in storage
   * @returns Array of filenames
   */
  async listImages(): Promise<string[]> {
    try {
      await this.ensureUploadDirectory();
      const files = await fs.readdir(this.uploadsDir);
      return files.filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file));
    } catch (error) {
      console.error(`❌ [LOCAL-STORAGE] Failed to list images:`, error);
      return [];
    }
  }

  /**
   * Get storage statistics
   * @returns Storage info
   */
  async getStorageInfo(): Promise<{ totalImages: number; totalSizeBytes: number }> {
    try {
      const images = await this.listImages();
      let totalSize = 0;

      for (const image of images) {
        try {
          const filePath = path.join(this.uploadsDir, image);
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
        } catch {
          // Skip files that can't be accessed
        }
      }

      return {
        totalImages: images.length,
        totalSizeBytes: totalSize
      };
    } catch {
      return { totalImages: 0, totalSizeBytes: 0 };
    }
  }
}

// Create singleton instance
export const localImageStorage = new LocalImageStorage();