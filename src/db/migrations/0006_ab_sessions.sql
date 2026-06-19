CREATE TABLE IF NOT EXISTS "ab_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "experiment_id" uuid NOT NULL REFERENCES "ab_experiments"("id") ON DELETE CASCADE,
  "variant_id" uuid NOT NULL REFERENCES "ab_variants"("id") ON DELETE CASCADE,
  "visitor_id" varchar(255) NOT NULL,
  "is_new_visitor" varchar(1) NOT NULL DEFAULT '1',
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ab_sessions_exp_idx" ON "ab_sessions" ("experiment_id", "created_at");
