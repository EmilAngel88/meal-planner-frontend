-- Keep existing goals intact. Known calorie targets do not require demographics.
ALTER TABLE "Profile" ALTER COLUMN "age" DROP NOT NULL,
    ALTER COLUMN "gender" DROP NOT NULL,
    ALTER COLUMN "height" DROP NOT NULL,
    ALTER COLUMN "activity" DROP NOT NULL,
    ADD COLUMN "goalSetup" JSONB;
