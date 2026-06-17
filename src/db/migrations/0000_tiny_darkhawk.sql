CREATE TYPE "public"."ab_experiment_status" AS ENUM('active', 'paused', 'finished');--> statement-breakpoint
CREATE TABLE "ab_conversions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experiment_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"visitor_id" varchar(255),
	"kiwify_order_id" varchar(255) NOT NULL,
	"amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ab_conversions_kiwify_order_id_unique" UNIQUE("kiwify_order_id")
);
--> statement-breakpoint
CREATE TABLE "ab_experiments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"status" "ab_experiment_status" DEFAULT 'active' NOT NULL,
	"cookie_days" integer DEFAULT 30 NOT NULL,
	"winner_variant_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	CONSTRAINT "ab_experiments_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "ab_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experiment_id" uuid NOT NULL,
	"label" varchar(5) NOT NULL,
	"name" varchar(255) NOT NULL,
	"url" varchar(2048) NOT NULL,
	"weight" integer NOT NULL,
	"color" varchar(7) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ab_visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experiment_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"visitor_id" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ab_visits_exp_visitor_unique" UNIQUE("experiment_id","visitor_id")
);
--> statement-breakpoint
ALTER TABLE "ab_conversions" ADD CONSTRAINT "ab_conversions_experiment_id_ab_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."ab_experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ab_conversions" ADD CONSTRAINT "ab_conversions_variant_id_ab_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."ab_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ab_variants" ADD CONSTRAINT "ab_variants_experiment_id_ab_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."ab_experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ab_visits" ADD CONSTRAINT "ab_visits_experiment_id_ab_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."ab_experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ab_visits" ADD CONSTRAINT "ab_visits_variant_id_ab_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."ab_variants"("id") ON DELETE cascade ON UPDATE no action;