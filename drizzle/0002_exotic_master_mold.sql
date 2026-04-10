CREATE TABLE "outgoing_webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"tenant_id" text NOT NULL,
	"source_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"http_status" integer,
	"error" text,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outgoing_webhook_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "outgoing_webhook_deliveries" ADD CONSTRAINT "outgoing_webhook_deliveries_endpoint_id_outgoing_webhook_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."outgoing_webhook_endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outgoing_webhook_deliveries_endpoint_idx" ON "outgoing_webhook_deliveries" USING btree ("endpoint_id");--> statement-breakpoint
CREATE INDEX "outgoing_webhook_deliveries_tenant_idx" ON "outgoing_webhook_deliveries" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "outgoing_webhook_deliveries_source_idx" ON "outgoing_webhook_deliveries" USING btree ("source_event_id");--> statement-breakpoint
CREATE INDEX "outgoing_webhook_endpoints_tenant_idx" ON "outgoing_webhook_endpoints" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "outgoing_webhook_endpoints_tenant_url_uid" ON "outgoing_webhook_endpoints" USING btree ("tenant_id","url");