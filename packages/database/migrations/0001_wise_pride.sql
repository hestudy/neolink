CREATE TABLE "processing_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bookmark_id" uuid NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"result" jsonb,
	"error" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_bookmark_id_bookmarks_id_fk" FOREIGN KEY ("bookmark_id") REFERENCES "public"."bookmarks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_processing_jobs_bookmark_id" ON "processing_jobs" USING btree ("bookmark_id");--> statement-breakpoint
CREATE INDEX "idx_processing_jobs_status" ON "processing_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_processing_jobs_type" ON "processing_jobs" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_processing_jobs_created_at" ON "processing_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_processing_jobs_priority" ON "processing_jobs" USING btree ("priority");