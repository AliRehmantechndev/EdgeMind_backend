import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import JSZip from 'jszip';
import prisma from '../../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();

// Worker configuration
const WORKER_URL = process.env.WORKER_URL ;

// Validation middleware for starting training
const validateTraining = [
  body('projectId').isString().notEmpty().withMessage('Project ID is required'),
  body('datasetId').isString().notEmpty().withMessage('Dataset ID is required'),
  body('datasetName').isString().notEmpty().withMessage('Dataset name is required'),
  body('trainingConfig').isObject().withMessage('Training configuration is required'),
];

// Helper function to convert annotations to YOLO format
const convertToYOLOFormat = (annotations: any[], imageWidth: number, imageHeight: number, classMapping: { [key: string]: number }) => {
  return annotations.map(ann => {
    const { x, y, width, height, label } = ann.data;
    
    // Convert to YOLO format (normalized coordinates)
    const centerX = (x + width / 2) / imageWidth;
    const centerY = (y + height / 2) / imageHeight;
    const normWidth = width / imageWidth;
    const normHeight = height / imageHeight;
    
    const classId = classMapping[label] || 0;
    
    return `${classId} ${centerX.toFixed(6)} ${centerY.toFixed(6)} ${normWidth.toFixed(6)} ${normHeight.toFixed(6)}`;
  }).join('\n');
};

// Helper function to create config.yaml
const createConfigYaml = (trainingConfig: any, classNames: string[], datasetName: string, timestamp: number) => {
  // Extract values from frontend configuration with proper defaults
  const epochs = trainingConfig.epochs || 100;
  const batchSize = trainingConfig.batchSize || 16;
  const imgSize = trainingConfig.imgSize || 640;
  const learningRate = trainingConfig.learningRate || 0.001;
  const modelType = trainingConfig.modelType || 'yolov8recommended';
  const datasetSplitRatio = trainingConfig.datasetSplitRatio || '80/20';
  
  // Create project name with timestamp for uniqueness
  const projectName = `${datasetName}_Training_${timestamp}`;
  
  const config = `epochs: ${epochs}
batch_size: ${batchSize}
img_size: ${imgSize}
learning_rate: ${learningRate}
model: ${modelType}
num_classes: ${classNames.length}
class_names:
${classNames.map(name => `  - ${name}`).join('\n')}
project_name: ${projectName}
train_val_split: ${datasetSplitRatio}
`;

  return config;
};

// POST - Start training
router.post('/start', authenticateToken, validateTraining, async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { projectId, datasetId, datasetName, trainingConfig } = req.body;
    const userId = req.user!.userId;

    console.log(`🚀 Starting training for dataset: ${datasetName}`);

    // Verify user has access to project and dataset
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    const dataset = await prisma.dataset.findFirst({
      where: { id: datasetId, userId }
    });

    if (!dataset) {
      return res.status(404).json({ error: 'Dataset not found or access denied' });
    }

    // Fetch all annotations for the dataset
    const annotations = await prisma.annotation.findMany({
      where: {
        datasetId: datasetId,
      },
    });

    console.log('📋 Total annotations found:', annotations.length);
    console.log('🔍 Annotation imageIds:', annotations.map(a => ({ id: a.id, imageId: a.imageId })));
    
    if (annotations.length === 0) {
      return res.status(400).json({ error: 'No annotations found for this dataset' });
    }

    // Get annotation classes for this dataset
    const annotationClasses = await prisma.annotationClass.findMany({
      where: { datasetId, userId }
    });

    // Create class mapping
    const classNames = annotationClasses.map(cls => cls.name);
    const classMapping = annotationClasses.reduce((acc, cls, index) => {
      acc[cls.name] = index;
      return acc;
    }, {} as { [key: string]: number });

    console.log(`📊 Found ${annotations.length} annotations with ${classNames.length} classes:`, classNames);

    // Create ZIP structure with required folder hierarchy
    const zip = new JSZip();
    const timestamp = Date.now();
    
    // Create the main folder structure: datasetName_Training_timestamp/
    const mainDatasetFolder = zip.folder(`${datasetName}_Training_${timestamp}`);
    
    // Create subfolders within the main dataset folder
    const imagesFolder = mainDatasetFolder!.folder('images');
    const labelsFolder = mainDatasetFolder!.folder('labels');

    // Group annotations by image
    const annotationsByImage = annotations.reduce((acc, ann) => {
      if (!acc[ann.imageId]) {
        acc[ann.imageId] = [];
      }
      acc[ann.imageId].push(ann);
      return acc;
    }, {} as { [key: string]: any[] });

    const uniqueImageIds = Object.keys(annotationsByImage);
    console.log(`📊 Found annotations for ${uniqueImageIds.length} unique imageIds`);
    console.log(`📝 Unique imageIds with annotations: ${uniqueImageIds.join(', ')}`);

    // Get dataset path
    const datasetPath = path.join(process.cwd(), 'uploads', 'datasets', datasetId);
    console.log(`📁 Dataset path: ${datasetPath}`);

    // Get all image files in the dataset
    const datasetFiles = await fs.readdir(datasetPath);
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.bmp', '.webp'];
    const imageFiles = datasetFiles.filter(file => 
      imageExtensions.some(ext => file.toLowerCase().endsWith(ext))
    );

    console.log(`📄 Total files in dataset: ${datasetFiles.length}`);
    console.log(`🖼️ Image files found: ${imageFiles.length}`);
    console.log(`📝 Image files: ${imageFiles.join(', ')}`);

    // Map to store annotations for each matching image file
    const imageAnnotationMap = new Map<string, any[]>();
    const annotatedImageFiles: string[] = [];

    // Determine if we need to use expanded selection
    const uniqueImageIdsCount = uniqueImageIds.length;
    const shouldExpandImageSelection = uniqueImageIdsCount < 3 && imageFiles.length >= uniqueImageIdsCount * 2;

    // Group annotations by matching image files (only if not using fallback)
    if (!shouldExpandImageSelection) {
      console.log(`✅ Normal processing: Each annotation has proper imageId mapping`);
      
      for (const annotation of annotations) {
        const imageId = annotation.imageId;
        console.log(`🔍 Looking for image file matching annotation imageId: "${imageId}" (annotation ID: ${annotation.id})`);
        
        // Try to find matching image file - EXACT matching only
        const matchingImageFile = imageFiles.find(imageFile => {
          const imageNameLower = imageFile.toLowerCase();
          const imageIdLower = imageId.toLowerCase();
          
          // Check exact matching patterns only (no partial contains)
          return (
            imageId === imageFile ||                                      // Exact match: "cat.4001.jpg" === "cat.4001.jpg"
            imageIdLower === imageNameLower                               // Case insensitive exact match
          );
        });

        if (matchingImageFile) {
          console.log(`✅ Found matching image: ${matchingImageFile} for annotation imageId: ${imageId}`);
          if (!imageAnnotationMap.has(matchingImageFile)) {
            imageAnnotationMap.set(matchingImageFile, []);
            annotatedImageFiles.push(matchingImageFile);
            console.log(`📁 Added new image to processing list: ${matchingImageFile}`);
          }
          imageAnnotationMap.get(matchingImageFile)!.push(annotation);
        } else {
          console.warn(`⚠️ No matching image file found for annotation with imageId: ${imageId}`);
          console.warn(`   Available image files: ${imageFiles.slice(0, 5).join(', ')}${imageFiles.length > 5 ? '...' : ''}`);
        }
      }
    } else {
      // Fallback strategy for limited annotations
      console.log(`🔄 Using fallback strategy: Expanding selection to include more images`);
      console.log(`   Reason: Only ${uniqueImageIdsCount} unique imageIds found, but ${imageFiles.length} images available`);
      
      // Sort image files for consistent selection
      const sortedImageFiles = imageFiles.sort();
      const annotationsPerImage = Math.ceil(annotations.length / Math.min(annotations.length, sortedImageFiles.length));
      
      for (let i = 0; i < Math.min(annotations.length, sortedImageFiles.length); i++) {
        const imageFile = sortedImageFiles[i];
        const startIdx = i * annotationsPerImage;
        const endIdx = Math.min(startIdx + annotationsPerImage, annotations.length);
        const imageAnnotations = annotations.slice(startIdx, endIdx);
        
        if (imageAnnotations.length > 0) {
          imageAnnotationMap.set(imageFile, imageAnnotations);
          annotatedImageFiles.push(imageFile);
          console.log(`📁 Fallback: Assigned ${imageAnnotations.length} annotations to ${imageFile}`);
        }
      }
    }

    console.log(`📊 Final Summary:`);
    console.log(`   Total annotations: ${annotations.length}`);
    console.log(`   Total image files: ${imageFiles.length}`);
    console.log(`   Matched annotated images: ${annotatedImageFiles.length}`);
    console.log(`   Annotated images: ${annotatedImageFiles.join(', ')}`);

    if (annotatedImageFiles.length === 0) {
      return res.status(400).json({ 
        error: 'No images could be matched with annotations. Please check your annotation imageId values match actual image filenames.',
        debug: {
          availableImages: imageFiles.slice(0, 10),
          annotationImageIds: uniqueImageIds
        }
      });
    }

    console.log(`🖼️ Processing ${annotatedImageFiles.length} annotated images (out of ${uniqueImageIds.length} with annotations)`);
    console.log(`📝 Annotated image files: ${JSON.stringify(annotatedImageFiles, null, 2)}`);
    console.log(`🏷️ Total annotations: ${annotations.length}`);
    console.log(`🆔 Annotation imageIds: ${JSON.stringify(annotations.map(a => a.imageId), null, 2)}`);
    console.log(`📋 All annotations details:`);
    annotations.forEach((ann, index) => {
      console.log(`   ${index + 1}. ID: ${ann.id}, ImageId: "${ann.imageId}", ClassId: ${ann.classId}`);
    });

    // Process each annotated image
    console.log(`🔄 Starting to process ${annotatedImageFiles.length} images...`);
    
    for (const imageFile of annotatedImageFiles) {
      const imageAnnotations = imageAnnotationMap.get(imageFile) || [];
      console.log(`🔍 Processing image: ${imageFile}`);
      console.log(`   Found ${imageAnnotations.length} annotations for ${imageFile}`);
      console.log(`   Annotation IDs: ${imageAnnotations.map(a => a.id).join(', ')}`);

      const imagePath = path.join(datasetPath, imageFile);
      console.log(`📂 Reading image from: ${imagePath}`);

      try {
        // Check if file exists
        await fs.access(imagePath);
        console.log(`✅ File exists: ${imageFile}`);
        
        const imageBuffer = await fs.readFile(imagePath);
        console.log(`📊 Image buffer size: ${imageBuffer.length} bytes`);
        
        // Add image to ZIP
        imagesFolder!.file(imageFile, imageBuffer);

        // Convert annotations to YOLO format
        const yoloAnnotations = imageAnnotations.map(ann => {
          const { x, y, width, height, label } = ann.data;
          
          // For now, assume standard image dimensions or get from image metadata
          // You might want to get actual image dimensions here
          const imageWidth = 640; // Default - you should get actual width
          const imageHeight = 640; // Default - you should get actual height
          
          const centerX = (x + width / 2) / imageWidth;
          const centerY = (y + height / 2) / imageHeight;
          const normWidth = width / imageWidth;
          const normHeight = height / imageHeight;
          
          const classId = classMapping[label] || 0;
          
          return `${classId} ${centerX.toFixed(6)} ${centerY.toFixed(6)} ${normWidth.toFixed(6)} ${normHeight.toFixed(6)}`;
        }).join('\n');

        // Add label file to ZIP
        const labelFileName = imageFile.replace(/\.[^/.]+$/, '.txt');
        labelsFolder!.file(labelFileName, yoloAnnotations);

        console.log(`✅ Added image: ${imageFile} with ${imageAnnotations.length} annotations`);
      } catch (error) {
        console.error(`❌ Error processing image ${imageFile}:`, error);
        continue;
      }
    }

    // Add config.yaml to the main dataset folder
    const configYaml = createConfigYaml(trainingConfig, classNames, datasetName, timestamp);
    mainDatasetFolder!.file('config.yaml', configYaml);

    console.log(`📦 Creating ZIP with folder structure: ${datasetName}_Training_${timestamp}/`);
    console.log(`📂 Contains: config.yaml, images/ (${annotatedImageFiles.length} files), labels/ (${annotatedImageFiles.length} files)`);

    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // Upload to MinIO through Cloudflare Worker
    const uploadPath = `${userId}/${datasetName}_${timestamp}`;
    
    console.log(`📤 Uploading dataset to MinIO through Cloudflare Worker at: ${WORKER_URL}`);
    console.log(`📂 Upload path: ${uploadPath}`);

    try {
      // Create FormData for worker upload  
      const formData = new FormData();
      
      // Create a Blob from the buffer for proper file upload
      const zipBlob = new Blob([zipBuffer], { type: 'application/zip' });
      formData.append('file', zipBlob, `${uploadPath}.zip`);
      formData.append('uploadPath', uploadPath);
      formData.append('bucket', 'datasets');
      formData.append('autoStartTraining', 'true'); // Auto-start RunPod pod after upload
      formData.append('trainingConfig', JSON.stringify(trainingConfig));

      console.log(`🌐 Calling worker endpoint: ${WORKER_URL}/upload-dataset`);
      
      // Upload through worker
      const uploadResponse = await fetch(`${WORKER_URL}/upload-dataset`, {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`Worker upload failed: ${uploadResponse.status} - ${errorText}`);
      }

      const uploadResult = await uploadResponse.json() as {
        success: boolean;
        fileName: string;
        presignedUrl: string;
        bucket: string;
        uploadPath: string;
      };

      if (!uploadResult.success) {
        throw new Error('Worker upload failed: No success flag in response');
      }

      console.log(`✅ Successfully uploaded dataset through worker: ${uploadResult.fileName}`);

      const trainingId = `training_${timestamp}`;

      res.json({
        message: 'Training dataset uploaded successfully through worker',
        trainingId,
        objectName: uploadResult.fileName,
        bucketName: uploadResult.bucket,
        downloadUrl: uploadResult.presignedUrl,
        downloadUrlExpiresIn: '7 days',
        totalAnnotatedImages: annotatedImageFiles.length,
        totalAnnotations: annotations.length,
        classNames,
        trainingConfig,
        uploadPath: uploadResult.uploadPath
      });

    } catch (uploadError) {
      console.error('❌ Error uploading through worker:', uploadError);
      return res.status(500).json({ 
        error: 'Failed to upload dataset through worker',
        details: uploadError instanceof Error ? uploadError.message : 'Unknown error'
      });
    }

  } catch (error) {
    console.error('❌ Error starting training:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST - Start training on RunPod through worker
router.post('/start-runpod', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { datasetUrl, trainingConfig, datasetName } = req.body;

    if (!datasetUrl) {
      return res.status(400).json({ error: 'Dataset URL is required' });
    }

    console.log(`🚀 Starting RunPod training through worker for dataset: ${datasetName}`);

    // Start training through worker
    const trainingResponse = await fetch(`${WORKER_URL}/start-training`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        datasetZip: null, // We'll use the URL instead
        datasetName: datasetName || 'training-dataset',
        trainingConfig: trainingConfig || {}
      })
    });

    if (!trainingResponse.ok) {
      const errorText = await trainingResponse.text();
      throw new Error(`Worker training start failed: ${trainingResponse.status} - ${errorText}`);
    }

    const trainingResult = await trainingResponse.json() as {
      success: boolean;
      trainingId: string;
      podId: string;
      status: string;
      message: string;
    };

    if (!trainingResult.success) {
      throw new Error('Worker training start failed: No success flag in response');
    }

    console.log(`✅ Successfully started training through worker: ${trainingResult.trainingId}`);

    res.json({
      message: 'Training started successfully through worker',
      trainingId: trainingResult.trainingId,
      podId: trainingResult.podId,
      status: trainingResult.status,
      workerMessage: trainingResult.message
    });

  } catch (error) {
    console.error('❌ Error starting training through worker:', error);
    res.status(500).json({ 
      error: 'Failed to start training through worker',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET - Check training status through worker
router.get('/status/:trainingId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { trainingId } = req.params;

    if (!trainingId) {
      return res.status(400).json({ error: 'Training ID is required' });
    }

    console.log(`📊 Checking training status through worker: ${trainingId}`);

    // Check status through worker
    const statusResponse = await fetch(`${WORKER_URL}/training-status?id=${trainingId}`, {
      method: 'GET'
    });

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      throw new Error(`Worker status check failed: ${statusResponse.status} - ${errorText}`);
    }

    const statusResult = await statusResponse.json();

    console.log(`📈 Training status for ${trainingId}:`, statusResult);

    res.json(statusResult);

  } catch (error) {
    console.error('❌ Error checking training status through worker:', error);
    res.status(500).json({ 
      error: 'Failed to check training status through worker',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST - Export dataset directly to worker (pure proxy)
router.post('/export-to-worker', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { datasetZip, datasetName, uploadPath, trainingConfig } = req.body;
    const userId = req.user!.userId;

    if (!datasetZip || !datasetName) {
      return res.status(400).json({ error: 'Dataset ZIP and name are required' });
    }

    console.log(`🚀 Direct export to worker: ${WORKER_URL}/upload-dataset`);
    console.log(`📂 Dataset: ${datasetName}, Path: ${uploadPath}`);

    // Create FormData for worker upload
    const formData = new FormData();
    
    // Convert base64 or buffer to Blob
    let zipBlob;
    if (typeof datasetZip === 'string') {
      // If it's base64
      const buffer = Buffer.from(datasetZip, 'base64');
      zipBlob = new Blob([buffer], { type: 'application/zip' });
    } else {
      // If it's already a buffer or array buffer
      zipBlob = new Blob([datasetZip], { type: 'application/zip' });
    }

    const finalUploadPath = uploadPath || `${userId}/${datasetName}_${Date.now()}`;
    
    formData.append('file', zipBlob, `${finalUploadPath}.zip`);
    formData.append('uploadPath', finalUploadPath);
    formData.append('bucket', 'datasets');
    formData.append('autoStartTraining', 'false');
    formData.append('trainingConfig', JSON.stringify(trainingConfig || {}));

    // Direct call to worker
    const workerResponse = await fetch(`${WORKER_URL}/upload-dataset`, {
      method: 'POST',
      body: formData
    });

    if (!workerResponse.ok) {
      const errorText = await workerResponse.text();
      throw new Error(`Worker error: ${workerResponse.status} - ${errorText}`);
    }

    const workerResult = await workerResponse.json() as any;

    console.log(`✅ Worker upload successful: ${workerResult.fileName}`);

    // Return worker response directly
    res.json({
      message: 'Dataset exported to MinIO via worker successfully',
      source: 'cloudflare-worker',
      workerUrl: WORKER_URL,
      ...workerResult
    });

  } catch (error) {
    console.error('❌ Worker export error:', error);
    res.status(500).json({ 
      error: 'Failed to export to worker',
      details: error instanceof Error ? error.message : 'Unknown error',
      workerUrl: WORKER_URL
    });
  }
});

export default router;