# Documents Database Best Practices

## Problem Summary
The documents table stores large binary files (PDFs, Excel, etc.) in the `file_data` column. When you query this column directly, it can exceed the 67MB response limit.

## Solution: Use the documents_metadata View

### ✅ CORRECT Way to Query Documents:
```sql
-- List documents without file_data
SELECT * FROM documents_metadata 
WHERE deal_id = 139
ORDER BY uploaded_at DESC;

-- Get specific document metadata
SELECT id, file_name, size_mb, data_status 
FROM documents_metadata
WHERE id = 74;
```

### ❌ WRONG Way (causes 507 error):
```sql
-- DON'T DO THIS - includes file_data
SELECT * FROM documents;

-- DON'T DO THIS - file_data is too large
SELECT id, file_data FROM documents;
```

### Getting File Content (only when needed):
```sql
-- Get file data for a SINGLE document only
SELECT file_data FROM documents WHERE id = 74;

-- Or use the function
SELECT * FROM get_document_data(74);
```

## Key Points:
1. **Always use `documents_metadata` view** for listing documents
2. **Never include `file_data`** in queries that return multiple rows
3. **Only query `file_data`** for a single document when downloading/viewing
4. **Large files** (>20MB) may still cause issues even individually

## Frontend Integration:
- Use `/api/documents/:id/download` endpoint for file downloads
- Use `/api/documents/:id/view` endpoint for in-browser viewing
- List documents using endpoints that query `documents_metadata` view