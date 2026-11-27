CREATE TABLE "BatchPhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "BatchPhoto_batchId_createdAt_idx" ON "BatchPhoto"("batchId", "createdAt");
