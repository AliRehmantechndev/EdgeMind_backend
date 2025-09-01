import express, { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// GET - Export all annotations for a user
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const userAnnotations = await prisma.annotation.findMany({ 
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    const exportData = {
      exportDate: new Date().toISOString(),
      userId: userId,
      totalAnnotations: userAnnotations.length,
      annotations: userAnnotations.map((annotation: any) => ({
        id: annotation.id,
        fileId: annotation.fileId,
        tool: annotation.tool,
        annotations: annotation.annotations,
        metadata: annotation.metadata,
        createdAt: annotation.createdAt,
        updatedAt: annotation.updatedAt
      }))
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="annotations_${userId}_${new Date().toISOString().split('T')[0]}.json"`);
    res.send(jsonString);
  } catch (error) {
    console.error('Error exporting annotations:', error);
    res.status(500).json({ error: 'Failed to export annotations' });
  }
});

export default router;
