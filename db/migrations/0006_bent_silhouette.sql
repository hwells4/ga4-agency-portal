CREATE TYPE "public"."nango_connection_status" AS ENUM('pending', 'active', 'error', 'revoked');--> statement-breakpoint
CREATE TABLE "nango_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" text NOT NULL,
	"user_id" text NOT NULL,
	"name" text,
	"nango_connection_id" text,
	"provider_config_key" text NOT NULL,
	"status" "nango_connection_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "nango_connections_nango_connection_id_unique" UNIQUE("nango_connection_id")
);
--> statement-breakpoint
ALTER TABLE "nango_connections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agency_clients" RENAME COLUMN "ga4_property_id" TO "property_id";--> statement-breakpoint
ALTER TABLE "agency_clients" RENAME COLUMN "nango_connection_id" TO "nango_connection_table_id";--> statement-breakpoint
ALTER TABLE "nango_connections" ADD CONSTRAINT "nango_connections_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nango_connections" ADD CONSTRAINT "nango_connections_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_clients" ADD CONSTRAINT "agency_clients_nango_connection_table_id_nango_connections_id_fk" FOREIGN KEY ("nango_connection_table_id") REFERENCES "public"."nango_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_clients" DROP COLUMN "nango_provider_config_key";--> statement-breakpoint
ALTER TABLE "agency_clients" DROP COLUMN "credential_reference";--> statement-breakpoint
CREATE POLICY "nango_connections_agency_isolation_policy" ON "nango_connections" AS PERMISSIVE FOR ALL TO public USING (agency_id = current_setting('app.current_agency_id', true)::text);