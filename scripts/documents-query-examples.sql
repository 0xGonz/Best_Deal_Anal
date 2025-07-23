-- Safe Document Queries for DealFlowLifecycle

-- 1. List all documents (NO file_data)
SELECT * FROM documents_metadata 
ORDER BY uploaded_at DESC;

-- 2. Find documents for a specific deal
SELECT 
    id,
    file_name,
    size_mb,
    document_type,
    uploaded_at
FROM documents_metadata 
WHERE deal_id = 139;

-- 3. Check document sizes
SELECT 
    deal_name,
    COUNT(*) as doc_count,
    SUM(size_mb) as total_mb
FROM documents_metadata
GROUP BY deal_name
HAVING SUM(size_mb) > 5
ORDER BY total_mb DESC;

-- 4. Find large documents
SELECT * FROM documents_metadata 
WHERE size_mb > 10;

-- 5. Download a specific document (use in application)
-- Only get file_data for ONE document
SELECT file_data 
FROM documents 
WHERE id = 74;