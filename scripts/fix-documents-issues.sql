-- Fix Documents Database Issues

-- 1. Create a view for document metadata (excludes file_data)
CREATE OR REPLACE VIEW documents_metadata AS
SELECT 
    d.id,
    d.deal_id,
    d.file_name,
    d.file_type,
    d.file_size,
    d.file_path,
    d.uploaded_by,
    d.uploaded_at,
    d.description,
    d.document_type,
    d.metadata,
    d.version,
    d.org_id,
    -- Add computed columns
    ROUND(d.file_size / 1024.0, 2) as size_kb,
    ROUND(d.file_size / 1024.0 / 1024.0, 2) as size_mb,
    CASE 
        WHEN d.file_data IS NULL THEN 'No Data'
        WHEN LENGTH(d.file_data) = 0 THEN 'Empty'
        ELSE 'Has Data'
    END as data_status,
    deals.name as deal_name,
    u.username as uploaded_by_name
FROM documents d
LEFT JOIN deals ON d.deal_id = deals.id
LEFT JOIN users u ON d.uploaded_by = u.id;

-- 2. Check for problematic documents
SELECT 
    id,
    file_name,
    file_size,
    size_mb,
    data_status,
    deal_name
FROM documents_metadata
WHERE data_status IN ('No Data', 'Empty')
   OR size_mb > 20;  -- Documents larger than 20MB

-- 3. Create function to safely get document data
CREATE OR REPLACE FUNCTION get_document_data(doc_id INTEGER)
RETURNS TABLE (
    id INTEGER,
    file_name TEXT,
    file_type TEXT,
    file_data BYTEA
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.file_name,
        d.file_type,
        d.file_data
    FROM documents d
    WHERE d.id = doc_id
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- 4. Fix the NULL file_data issue for document 30
-- First check what's there
SELECT 
    id,
    deal_id,
    file_name,
    file_size,
    file_path,
    uploaded_at
FROM documents
WHERE id = 30;

-- 5. Create an index to improve document queries (exclude file_data)
CREATE INDEX IF NOT EXISTS idx_documents_metadata 
ON documents(id, deal_id, file_name, file_type, uploaded_at)
WHERE file_data IS NOT NULL;