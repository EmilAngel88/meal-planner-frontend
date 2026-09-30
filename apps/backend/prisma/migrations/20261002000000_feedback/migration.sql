CREATE TYPE "FeedbackCategory" AS ENUM ('bug', 'idea', 'other');
CREATE TYPE "FeedbackStatus" AS ENUM ('new', 'planned', 'in_progress', 'done', 'closed');
CREATE TYPE "FeedbackDeviceType" AS ENUM ('mobile', 'tablet', 'desktop');

CREATE TABLE "Feedback" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "requestId" UUID NOT NULL,
    "category" "FeedbackCategory" NOT NULL,
    "message" VARCHAR(4000) NOT NULL,
    "pagePath" VARCHAR(64),
    "deviceType" "FeedbackDeviceType",
    "status" "FeedbackStatus" NOT NULL DEFAULT 'new',
    "reply" VARCHAR(2000) NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Feedback_userId_requestId_key" ON "Feedback"("userId", "requestId");
CREATE INDEX "Feedback_userId_id_idx" ON "Feedback"("userId", "id");
CREATE INDEX "Feedback_userId_createdAt_idx" ON "Feedback"("userId", "createdAt");
CREATE INDEX "Feedback_status_id_idx" ON "Feedback"("status", "id");
CREATE INDEX "Feedback_category_id_idx" ON "Feedback"("category", "id");
