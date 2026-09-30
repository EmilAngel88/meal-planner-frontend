-- Feedback access is an explicit capability, independent of broader account roles.
ALTER TABLE "User" ADD COLUMN "canManageFeedback" BOOLEAN NOT NULL DEFAULT false;
