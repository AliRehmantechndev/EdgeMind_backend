import express, { Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import prisma from '../../lib/prisma';

const router = express.Router();

// Worker configuration
const WORKER_URL = process.env.WORKER_URL;

// GET - Fetch trained models for user's datasets
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    console.log(`🔍 Fetching trained models for user: ${userId}`);

    // Get all datasets created by the user
    const userDatasets = await prisma.dataset.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        createdAt: true,
        project: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    console.log(`📋 Found ${userDatasets.length} datasets for user`);

    if (userDatasets.length === 0) {
      return res.json({
        message: 'No trained models found',
        trainedModels: []
      });
    }

    // Extract dataset names to match against trained model files in MinIO
    const datasetNames = userDatasets.map(d => d.name);
    const datasetIds = userDatasets.map(d => d.id);

    console.log(`📂 User dataset names: ${datasetNames.join(', ')}`);

    // Fetch trained models from worker with user context
    const workerResponse = await fetch(`${WORKER_URL}/trained-models`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: userId,
        datasetNames: datasetNames,
        datasetIds: datasetIds,
        userDatasets: userDatasets
      })
    });

    if (!workerResponse.ok) {
      const errorText = await workerResponse.text();
      console.error('❌ Worker error:', errorText);
      throw new Error(`Worker request failed: ${workerResponse.status} - ${errorText}`);
    }

    const workerResult = await workerResponse.json() as {
      trainedModels?: any[];
      [key: string]: any;
    };

    console.log(`✅ Successfully fetched ${workerResult.trainedModels?.length || 0} trained models from worker`);

    res.json({
      message: 'Trained models retrieved successfully',
      trainedModels: workerResult.trainedModels || [],
      userDatasets: userDatasets,
      source: 'cloudflare-worker'
    });

  } catch (error) {
    console.error('❌ Error fetching trained models:', error);
    res.status(500).json({ 
      error: 'Failed to fetch trained models',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET - Get specific trained model details
router.get('/:modelName', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { modelName } = req.params;
    const userId = req.user!.userId;

    console.log(`🔍 Fetching trained model details: ${modelName} for user: ${userId}`);

    // Verify user has access to this model by checking if it belongs to their dataset
    const userDatasets = await prisma.dataset.findMany({
      where: { userId },
      select: { name: true }
    });

    const datasetNames = userDatasets.map(d => d.name);
    
    // Check if the model name contains any of the user's dataset names
    const hasAccess = datasetNames.some(datasetName => 
      modelName.toLowerCase().includes(datasetName.toLowerCase())
    );

    if (!hasAccess) {
      return res.status(403).json({ 
        error: 'Access denied. This trained model does not belong to your datasets.' 
      });
    }

    // Fetch model details from worker
    const workerResponse = await fetch(`${WORKER_URL}/trained-models/${modelName}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!workerResponse.ok) {
      const errorText = await workerResponse.text();
      throw new Error(`Worker request failed: ${workerResponse.status} - ${errorText}`);
    }

    const modelDetails = await workerResponse.json();

    res.json({
      message: 'Trained model details retrieved successfully',
      model: modelDetails,
      source: 'cloudflare-worker'
    });

  } catch (error) {
    console.error('❌ Error fetching trained model details:', error);
    res.status(500).json({ 
      error: 'Failed to fetch trained model details',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET - Download trained model
router.get('/:modelName/download', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { modelName } = req.params;
    const userId = req.user!.userId;

    console.log(`⬇️ Requesting download URL for model: ${modelName} for user: ${userId}`);

    // Verify user has access to this model
    const userDatasets = await prisma.dataset.findMany({
      where: { userId },
      select: { name: true }
    });

    const datasetNames = userDatasets.map(d => d.name);
    
    const hasAccess = datasetNames.some(datasetName => 
      modelName.toLowerCase().includes(datasetName.toLowerCase())
    );

    if (!hasAccess) {
      return res.status(403).json({ 
        error: 'Access denied. This trained model does not belong to your datasets.' 
      });
    }

    // Get presigned download URL from worker
    const workerResponse = await fetch(`${WORKER_URL}/presigned-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bucket: 'trained-models',
        objectName: modelName,
        operation: 'get'
      })
    });

    if (!workerResponse.ok) {
      const errorText = await workerResponse.text();
      throw new Error(`Worker request failed: ${workerResponse.status} - ${errorText}`);
    }

    const urlResult = await workerResponse.json() as {
      url?: string;
      expiresIn?: string;
      [key: string]: any;
    };

    res.json({
      message: 'Download URL generated successfully',
      downloadUrl: urlResult.url,
      expiresIn: urlResult.expiresIn || '1 hour',
      modelName: modelName
    });

  } catch (error) {
    console.error('❌ Error generating download URL:', error);
    res.status(500).json({ 
      error: 'Failed to generate download URL',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
