import { Injectable } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import { Readable } from 'stream';
import { Multer } from 'multer'; // <-- important

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }

  async uploadImage(file: Multer.File): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'oplaisir/products',
          resource_type: 'image',
          transformation: [
            { width: 800, height: 800, crop: 'limit' },
            { quality: 'auto' },
            { format: 'webp' }
          ]
        },
        (error: UploadApiErrorResponse, result: UploadApiResponse) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      const bufferStream = new Readable();
      bufferStream.push(file.buffer);
      bufferStream.push(null);
      bufferStream.pipe(uploadStream);
    });
  }

  async uploadMultipleImages(files: Multer.File[]): Promise<string[]> {
    const uploadPromises = files.map(file => this.uploadImage(file));
    const results = await Promise.all(uploadPromises);
    return results.map(result => result.secure_url);
  }

  async deleteImage(publicId: string): Promise<any> {
    return cloudinary.uploader.destroy(publicId);
  }

  async deleteMultipleImages(publicIds: string[]): Promise<any[]> {
    const deletePromises = publicIds.map(publicId => this.deleteImage(publicId));
    return Promise.all(deletePromises);
  }

  extractPublicIdFromUrl(url: string): string | null {
    try {
      const urlParts = url.split('/');
      const uploadIndex = urlParts.indexOf('upload');
      if (uploadIndex === -1) return null;

      const publicIdParts = urlParts.slice(uploadIndex + 2);
      const publicIdWithExtension = publicIdParts.join('/');

      const publicId = publicIdWithExtension.replace(/\.[^/.]+$/, '');
      return publicId;
    } catch (error) {
      console.error('Erreur extraction publicId:', error);
      return null;
    }
  }  

  extractPublicIdsFromUrls(urls: string[]): string[] {
    return urls
      .map(url => this.extractPublicIdFromUrl(url))
      .filter(publicId => publicId !== null) as string[];
  }

  async optimizeImage(url: string, options?: any): Promise<string> {
    const publicId = this.extractPublicIdFromUrl(url);
    if (!publicId) return url;

    const transformation = options || {
      width: 500,
      height: 500,
      crop: 'fill',
      gravity: 'auto',
      quality: 'auto',
      format: 'webp'
    };

    return cloudinary.url(publicId, {
      transformation: [transformation]
    });
  }
}
