-- AddAccountLockoutFields
-- Add account lockout tracking fields to users table

-- Add columns for tracking failed login attempts and lockout
ALTER TABLE "users" ADD COLUMN "failed_login_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "locked_until" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "last_failed_login_at" TIMESTAMP(3);

-- Create index for efficient lockout queries
CREATE INDEX "users_locked_until_idx" ON "users"("locked_until");
