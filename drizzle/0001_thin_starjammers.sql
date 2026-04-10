CREATE TABLE "idempotency_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"scope" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"status_code" integer NOT NULL,
	"response_body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"payment_session_id" uuid NOT NULL,
	"stripe_refund_id" text NOT NULL,
	"amount" integer,
	"status" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_refunds_stripe_refund_id_unique" UNIQUE("stripe_refund_id")
);
--> statement-breakpoint
CREATE TABLE "payment_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"checkout_session_id" text NOT NULL,
	"order_reference" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"customer_reference" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"gateway" text DEFAULT 'stripe' NOT NULL,
	"stripe_payment_intent_id" text,
	"stripe_checkout_session_id" text,
	"stripe_customer_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"return_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_sessions_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id"),
	CONSTRAINT "payment_sessions_stripe_checkout_session_id_unique" UNIQUE("stripe_checkout_session_id")
);
--> statement-breakpoint
CREATE TABLE "stripe_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stripe_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_webhook_events_stripe_event_id_unique" UNIQUE("stripe_event_id")
);
--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_payment_session_id_payment_sessions_id_fk" FOREIGN KEY ("payment_session_id") REFERENCES "public"."payment_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_records_uid" ON "idempotency_records" USING btree ("tenant_id","scope","idempotency_key");--> statement-breakpoint
CREATE INDEX "payment_refunds_session_idx" ON "payment_refunds" USING btree ("payment_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_sessions_tenant_checkout_uid" ON "payment_sessions" USING btree ("tenant_id","checkout_session_id");--> statement-breakpoint
CREATE INDEX "payment_sessions_tenant_idx" ON "payment_sessions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "payment_sessions_stripe_pi_idx" ON "payment_sessions" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "stripe_webhook_events_type_idx" ON "stripe_webhook_events" USING btree ("event_type");