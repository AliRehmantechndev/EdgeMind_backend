import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Validation middleware for creating annotations
const validateAnnotations = [
  body('annotations').isArray().withMessage('Annotations must be an array'),
  body('annotations.*.classId').isString().notEmpty().withMessage('Class ID is required'),
  body('annotations.*.imageId').isString().notEmpty().withMessage('Image ID is required'),
  body('annotations.*.datasetId').isString().notEmpty().withMessage('Dataset ID is required'),
  body('annotations.*.data').isObject().withMessage('Annotation data is required'),
];

// GET - Fetch annotations for a dataset and optionally filter by image
router.get('/dataset/:datasetId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { datasetId } = req.params;
    const { imageId } = req.query;
    const userId = req.user!.userId;

    // Verify user has access to this dataset
    const dataset = await prisma.dataset.findFirst({
      where: { 
        id: datasetId,
        userId 
      }
    });

    if (!dataset) {
      return res.status(404).json({ error: 'Dataset not found or access denied' });
    }

    const where: any = { 
      datasetId,
      userId 
    };
    
    if (imageId) {
      where.imageId = imageId as string;
    }
    
    const annotations = await prisma.annotation.findMany({ 
      where,
      orderBy: { createdAt: 'desc' }
    });

    res.json({ annotations });
  } catch (error) {
    console.error('Error fetching annotations:', error);
    res.status(500).json({ error: 'Failed to fetch annotations' });
  }
});

// POST - Save multiple annotations
router.post('/', authenticateToken, validateAnnotations, async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { annotations: annotationData } = req.body;
    const userId = req.user!.userId;

    // Verify all datasets exist and user has access
    const datasetIds = [...new Set(annotationData.map((ann: any) => ann.datasetId))] as string[];
    const datasets = await prisma.dataset.findMany({
      where: { 
        id: { in: datasetIds },
        userId 
      }
    });

    if (datasets.length !== datasetIds.length) {
      return res.status(400).json({ error: 'One or more datasets not found or access denied' });
    }

    // Verify all annotation classes exist
    const classIds = [...new Set(annotationData.map((ann: any) => ann.classId))] as string[];
    const classes = await prisma.annotationClass.findMany({
      where: { 
        id: { in: classIds },
        userId 
      }
    });

    if (classes.length !== classIds.length) {
      return res.status(400).json({ error: 'One or more annotation classes not found' });
    }

    // Create all annotations
    const createdAnnotations = await Promise.all(
      annotationData.map(async (annotation: any) => {
        return await prisma.annotation.create({
          data: {
            classId: annotation.classId,
            imageId: annotation.imageId,
            datasetId: annotation.datasetId,
            userId,
            data: annotation.data,
          }
        });
      })
    );

    res.status(201).json({ 
      message: `Successfully created ${createdAnnotations.length} annotations`,
      annotations: createdAnnotations 
    });
  } catch (error) {
    console.error('Error saving annotations:', error);
    res.status(500).json({ error: 'Failed to save annotations' });
  }
});

// PUT - Update annotation
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { classId, data } = req.body;
    const userId = req.user!.userId;

    const existingAnnotation = await prisma.annotation.findFirst({
      where: { 
        id,
        userId 
      }
    });

    if (!existingAnnotation) {
      return res.status(404).json({ error: 'Annotation not found' });
    }

    const updatedAnnotation = await prisma.annotation.update({
      where: { id },
      data: {
        ...(classId && { classId }),
        ...(data && { data }),
        updatedAt: new Date()
      }
    });

    res.json(updatedAnnotation);
  } catch (error) {
    console.error('Error updating annotation:', error);
    res.status(500).json({ error: 'Failed to update annotation' });
  }
});

// DELETE - Delete annotation
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const annotation = await prisma.annotation.findFirst({ 
      where: { id, userId } 
    });
    
    if (!annotation) {
      return res.status(404).json({ error: 'Annotation not found' });
    }

    await prisma.annotation.delete({ where: { id } });
    
    res.json({ message: 'Annotation deleted successfully' });
  } catch (error) {
    console.error('Error deleting annotation:', error);
    res.status(500).json({ error: 'Failed to delete annotation' });
  }
});

export default router;
