-- AddSystemConfigurationAndAuditIndexes
-- Add SystemConfiguration model and enhance AuditLog indexes

-- Create SystemConfiguration table
CREATE TABLE IF NOT EXISTS "system_configurations" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "schema" TEXT,
    "updated_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_configurations_pkey" PRIMARY KEY ("id")
);

-- Create unique index on key
CREATE UNIQUE INDEX IF NOT EXISTS "system_configurations_key_key" ON "system_configurations"("key");

-- Create index on updated_at for querying recent changes
CREATE INDEX IF NOT EXISTS "system_configurations_updated_at_idx" ON "system_configurations"("updated_at");

-- Add foreign key constraint for updated_by
ALTER TABLE "system_configurations" ADD CONSTRAINT "system_configurations_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add composite index on AuditLog for targetEntity + targetId (if not exists)
CREATE INDEX IF NOT EXISTS "audit_logs_affected_entity_type_affected_entity_id_idx" ON "audit_logs"("affected_entity_type", "affected_entity_id");
