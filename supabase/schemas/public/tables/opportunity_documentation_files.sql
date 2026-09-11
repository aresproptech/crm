CREATE TABLE "public"."opportunity_documentation_files" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "opportunity_id"  bigint                   NOT NULL,
  "requirement_key" text                     NOT NULL,
  "file_name"       text                     NOT NULL,
  "storage_path"    text                     NOT NULL,
  "mime_type"       text,
  "file_size"       bigint,
  "uploaded_by"     text,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "opportunity_documentation_files_opportunity_id_fkey" FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id) ON DELETE CASCADE,
  CONSTRAINT "opportunity_documentation_files_pkey" PRIMARY KEY (id),
  CONSTRAINT "opportunity_documentation_files_storage_path_key" UNIQUE (storage_path)
);

ALTER TABLE "public"."opportunity_documentation_files"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX opportunity_documentation_files_opportunity_idx ON public.opportunity_documentation_files USING btree (opportunity_id, requirement_key);

CREATE POLICY "documentation_files_delete" ON "public"."opportunity_documentation_files"
  FOR DELETE
  TO "authenticated"
  USING (public.crm_can_write_opportunity(opportunity_id));

CREATE POLICY "documentation_files_insert" ON "public"."opportunity_documentation_files"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (public.crm_can_write_opportunity(opportunity_id));

CREATE POLICY "documentation_files_select" ON "public"."opportunity_documentation_files"
  FOR SELECT
  TO "authenticated"
  USING (public.crm_can_read_opportunity(opportunity_id));

CREATE POLICY "documentation_files_update" ON "public"."opportunity_documentation_files"
  FOR UPDATE
  TO "authenticated"
  USING (public.crm_can_write_opportunity(opportunity_id))
  WITH CHECK (public.crm_can_write_opportunity(opportunity_id));

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."opportunity_documentation_files" TO "appsheet_user";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."opportunity_documentation_files" TO "postgres", "service_role";

REVOKE ALL ON TABLE "public"."opportunity_documentation_files" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."opportunity_documentation_files" TO "authenticated";
