-- 1. Create bucket if not exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;


-- =========================
-- STORAGE POLICIES
-- =========================

-- NOTE:
-- Expected file path format:
-- {user_id}/{filename}.{ext}


-- 2. Public read access (anyone can view images)
DROP POLICY IF EXISTS "Public access to product images" ON storage.objects;

CREATE POLICY "Public access to product images"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'product-images'
);


-- 3. Users can upload ONLY to their own folder + images only
DROP POLICY IF EXISTS "Users can upload their own product images" ON storage.objects;

CREATE POLICY "Users can upload their own product images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND auth.uid()::text = split_part(name, '/', 1)
  AND (metadata->>'mimetype') LIKE 'image/%'
);


-- 4. Users can update ONLY their own images
DROP POLICY IF EXISTS "Users can update their own product images" ON storage.objects;

CREATE POLICY "Users can update their own product images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND auth.uid()::text = split_part(name, '/', 1)
)
WITH CHECK (
  bucket_id = 'product-images'
  AND auth.uid()::text = split_part(name, '/', 1)
  AND (metadata->>'mimetype') LIKE 'image/%'
);


-- 5. Users can delete ONLY their own images
DROP POLICY IF EXISTS "Users can delete their own product images" ON storage.objects;

CREATE POLICY "Users can delete their own product images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND auth.uid()::text = split_part(name, '/', 1)
);
