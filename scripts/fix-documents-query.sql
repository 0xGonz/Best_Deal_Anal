-- Query documents WITHOUT file_data to avoid size limits
-- This is the correct way to list documents

-- List all documents with metadata (no binary data)
SELECT 
  id,
  deal_id,
  file_name,
  file_type,
  file_size,
  file_path,
  uploaded_by,
  uploaded_at,
  description,
  document_type,
  metadata,
  version,
  org_id
FROM documents
ORDER BY id DESC
LIMIT 50;

-- To get a specific document with its file data, query by ID:
-- SELECT file_data FROM documents WHERE id = ?;

-- Alternative: Create a view for document metadata
CREATE OR REPLACE VIEW document_metadata AS
SELECT 
  id,
  deal_id,
  file_name,
  file_type,
  file_size,
  file_path,
  uploaded_by,
  uploaded_at,
  description,
  document_type,
  metadata,
  version,
  org_id,
  -- Add computed columns
  ROUND(file_size / 1024.0, 2) as size_kb,
  ROUND(file_size / 1024.0 / 1024.0, 2) as size_mb
FROM documents;