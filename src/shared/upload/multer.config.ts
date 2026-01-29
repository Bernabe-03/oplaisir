import { diskStorage, FileFilterCallback, Multer } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Request } from 'express';
import { BadRequestException } from '@nestjs/common';

export const multerConfig = {
  storage: diskStorage({
    destination: './uploads/products',
    filename: (
      req: Request,
      file: Multer.File, // <-- corrigé ici
      callback: (error: Error | null, filename: string) => void,
    ) => {
      const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
      callback(null, uniqueName);
    },
  }),
  fileFilter: (
    req: Request,
    file: Multer.File, // <-- et ici
    callback: FileFilterCallback,
  ) => {
    const allowedTypes = /jpeg|jpg|png|webp|gif/;
    const extnameValid = allowedTypes.test(extname(file.originalname).toLowerCase());
    const mimetypeValid = allowedTypes.test(file.mimetype);

    if (extnameValid && mimetypeValid) {
      return callback(null, true);
    }

    callback(
      new BadRequestException(
        'Seules les images sont autorisées (jpeg, jpg, png, webp, gif)',
      ),
    );
  },
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
};
