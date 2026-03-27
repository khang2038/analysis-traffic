-- CreateTable
CREATE TABLE "LeaderboardCache" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL DEFAULT 'all',
    "mode" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "orderMetric" TEXT NOT NULL DEFAULT 'screenPageViews',
    "chunkIndex" INTEGER NOT NULL DEFAULT 0,
    "data" JSONB NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaderboardCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeaderboardCache_propertyId_mode_idx" ON "LeaderboardCache"("propertyId", "mode");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardCache_propertyId_mode_startDate_endDate_orderMet_key" ON "LeaderboardCache"("propertyId", "mode", "startDate", "endDate", "orderMetric", "chunkIndex");
