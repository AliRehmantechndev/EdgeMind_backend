import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Validation middleware for creating annotation class
const validateCreateClass = [
  body('name').isString().notEmpty().withMessage('Class name is required'),
  body('color').isString().notEmpty().withMessage('Color is required'),
  body('datasetId').isString().notEmpty().withMessage('Dataset ID is required'),
];

// GET - Fetch annotation classes for a dataset
router.get('/dataset/:datasetId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { datasetId } = req.params;
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

    const classes = await prisma.annotationClass.findMany({
      where: { 
        datasetId,
        userId 
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json(classes);
  } catch (error) {
    console.error('Error fetching annotation classes:', error);
    res.status(500).json({ error: 'Failed to fetch annotation classes' });
  }
});

// POST - Create new annotation class
router.post('/', authenticateToken, validateCreateClass, async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, color, datasetId } = req.body;
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

    // Check if class with same name already exists in this dataset
    const existingClass = await prisma.annotationClass.findFirst({
      where: {
        name,
        datasetId,
        userId
      }
    });

    if (existingClass) {
      return res.status(400).json({ error: 'Class with this name already exists in this dataset' });
    }

    const newClass = await prisma.annotationClass.create({
      data: {
        name,
        color,
        datasetId,
        userId,
      }
    });

    res.status(201).json(newClass);
  } catch (error) {
    console.error('Error creating annotation class:', error);
    res.status(500).json({ error: 'Failed to create annotation class' });
  }
});

// PUT - Update annotation class
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;
    const userId = req.user!.userId;

    const existingClass = await prisma.annotationClass.findFirst({
      where: { 
        id,
        userId 
      }
    });

    if (!existingClass) {
      return res.status(404).json({ error: 'Annotation class not found' });
    }

    const updatedClass = await prisma.annotationClass.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(color && { color }),
        updatedAt: new Date()
      }
    });

    res.json(updatedClass);
  } catch (error) {
    console.error('Error updating annotation class:', error);
    res.status(500).json({ error: 'Failed to update annotation class' });
  }
});

// DELETE - Delete annotation class
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const annotationClass = await prisma.annotationClass.findFirst({
      where: { 
        id,
        userId 
      }
    });

    if (!annotationClass) {
      return res.status(404).json({ error: 'Annotation class not found' });
    }

    // Delete all annotations using this class first
    await prisma.annotation.deleteMany({
      where: {
        classId: id,
        userId
      }
    });

    // Then delete the class
    await prisma.annotationClass.delete({
      where: { id }
    });

    res.json({ message: 'Annotation class and related annotations deleted successfully' });
  } catch (error) {
    console.error('Error deleting annotation class:', error);
    res.status(500).json({ error: 'Failed to delete annotation class' });
  }
});

export default router;
