-- Migration: Create asset-documents storage bucket
-- This bucket was missing, causing 400 errors on document upload

-- 1. Create the bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('asset-documents', 'asset-documents', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage policies for asset-documents bucket

-- Allow authenticated users to read (for signed URLs / downloads)
CREATE POLICY "Authenticated users can view asset documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'asset-documents');

-- Allow supervisors and admins to upload
CREATE POLICY "Supervisors and admins can upload asset documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'asset-documents'
    AND public.get_user_role() IN ('supervisor', 'admin')
  );

-- Allow supervisors and admins to update (needed for upsert)
CREATE POLICY "Supervisors and admins can update asset documents"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'asset-documents'
    AND public.get_user_role() IN ('supervisor', 'admin')
  )
  WITH CHECK (
    bucket_id = 'asset-documents'
    AND public.get_user_role() IN ('supervisor', 'admin')
  );

-- Allow supervisors and admins to delete
CREATE POLICY "Supervisors and admins can delete asset documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'asset-documents'
    AND public.get_user_role() IN ('supervisor', 'admin')
  );
