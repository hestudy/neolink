CREATE TABLE "bookmark_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bookmark_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"description" text,
	"content" text,
	"summary" text,
	"favicon" text,
	"screenshot" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"ai_tags" jsonb DEFAULT '[]'::jsonb,
	"manual_tags" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"processing_status" text DEFAULT 'pending' NOT NULL,
	"embedding" vector(1536),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"description" text,
	"is_ai_generated" boolean DEFAULT false NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"preferences" jsonb DEFAULT '{}'::jsonb,
	"ai_settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_login_at" timestamp,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "bookmark_tags" ADD CONSTRAINT "bookmark_tags_bookmark_id_bookmarks_id_fk" FOREIGN KEY ("bookmark_id") REFERENCES "public"."bookmarks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmark_tags" ADD CONSTRAINT "bookmark_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bookmark_tags_bookmark_id" ON "bookmark_tags" USING btree ("bookmark_id");--> statement-breakpoint
CREATE INDEX "idx_bookmark_tags_tag_id" ON "bookmark_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "idx_bookmarks_user_id" ON "bookmarks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_bookmarks_created_at" ON "bookmarks" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_bookmarks_url" ON "bookmarks" USING btree ("url");--> statement-breakpoint
CREATE INDEX "idx_bookmarks_is_deleted" ON "bookmarks" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_bookmarks_processing_status" ON "bookmarks" USING btree ("processing_status");--> statement-breakpoint
CREATE INDEX "idx_bookmarks_embedding" ON "bookmarks" USING ivfflat ("embedding");--> statement-breakpoint
CREATE INDEX "idx_tags_user_id" ON "tags" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_tags_name" ON "tags" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_tags_is_ai_generated" ON "tags" USING btree ("is_ai_generated");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");