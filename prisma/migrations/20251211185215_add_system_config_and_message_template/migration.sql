-- CreateTable
CREATE TABLE IF NOT EXISTS "system_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "description" VARCHAR(500),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" VARCHAR(100),

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "message_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "content" TEXT NOT NULL,
    "description" VARCHAR(500),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" VARCHAR(100),

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "system_configs_key_key" ON "system_configs"("key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "system_configs_updated_at_idx" ON "system_configs"("updated_at");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "message_templates_name_key" ON "message_templates"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "message_templates_updated_at_idx" ON "message_templates"("updated_at");
