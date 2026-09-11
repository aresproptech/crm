CREATE POLICY "lead_documentation_storage_delete" ON "storage"."objects"
  FOR DELETE
  TO "authenticated"
  USING (((bucket_id = 'lead-documentation'::text) AND public.crm_can_write_opportunity(public.crm_document_opportunity_id(name))));

CREATE POLICY "lead_documentation_storage_insert" ON "storage"."objects"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((bucket_id = 'lead-documentation'::text) AND public.crm_can_write_opportunity(public.crm_document_opportunity_id(name))));

CREATE POLICY "lead_documentation_storage_select" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING (((bucket_id = 'lead-documentation'::text) AND public.crm_can_read_opportunity(public.crm_document_opportunity_id(name))));

CREATE POLICY "lead_documentation_storage_update" ON "storage"."objects"
  FOR UPDATE
  TO "authenticated"
  USING (((bucket_id = 'lead-documentation'::text) AND public.crm_can_write_opportunity(public.crm_document_opportunity_id(name))))
  WITH CHECK (((bucket_id = 'lead-documentation'::text) AND public.crm_can_write_opportunity(public.crm_document_opportunity_id(name))));
