/*
  Warnings:

  - You are about to drop the `Annotation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AnnotationClass` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Dataset` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DatasetFile` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LocalTrainedModel` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MLDataset` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Project` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RunPodTrainingJob` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_ProjectDatasets` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Annotation" DROP CONSTRAINT "Annotation_userId_fkey";

-- DropForeignKey
ALTER TABLE "AnnotationClass" DROP CONSTRAINT "AnnotationClass_userId_fkey";

-- DropForeignKey
ALTER TABLE "Dataset" DROP CONSTRAINT "Dataset_uploadedBy_fkey";

-- DropForeignKey
ALTER TABLE "DatasetFile" DROP CONSTRAINT "DatasetFile_datasetId_fkey";

-- DropForeignKey
ALTER TABLE "MLDataset" DROP CONSTRAINT "MLDataset_userId_fkey";

-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_createdBy_fkey";

-- DropForeignKey
ALTER TABLE "RunPodTrainingJob" DROP CONSTRAINT "RunPodTrainingJob_mlDatasetId_fkey";

-- DropForeignKey
ALTER TABLE "_ProjectDatasets" DROP CONSTRAINT "_ProjectDatasets_A_fkey";

-- DropForeignKey
ALTER TABLE "_ProjectDatasets" DROP CONSTRAINT "_ProjectDatasets_B_fkey";

-- DropTable
DROP TABLE "Annotation";

-- DropTable
DROP TABLE "AnnotationClass";

-- DropTable
DROP TABLE "Dataset";

-- DropTable
DROP TABLE "DatasetFile";

-- DropTable
DROP TABLE "LocalTrainedModel";

-- DropTable
DROP TABLE "MLDataset";

-- DropTable
DROP TABLE "Project";

-- DropTable
DROP TABLE "RunPodTrainingJob";

-- DropTable
DROP TABLE "User";

-- DropTable
DROP TABLE "_ProjectDatasets";

-- DropEnum
DROP TYPE "DatasetStatus";

-- DropEnum
DROP TYPE "DatasetType";

-- DropEnum
DROP TYPE "LocalModelStatus";

-- DropEnum
DROP TYPE "MLDatasetStatus";

-- DropEnum
DROP TYPE "ProjectStatus";

-- DropEnum
DROP TYPE "ProjectType";

-- DropEnum
DROP TYPE "TrainingJobStatus";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fullName" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "annotationGroup" TEXT,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "projectType" TEXT NOT NULL DEFAULT 'object_detection',

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "datasets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalSize" BIGINT NOT NULL DEFAULT 0,
    "totalFiles" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "uploadType" TEXT NOT NULL DEFAULT 'individual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "datasets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "annotation_classes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "annotation_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "annotations" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "annotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dataset_images" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "size" BIGINT NOT NULL DEFAULT 0,
    "mimeType" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dataset_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_runs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "datasetName" TEXT NOT NULL,
    "modelType" TEXT NOT NULL,
    "epochs" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "progress" DOUBLE PRECISION DEFAULT 0,
    "currentEpoch" INTEGER DEFAULT 0,
    "zipPath" TEXT,
    "metrics" JSONB,
    "config" JSONB,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "annotation_classes_name_datasetId_key" ON "annotation_classes"("name", "datasetId");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annotation_classes" ADD CONSTRAINT "annotation_classes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annotation_classes" ADD CONSTRAINT "annotation_classes_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_classId_fkey" FOREIGN KEY ("classId") REFERENCES "annotation_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dataset_images" ADD CONSTRAINT "dataset_images_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dataset_images" ADD CONSTRAINT "dataset_images_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_runs" ADD CONSTRAINT "training_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_runs" ADD CONSTRAINT "training_runs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_runs" ADD CONSTRAINT "training_runs_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
