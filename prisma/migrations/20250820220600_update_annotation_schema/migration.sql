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

-- CreateIndex
CREATE UNIQUE INDEX "annotation_classes_name_datasetId_key" ON "annotation_classes"("name", "datasetId");

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
