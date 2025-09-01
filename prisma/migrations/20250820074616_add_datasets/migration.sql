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

-- AddForeignKey
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
