ALTER TABLE "agency_clients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "credentials" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "user_id" text NOT NULL;--> statement-breakpoint
CREATE POLICY "agency_clients_agency_isolation_policy" ON "agency_clients" AS PERMISSIVE FOR ALL TO public USING ("agency_clients"."agency_id" = current_setting('app.current_agency_id', true)::text);--> statement-breakpoint
CREATE POLICY "credentials_agency_isolation_policy" ON "credentials" AS PERMISSIVE FOR ALL TO public USING (EXISTS (SELECT 1 FROM "agency_clients" WHERE "agency_clients"."id" = "credentials"."agency_client_id" AND "agency_clients"."agency_id" = current_setting('app.current_agency_id', true)::text));