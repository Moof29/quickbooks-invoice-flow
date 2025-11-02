-- Update bucket to support larger files (5GB for free tier, more for paid)
UPDATE storage.buckets 
SET file_size_limit = 5368709120  -- 5GB limit (free tier max)
WHERE id = 'csv-imports';