-- CreateTable
CREATE TABLE "TrafficSnapshot" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "employeeId" TEXT,
    "alias" TEXT,
    "pagePath" TEXT NOT NULL,
    "pageTitle" TEXT,
    "date" DATE NOT NULL,
    "activeUsers" INTEGER NOT NULL DEFAULT 0,
    "sessions" INTEGER NOT NULL DEFAULT 0,
    "pageViews" INTEGER NOT NULL DEFAULT 0,
    "engagementTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrafficSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentTrend" (
    "id" TEXT NOT NULL,
    "topicKeyword" TEXT NOT NULL,
    "propertyId" TEXT,
    "growthRate" DOUBLE PRECISION NOT NULL,
    "momentumScore" DOUBLE PRECISION NOT NULL,
    "relatedPages" JSONB,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weekStart" DATE NOT NULL,
    "weekEnd" DATE NOT NULL,

    CONSTRAINT "ContentTrend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeePerformanceHistory" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "weekEnd" DATE NOT NULL,
    "totalViews" INTEGER NOT NULL DEFAULT 0,
    "totalUsers" INTEGER NOT NULL DEFAULT 0,
    "trendScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeePerformanceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIContentRecommendation" (
    "id" TEXT NOT NULL,
    "suggestedTitle" TEXT NOT NULL,
    "suggestedTopic" TEXT NOT NULL,
    "basedOnKeyword" TEXT NOT NULL,
    "targetEmployee" TEXT,
    "targetPropertyId" TEXT,
    "suggestedPublishTime" TIMESTAMP(3),
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "suggestedOutline" JSONB,
    "suggestedKeywords" JSONB,
    "metaDescription" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIContentRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReaderBehaviorPattern" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "hour" INTEGER NOT NULL,
    "dayOfWeek" INTEGER,
    "avgSessions" DOUBLE PRECISION NOT NULL,
    "bestCategory" TEXT,
    "bounceRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgScrollDepth" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgEngagementTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReaderBehaviorPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicCluster" (
    "id" TEXT NOT NULL,
    "clusterName" TEXT NOT NULL,
    "keywords" JSONB NOT NULL,
    "pagePaths" JSONB NOT NULL,
    "propertyId" TEXT,
    "totalViews" INTEGER NOT NULL DEFAULT 0,
    "growthRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopicCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrendAlert" (
    "id" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "propertyId" TEXT,
    "employeeId" TEXT,
    "pagePath" TEXT,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "metadata" JSONB,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrendAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrafficSnapshot_propertyId_date_idx" ON "TrafficSnapshot"("propertyId", "date");

-- CreateIndex
CREATE INDEX "TrafficSnapshot_employeeId_date_idx" ON "TrafficSnapshot"("employeeId", "date");

-- CreateIndex
CREATE INDEX "TrafficSnapshot_alias_date_idx" ON "TrafficSnapshot"("alias", "date");

-- CreateIndex
CREATE INDEX "TrafficSnapshot_pagePath_date_idx" ON "TrafficSnapshot"("pagePath", "date");

-- CreateIndex
CREATE UNIQUE INDEX "TrafficSnapshot_propertyId_employeeId_alias_pagePath_date_key" ON "TrafficSnapshot"("propertyId", "employeeId", "alias", "pagePath", "date");

-- CreateIndex
CREATE INDEX "ContentTrend_topicKeyword_detectedAt_idx" ON "ContentTrend"("topicKeyword", "detectedAt");

-- CreateIndex
CREATE INDEX "ContentTrend_propertyId_detectedAt_idx" ON "ContentTrend"("propertyId", "detectedAt");

-- CreateIndex
CREATE INDEX "EmployeePerformanceHistory_employeeId_weekStart_idx" ON "EmployeePerformanceHistory"("employeeId", "weekStart");

-- CreateIndex
CREATE INDEX "EmployeePerformanceHistory_propertyId_weekStart_idx" ON "EmployeePerformanceHistory"("propertyId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeePerformanceHistory_employeeId_propertyId_weekStart_key" ON "EmployeePerformanceHistory"("employeeId", "propertyId", "weekStart");

-- CreateIndex
CREATE INDEX "AIContentRecommendation_targetEmployee_createdAt_idx" ON "AIContentRecommendation"("targetEmployee", "createdAt");

-- CreateIndex
CREATE INDEX "AIContentRecommendation_targetPropertyId_createdAt_idx" ON "AIContentRecommendation"("targetPropertyId", "createdAt");

-- CreateIndex
CREATE INDEX "AIContentRecommendation_basedOnKeyword_idx" ON "AIContentRecommendation"("basedOnKeyword");

-- CreateIndex
CREATE INDEX "ReaderBehaviorPattern_propertyId_hour_idx" ON "ReaderBehaviorPattern"("propertyId", "hour");

-- CreateIndex
CREATE UNIQUE INDEX "ReaderBehaviorPattern_propertyId_hour_periodStart_key" ON "ReaderBehaviorPattern"("propertyId", "hour", "periodStart");

-- CreateIndex
CREATE INDEX "TopicCluster_clusterName_detectedAt_idx" ON "TopicCluster"("clusterName", "detectedAt");

-- CreateIndex
CREATE INDEX "TopicCluster_propertyId_detectedAt_idx" ON "TopicCluster"("propertyId", "detectedAt");

-- CreateIndex
CREATE INDEX "TrendAlert_alertType_createdAt_idx" ON "TrendAlert"("alertType", "createdAt");

-- CreateIndex
CREATE INDEX "TrendAlert_propertyId_createdAt_idx" ON "TrendAlert"("propertyId", "createdAt");

-- CreateIndex
CREATE INDEX "TrendAlert_acknowledged_idx" ON "TrendAlert"("acknowledged");
