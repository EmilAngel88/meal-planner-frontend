ALTER TABLE "User" ADD COLUMN "canManageBilling" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "BillingSettings" (
  "id" INTEGER NOT NULL DEFAULT 1 PRIMARY KEY CHECK ("id" = 1),
  "version" INTEGER NOT NULL DEFAULT 1,
  "config" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "BillingAudit" (
  "id" SERIAL PRIMARY KEY, "actorId" INTEGER NOT NULL, "action" TEXT NOT NULL,
  "details" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "BillingTrial" (
  "userId" INTEGER PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3) NOT NULL, "limit" INTEGER NOT NULL CHECK ("limit" > 0)
);
CREATE TABLE "BillingOrder" (
  "id" UUID PRIMARY KEY, "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "requestId" UUID NOT NULL, "offerId" TEXT NOT NULL, "name" TEXT NOT NULL,
  "days" INTEGER NOT NULL CHECK ("days" > 0), "limit" INTEGER NOT NULL CHECK ("limit" > 0),
  "amountMinor" INTEGER NOT NULL CHECK ("amountMinor" > 0), "currency" TEXT NOT NULL DEFAULT 'RUB',
  "configVersion" INTEGER NOT NULL, "status" TEXT NOT NULL DEFAULT 'pending',
  "providerMode" TEXT NOT NULL, "merchantId" TEXT NOT NULL, "providerPaymentId" TEXT,
  "providerRequest" JSONB NOT NULL, "confirmationUrl" TEXT, "refundedMinor" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "paidAt" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "BillingOrder_userId_requestId_key" ON "BillingOrder"("userId", "requestId");
CREATE UNIQUE INDEX "BillingOrder_providerPaymentId_key" ON "BillingOrder"("providerPaymentId");
CREATE INDEX "BillingOrder_userId_createdAt_idx" ON "BillingOrder"("userId", "createdAt");
CREATE INDEX "BillingOrder_status_createdAt_idx" ON "BillingOrder"("status", "createdAt");
CREATE TABLE "BillingGrant" (
  "id" UUID PRIMARY KEY, "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "orderId" UUID REFERENCES "BillingOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE, "source" TEXT NOT NULL, "name" TEXT NOT NULL,
  "limit" INTEGER NOT NULL CHECK ("limit" > 0), "startsAt" TIMESTAMP(3) NOT NULL, "endsAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "BillingGrant_orderId_key" ON "BillingGrant"("orderId");
CREATE INDEX "BillingGrant_userId_endsAt_idx" ON "BillingGrant"("userId", "endsAt");
CREATE TABLE "BillingUsage" (
  "id" SERIAL PRIMARY KEY, "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "bucket" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "BillingUsage_userId_bucket_idx" ON "BillingUsage"("userId", "bucket");
