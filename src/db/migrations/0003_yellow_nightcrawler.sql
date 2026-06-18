CREATE TABLE "ab_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"org_id" uuid NOT NULL,
	"role" varchar(20) DEFAULT 'admin' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ab_memberships_user_org_unique" UNIQUE("user_id","org_id")
);
--> statement-breakpoint
CREATE TABLE "ab_organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ab_organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "ab_experiments" DROP CONSTRAINT IF EXISTS "ab_experiments_slug_unique";--> statement-breakpoint
ALTER TABLE "ab_memberships" ADD CONSTRAINT "ab_memberships_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ab_memberships" ADD CONSTRAINT "ab_memberships_org_id_ab_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."ab_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Add org_id as nullable first so existing rows don't break
ALTER TABLE "ab_experiments" ADD COLUMN "org_id" uuid;
--> statement-breakpoint
-- Seed the Alexia org
INSERT INTO "ab_organizations" ("id", "name", "slug", "created_at")
VALUES ('11111111-0000-0000-0000-000000000001', 'Alexia Duarte', 'alexia', NOW())
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- Seed Lucas as admin of Alexia's org (takes the first user in the table)
INSERT INTO "ab_memberships" ("id", "user_id", "org_id", "role", "created_at")
SELECT gen_random_uuid(), u.id, '11111111-0000-0000-0000-000000000001', 'admin', NOW()
FROM "user" u
LIMIT 1
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- Assign all existing experiments to Alexia's org
UPDATE "ab_experiments" SET "org_id" = '11111111-0000-0000-0000-000000000001';
--> statement-breakpoint
-- Now make org_id NOT NULL and add FK + indexes
ALTER TABLE "ab_experiments" ALTER COLUMN "org_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ab_experiments" ADD CONSTRAINT "ab_experiments_org_id_ab_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."ab_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ab_exp_org_idx" ON "ab_experiments" USING btree ("org_id");--> statement-breakpoint
ALTER TABLE "ab_experiments" ADD CONSTRAINT "ab_exp_slug_org_unique" UNIQUE("org_id","slug");
