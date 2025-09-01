import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import yauzl from 'yauzl';
import { Request } from 'express';

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads');
fs.ensureDirSync(uploadsDir);

// Create datasets directory if it doesn't exist
const datasetsDir = path.join(uploadsDir, 'datasets');
fs.ensureDirSync(datasetsDir);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    // Create a unique directory for this upload session
    const uploadId = Date.now().toString();
    const uploadPath = path.join(uploadsDir, 'temp', uploadId);
    fs.ensureDirSync(uploadPath);
    req.body.uploadPath = uploadPath; // Store for later use
    cb(null, uploadPath);
  },
  filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    // Keep original filename
    cb(null, file.originalname);
  }
});

// File filter to accept images and ZIP files
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedImageTypes = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff'];
  const allowedArchiveTypes = ['.zip'];
  
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  if (allowedImageTypes.includes(fileExtension) || allowedArchiveTypes.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${fileExtension} is not supported. Please upload images or ZIP files.`));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB per file
    files: 50 // Maximum 50 files at once
  }
});

// Helper function to extract ZIP files
export const extractZipFile = (zipPath: string, extractPath: string): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const extractedFiles: string[] = [];
    
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        reject(err);
        return;
      }

      if (!zipfile) {
        reject(new Error('Failed to open ZIP file'));
        return;
      }

      zipfile.readEntry();
      
      zipfile.on('entry', (entry) => {
        if (/\/$/.test(entry.fileName)) {
          // Directory entry
          zipfile.readEntry();
        } else {
          // File entry
          const fileExtension = path.extname(entry.fileName).toLowerCase();
          const allowedImageTypes = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff'];
          
          if (allowedImageTypes.includes(fileExtension)) {
            zipfile.openReadStream(entry, (err, readStream) => {
              if (err) {
                reject(err);
                return;
              }

              if (!readStream) {
                zipfile.readEntry();
                return;
              }

              // Create safe filename
              const safeFileName = path.basename(entry.fileName);
              const outputPath = path.join(extractPath, safeFileName);
              
              // Ensure directory exists
              fs.ensureDirSync(path.dirname(outputPath));
              
              const writeStream = fs.createWriteStream(outputPath);
              readStream.pipe(writeStream);
              
              writeStream.on('close', () => {
                extractedFiles.push(outputPath);
                zipfile.readEntry();
              });
              
              writeStream.on('error', (err) => {
                reject(err);
              });
            });
          } else {
            // Skip non-image files
            zipfile.readEntry();
          }
        }
      });
      
      zipfile.on('end', () => {
        resolve(extractedFiles);
      });
      
      zipfile.on('error', (err) => {
        reject(err);
      });
    });
  });
};

// Helper function to get file size
export const getFileSize = (filePath: string): Promise<number> => {
  return new Promise((resolve, reject) => {
    fs.stat(filePath, (err, stats) => {
      if (err) {
        reject(err);
      } else {
        resolve(stats.size);
      }
    });
  });
};

// Helper function to move files to final dataset directory
export const organizeDatasetFiles = async (
  tempPath: string, 
  datasetId: string, 
  extractedZipFiles: string[] = []
): Promise<{ files: string[], totalSize: number }> => {
  const datasetPath = path.join(datasetsDir, datasetId);
  fs.ensureDirSync(datasetPath);

  const allFiles: string[] = [];
  let totalSize = 0;

  // Get all image files from temp directory
  const tempFiles = await fs.readdir(tempPath);
  
  for (const file of tempFiles) {
    const filePath = path.join(tempPath, file);
    const stats = await fs.stat(filePath);
    
    if (stats.isFile()) {
      const fileExtension = path.extname(file).toLowerCase();
      const allowedImageTypes = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff'];
      
      if (allowedImageTypes.includes(fileExtension)) {
        // Move image file to dataset directory
        const newPath = path.join(datasetPath, file);
        await fs.move(filePath, newPath);
        allFiles.push(newPath);
        totalSize += stats.size;
      }
    }
  }

  // Add extracted ZIP files
  for (const extractedFile of extractedZipFiles) {
    if (await fs.pathExists(extractedFile)) {
      const stats = await fs.stat(extractedFile);
      const fileName = path.basename(extractedFile);
      const newPath = path.join(datasetPath, fileName);
      
      // Move to dataset directory if not already there
      if (extractedFile !== newPath) {
        await fs.move(extractedFile, newPath);
      }
      
      allFiles.push(newPath);
      totalSize += stats.size;
    }
  }

  // Clean up temp directory
  await fs.remove(tempPath);

  return { files: allFiles, totalSize };
};
