ALTER TABLE "assistant_runs" ADD COLUMN IF NOT EXISTS "squad_cap" integer DEFAULT 25 NOT NULL;
