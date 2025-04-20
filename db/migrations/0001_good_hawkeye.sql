DO $$ BEGIN
 CREATE TYPE "public"."credential_status" AS ENUM('pending', 'uploaded', 'validated', 'error');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agencies" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agency_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" text NOT NULL,
	"client_identifier" text NOT NULL,
	"client_name" text NOT NULL,
	"ga4_property_id" text NOT NULL,
	"credential_reference" text,
	"credential_status" "credential_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agency_clients_client_identifier_unique" UNIQUE("client_identifier")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_client_id" uuid NOT NULL,
	"encrypted_credential_data" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "credentials_agency_client_id_unique" UNIQUE("agency_client_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agency_clients" ADD CONSTRAINT "agency_clients_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credentials" ADD CONSTRAINT "credentials_agency_client_id_agency_clients_id_fk" FOREIGN KEY ("agency_client_id") REFERENCES "public"."agency_clients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
