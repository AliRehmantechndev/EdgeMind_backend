/*
  Warnings:

  - You are about to drop the `annotation_classes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `annotations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `datasets` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `projects` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `users` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "DatasetType" AS ENUM ('image', 'video', 'text', 'csv', 'json', 'zip', 'other', 'folder');

-- CreateEnum
CREATE TYPE "DatasetStatus" AS ENUM ('uploading', 'ready', 'processing', 'failed');

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('object_detection', 'classification');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('draft', 'active', 'completed', 'archived');

-- CreateEnum
CREATE TYPE "MLDatasetStatus" AS ENUM ('preparing', 'ready', 'training', 'completed', 'error');

-- CreateEnum
CREATE TYPE "LocalModelStatus" AS ENUM ('downloading', 'completed', 'failed', 'missing');

-- CreateEnum
CREATE TYPE "TrainingJobStatus" AS ENUM ('pending', 'uploading', 'starting', 'running', 'completing', 'completed', 'failed', 'cancelled', 'timeout');

-- DropForeignKey
ALTER TABLE "annotation_classes" DROP CONSTRAINT "annotation_classes_datasetId_fkey";

-- DropForeignKey
ALTER TABLE "annotation_classes" DROP CONSTRAINT "annotation_classes_userId_fkey";

-- DropForeignKey
ALTER TABLE "annotations" DROP CONSTRAINT "annotations_classId_fkey";

-- DropForeignKey
ALTER TABLE "annotations" DROP CONSTRAINT "annotations_datasetId_fkey";

-- DropForeignKey
ALTER TABLE "annotations" DROP CONSTRAINT "annotations_userId_fkey";

-- DropForeignKey
ALTER TABLE "datasets" DROP CONSTRAINT "datasets_projectId_fkey";

-- DropForeignKey
ALTER TABLE "datasets" DROP CONSTRAINT "datasets_userId_fkey";

-- DropForeignKey
ALTER TABLE "projects" DROP CONSTRAINT "projects_userId_fkey";

-- DropTable
DROP TABLE "annotation_classes";

-- DropTable
DROP TABLE "annotations";

-- DropTable
DROP TABLE "datasets";

-- DropTable
DROP TABLE "projects";

-- DropTable
DROP TABLE "users";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dataset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DatasetType" NOT NULL,
    "size" INTEGER NOT NULL,
    "items" INTEGER NOT NULL,
    "status" "DatasetStatus" NOT NULL DEFAULT 'uploading',
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasetFile" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "originalPath" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "type" "DatasetType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DatasetFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "annotationGroup" TEXT NOT NULL,
    "projectType" "ProjectType" NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastModified" TIMESTAMP(3) NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'draft',
    "settings" JSONB NOT NULL,
    "license" TEXT,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnotationClass" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "classes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnotationClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Annotation" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "annotations" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Annotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MLDataset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "basePath" TEXT NOT NULL,
    "imagesPath" TEXT NOT NULL,
    "labelsPath" TEXT NOT NULL,
    "configPath" TEXT NOT NULL,
    "status" "MLDatasetStatus" NOT NULL DEFAULT 'preparing',
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MLDataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalTrainedModel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "originalModelId" TEXT NOT NULL,
    "modelType" TEXT NOT NULL,
    "dataset" TEXT NOT NULL,
    "epochs" INTEGER NOT NULL,
    "metrics" JSONB,
    "filePath" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "checksum" TEXT NOT NULL,
    "status" "LocalModelStatus" NOT NULL DEFAULT 'downloading',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "downloadedAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "LocalTrainedModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunPodTrainingJob" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "mlDatasetId" TEXT NOT NULL,
    "podId" TEXT,
    "runpodJobId" TEXT,
    "status" "TrainingJobStatus" NOT NULL DEFAULT 'pending',
    "modelName" TEXT NOT NULL,
    "epochs" INTEGER NOT NULL DEFAULT 30,
    "batchSize" INTEGER NOT NULL DEFAULT 8,
    "learningRate" DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    "modelType" TEXT NOT NULL DEFAULT 'yolov5s',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "modelUrl" TEXT,
    "downloadUrl" TEXT,
    "logs" TEXT,
    "errorMessage" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "estimatedTime" INTEGER,
    "actualTime" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RunPodTrainingJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ProjectDatasets" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AnnotationClass_userId_key" ON "AnnotationClass"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LocalTrainedModel_originalModelId_key" ON "LocalTrainedModel"("originalModelId");

-- CreateIndex
CREATE INDEX "LocalTrainedModel_originalModelId_idx" ON "LocalTrainedModel"("originalModelId");

-- CreateIndex
CREATE INDEX "LocalTrainedModel_status_idx" ON "LocalTrainedModel"("status");

-- CreateIndex
CREATE INDEX "RunPodTrainingJob_mlDatasetId_idx" ON "RunPodTrainingJob"("mlDatasetId");

-- CreateIndex
CREATE INDEX "RunPodTrainingJob_podId_idx" ON "RunPodTrainingJob"("podId");

-- CreateIndex
CREATE INDEX "RunPodTrainingJob_runpodJobId_idx" ON "RunPodTrainingJob"("runpodJobId");

-- CreateIndex
CREATE INDEX "RunPodTrainingJob_status_idx" ON "RunPodTrainingJob"("status");

-- CreateIndex
CREATE UNIQUE INDEX "_ProjectDatasets_AB_unique" ON "_ProjectDatasets"("A", "B");

-- CreateIndex
CREATE INDEX "_ProjectDatasets_B_index" ON "_ProjectDatasets"("B");

-- AddForeignKey
ALTER TABLE "Dataset" ADD CONSTRAINT "Dataset_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetFile" ADD CONSTRAINT "DatasetFile_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnotationClass" ADD CONSTRAINT "AnnotationClass_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Annotation" ADD CONSTRAINT "Annotation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MLDataset" ADD CONSTRAINT "MLDataset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunPodTrainingJob" ADD CONSTRAINT "RunPodTrainingJob_mlDatasetId_fkey" FOREIGN KEY ("mlDatasetId") REFERENCES "MLDataset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProjectDatasets" ADD CONSTRAINT "_ProjectDatasets_A_fkey" FOREIGN KEY ("A") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProjectDatasets" ADD CONSTRAINT "_ProjectDatasets_B_fkey" FOREIGN KEY ("B") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
