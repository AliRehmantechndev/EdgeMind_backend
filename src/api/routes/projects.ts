import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Validation middleware
const validateProject = [
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Project name must be between 1 and 100 characters'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
  body('projectType').optional().isIn(['object_detection', 'classification', 'instance_segmentation', 'keypoint_detection']).withMessage('Invalid project type'),
  body('annotationGroup').optional().trim().isLength({ max: 100 }).withMessage('Annotation group must be less than 100 characters'),
  body('isPublic').optional().isBoolean().withMessage('isPublic must be a boolean'),
  body('features').optional().isArray().withMessage('Features must be an array'),
];

// Get all projects for the authenticated user
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const projects = await prisma.project.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        projectType: true,
        annotationGroup: true,
        isPublic: true,
        features: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    res.json({
      message: 'Projects retrieved successfully',
      projects
    });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific project by ID
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findFirst({
      where: { 
        id,
        userId: req.user!.userId 
      },
      select: {
        id: true,
        name: true,
        description: true,
        projectType: true,
        annotationGroup: true,
        isPublic: true,
        features: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({
      message: 'Project retrieved successfully',
      project
    });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new project
router.post('/', authenticateToken, validateProject, async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, projectType, annotationGroup, isPublic, features } = req.body;

    const project = await prisma.project.create({
      data: {
        name,
        description: description || null,
        projectType: projectType || 'object_detection',
        annotationGroup: annotationGroup || null,
        isPublic: isPublic !== undefined ? isPublic : true,
        features: features || [],
        userId: req.user!.userId,
      },
      select: {
        id: true,
        name: true,
        description: true,
        projectType: true,
        annotationGroup: true,
        isPublic: true,
        features: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    res.status(201).json({
      message: 'Project created successfully',
      project
    });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a project
router.put('/:id', authenticateToken, validateProject, async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { name, description, projectType, annotationGroup, isPublic, features } = req.body;

    // Check if project exists and belongs to user
    const existingProject = await prisma.project.findFirst({
      where: { 
        id,
        userId: req.user!.userId 
      }
    });

    if (!existingProject) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = await prisma.project.update({
      where: { id },
      data: {
        name,
        description: description || null,
        projectType: projectType || existingProject.projectType,
        annotationGroup: annotationGroup || existingProject.annotationGroup,
        isPublic: isPublic !== undefined ? isPublic : existingProject.isPublic,
        features: features || existingProject.features,
      },
      select: {
        id: true,
        name: true,
        description: true,
        projectType: true,
        annotationGroup: true,
        isPublic: true,
        features: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    res.json({
      message: 'Project updated successfully',
      project
    });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a project
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if project exists and belongs to user
    const existingProject = await prisma.project.findFirst({
      where: { 
        id,
        userId: req.user!.userId 
      }
    });

    if (!existingProject) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await prisma.project.delete({
      where: { id }
    });

    res.json({
      message: 'Project deleted successfully'
    });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
