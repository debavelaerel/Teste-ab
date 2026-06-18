ALTER TABLE "ab_experiments" ADD COLUMN "checkout_type" varchar(20) DEFAULT 'kiwify' NOT NULL;
--> statement-breakpoint
ALTER TABLE "ab_conversions" ADD COLUMN "external_order_id" varchar(255);
--> statement-breakpoint
UPDATE "ab_conversions" SET "external_order_id" = "kiwify_order_id";
--> statement-breakpoint
ALTER TABLE "ab_conversions" ALTER COLUMN "external_order_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "ab_conversions" ADD COLUMN "source" varchar(20) DEFAULT 'kiwify' NOT NULL;
--> statement-breakpoint
ALTER TABLE "ab_conversions" DROP CONSTRAINT IF EXISTS "ab_conversions_kiwify_order_id_unique";
--> statement-breakpoint
ALTER TABLE "ab_conversions" ADD CONSTRAINT "ab_conversions_external_order_id_source_unique" UNIQUE("external_order_id","source");
--> statement-breakpoint
ALTER TABLE "ab_conversions" DROP COLUMN "kiwify_order_id";
