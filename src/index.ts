import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './api/routes/auth';
import projectRoutes from './api/routes/projects';
import datasetRoutes from './api/routes/datasets';
import annotationRoutes from './api/routes/annotations';
import annotationClassRoutes from './api/routes/annotationClasses';
import annotationExportRoutes from './api/routes/annotationExport';
import trainingRoutes from './api/routes/training';
import trainedModelsRoutes from './api/routes/trainedModels';

// Fix BigInt JSON serialization
(BigInt.prototype as any).toJSON = function() {
  return Number(this);
};

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/datasets', datasetRoutes);
app.use('/api/annotations', annotationRoutes);
app.use('/api/annotation-classes', annotationClassRoutes);
app.use('/api/annotations/export', annotationExportRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/trained-models', trainedModelsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ message: 'Edge Mind API is running!' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
