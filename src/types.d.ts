// types.d.ts
declare module 'csv-writer' {
    export interface CsvWriter<T> {
      writeRecords(records: T[]): Promise<void>;
    }
    
    export function createObjectCsvWriter(params: {
      path: string;
      header: { id: string; title: string }[];
    }): CsvWriter<any>;
  }
  
  declare module 'pdfkit' {
    class PDFDocument {
      constructor(options?: any);
      pipe(stream: any): void;
      text(text: string, x?: number, y?: number, options?: any): PDFDocument;
      end(): void;
      font(font: string, size?: number): PDFDocument;
      fontSize(size: number): PDFDocument;
      moveDown(lines?: number): PDFDocument;
      // Ajoutez d'autres méthodes nécessaires
    }
    export default PDFDocument;
  }
  
  // Pour Express.Multer.File
  declare namespace Express {
    export interface Multer {
      File: {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        destination: string;
        filename: string;
        path: string;
        buffer: Buffer;
      };
    }
  }