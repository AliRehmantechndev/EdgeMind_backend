-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "annotationGroup" TEXT,
ADD COLUMN     "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "projectType" TEXT NOT NULL DEFAULT 'object_detection';
