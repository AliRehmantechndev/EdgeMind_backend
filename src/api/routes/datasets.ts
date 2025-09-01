import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { upload, extractZipFile, organizeDatasetFiles } from '../../utils/fileUpload';
import { serializeDataset, serializeDatasets, serializeStats } from '../../utils/serializer';
import path from 'path';
import fs from 'fs-extra';

const router = express.Router();

// Validation middleware
const validateDataset = [
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Dataset name must be between 1 and 100 characters'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
  body('projectId').isString().withMessage('Project ID is required'),
  body('uploadType').optional().isIn(['individual', 'folder']).withMessage('Upload type must be individual or folder'),
];

// Get all datasets for the authenticated user
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.query;
    
    const whereClause: any = { userId: req.user!.userId };
    if (projectId) {
      whereClause.projectId = projectId as string;
    }

    const datasets = await prisma.dataset.findMany({
      where: whereClause,
      include: {
        project: {
          select: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      message: 'Datasets retrieved successfully',
      datasets: serializeDatasets(datasets)
    });
  } catch (error) {
    console.error('Get datasets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get dataset statistics for a project
router.get('/stats/:projectId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;

    // Verify project belongs to user
    const project = await prisma.project.findFirst({
      where: { 
        id: projectId,
        userId: req.user!.userId 
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const stats = await prisma.dataset.aggregate({
      where: { 
        projectId,
        userId: req.user!.userId 
      },
      _count: {
        id: true
      },
      _sum: {
        totalSize: true,
        totalFiles: true
      }
    });

    const statusCounts = await prisma.dataset.groupBy({
      by: ['status'],
      where: { 
        projectId,
        userId: req.user!.userId 
      },
      _count: {
        status: true
      }
    });

    const formattedStats = {
      totalDatasets: stats._count.id || 0,
      totalSize: stats._sum.totalSize || 0,
      totalFiles: stats._sum.totalFiles || 0,
      ready: statusCounts.find(s => s.status === 'ready')?._count.status || 0,
      processing: statusCounts.find(s => s.status === 'processing')?._count.status || 0,
      error: statusCounts.find(s => s.status === 'error')?._count.status || 0,
    };

    res.json({
      message: 'Dataset statistics retrieved successfully',
      stats: serializeStats(formattedStats)
    });
  } catch (error) {
    console.error('Get dataset stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific dataset by ID
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const dataset = await prisma.dataset.findFirst({
      where: { 
        id,
        userId: req.user!.userId 
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    if (!dataset) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    res.json({
      message: 'Dataset retrieved successfully',
      dataset: serializeDataset(dataset)
    });
  } catch (error) {
    console.error('Get dataset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new dataset
router.post('/', authenticateToken, validateDataset, async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, projectId, uploadType } = req.body;

    // Verify project belongs to user
    const project = await prisma.project.findFirst({
      where: { 
        id: projectId,
        userId: req.user!.userId 
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const dataset = await prisma.dataset.create({
      data: {
        name,
        description: description || null,
        projectId,
        userId: req.user!.userId,
        uploadType: uploadType || 'individual',
        status: 'ready',
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    res.status(201).json({
      message: 'Dataset created successfully',
      dataset: serializeDataset(dataset)
    });
  } catch (error) {
    console.error('Create dataset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a dataset
router.put('/:id', authenticateToken, validateDataset, async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { name, description, uploadType } = req.body;

    // Check if dataset exists and belongs to user
    const existingDataset = await prisma.dataset.findFirst({
      where: { 
        id,
        userId: req.user!.userId 
      }
    });

    if (!existingDataset) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    const dataset = await prisma.dataset.update({
      where: { id },
      data: {
        name,
        description: description || null,
        uploadType: uploadType || existingDataset.uploadType,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    res.json({
      message: 'Dataset updated successfully',
      dataset: serializeDataset(dataset)
    });
  } catch (error) {
    console.error('Update dataset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a dataset
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if dataset exists and belongs to user
    const existingDataset = await prisma.dataset.findFirst({
      where: { 
        id,
        userId: req.user!.userId 
      }
    });

    if (!existingDataset) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    await prisma.dataset.delete({
      where: { id }
    });

    res.json({
      message: 'Dataset deleted successfully'
    });
  } catch (error) {
    console.error('Delete dataset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload files to a dataset
router.post('/:id/upload', authenticateToken, upload.array('files', 50), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Verify dataset exists and belongs to user
    const dataset = await prisma.dataset.findFirst({
      where: { 
        id,
        userId: req.user!.userId 
      }
    });

    if (!dataset) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    // Set dataset status to processing
    await prisma.dataset.update({
      where: { id },
      data: { status: 'processing' }
    });

    const tempPath = req.body.uploadPath;
    const extractedZipFiles: string[] = [];
    let totalExtractedSize = 0;

    // Process uploaded files
    for (const file of files) {
      const fileExtension = path.extname(file.originalname).toLowerCase();
      
      if (fileExtension === '.zip') {
        try {
          // Extract ZIP file
          const extractPath = path.join(path.dirname(file.path), 'extracted');
          fs.ensureDirSync(extractPath);
          
          const extractedFiles = await extractZipFile(file.path, extractPath);
          extractedZipFiles.push(...extractedFiles);
          
          // Remove the ZIP file after extraction
          await fs.remove(file.path);
        } catch (error) {
          console.error('Error extracting ZIP file:', error);
          // Continue with other files
        }
      }
    }

    // Organize all files into the dataset directory
    const { files: organizedFiles, totalSize } = await organizeDatasetFiles(
      tempPath,
      dataset.id,
      extractedZipFiles
    );

    // Update dataset with file information
    const updatedDataset = await prisma.dataset.update({
      where: { id },
      data: {
        totalFiles: organizedFiles.length,
        totalSize: BigInt(totalSize),
        status: 'ready'
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    res.json({
      message: 'Files uploaded successfully',
      dataset: serializeDataset(updatedDataset),
      uploadedFiles: organizedFiles.length,
      totalSize: totalSize
    });

  } catch (error) {
    console.error('Upload files error:', error);
    
    // Try to update dataset status to error
    try {
      await prisma.dataset.update({
        where: { id: req.params.id },
        data: { status: 'error' }
      });
    } catch (updateError) {
      console.error('Error updating dataset status:', updateError);
    }
    
    res.status(500).json({ error: 'Internal server error during file upload' });
  }
});

// Get images from a dataset
router.get('/:id/images', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Verify dataset belongs to user
    const dataset = await prisma.dataset.findFirst({
      where: { 
        id,
        userId: req.user!.userId 
      }
    });

    if (!dataset) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    const datasetPath = path.join(process.cwd(), 'uploads', 'datasets', id);
    
    if (!await fs.pathExists(datasetPath)) {
      return res.json({ 
        message: 'Dataset images retrieved successfully',
        images: []
      });
    }

    const files = await fs.readdir(datasetPath);
    const allowedImageTypes = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff'];
    
    const images = [];
    
    for (const file of files) {
      const filePath = path.join(datasetPath, file);
      const stats = await fs.stat(filePath);
      
      if (stats.isFile()) {
        const fileExtension = path.extname(file).toLowerCase();
        
        if (allowedImageTypes.includes(fileExtension)) {
          images.push({
            id: file,
            name: file,
            size: stats.size,
            url: `/api/datasets/${id}/images/${encodeURIComponent(file)}`,
            createdAt: stats.birthtime
          });
        }
      }
    }

    res.json({
      message: 'Dataset images retrieved successfully',
      images: images.sort((a, b) => a.name.localeCompare(b.name))
    });

  } catch (error) {
    console.error('Get dataset images error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve individual image files
router.get('/:id/images/:filename', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id, filename } = req.params;

    // Verify dataset belongs to user
    const dataset = await prisma.dataset.findFirst({
      where: { 
        id,
        userId: req.user!.userId 
      }
    });

    if (!dataset) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    const imagePath = path.join(process.cwd(), 'uploads', 'datasets', id, filename);
    
    if (!await fs.pathExists(imagePath)) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Security check: ensure the file is within the dataset directory
    const normalizedImagePath = path.normalize(imagePath);
    const normalizedDatasetPath = path.normalize(path.join(process.cwd(), 'uploads', 'datasets', id));
    
    if (!normalizedImagePath.startsWith(normalizedDatasetPath)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if file is an allowed image type
    const fileExtension = path.extname(filename).toLowerCase();
    const allowedImageTypes = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff'];
    
    if (!allowedImageTypes.includes(fileExtension)) {
      return res.status(400).json({ error: 'Invalid file type' });
    }

    // Set appropriate content type
    const contentTypeMap: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.webp': 'image/webp',
      '.tiff': 'image/tiff'
    };

    const contentType = contentTypeMap[fileExtension] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    
    // Stream the file
    const fileStream = fs.createReadStream(imagePath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Serve image error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
