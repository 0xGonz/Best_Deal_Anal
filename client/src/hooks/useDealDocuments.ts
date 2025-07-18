import { useQuery } from '@tanstack/react-query';
import { useDocs, DocMeta } from '@/context/DocumentsContext';
import { useEffect } from 'react';

interface Document {
  id: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  documentType: string;
  uploadedAt: string;
}

/**
 * Custom hook to fetch and manage document data for a specific deal
 * and sync it with the DocumentsContext
 */
export function useDealDocuments(dealId: number | undefined) {
  // Early return if dealId is undefined
  if (!dealId) {
    return {
      isLoading: false,
      error: null,
      refetch: () => Promise.resolve(),
      hasDocuments: false,
      documentCount: 0,
    };
  }

  const documentsContext = useDocs();
  
  // Safe fallback if DocumentsContext not mounted
  if (!documentsContext) {
    console.warn('useDealDocuments: DocumentsContext not available');
    return {
      isLoading: false,
      error: new Error('DocumentsContext not available'),
      refetch: () => Promise.resolve(),
      hasDocuments: false,
      documentCount: 0,
    };
  }

  const { setDocs, setCurrent, current } = documentsContext;
  
  // Query to fetch documents for this deal
  const { data, isLoading, error, refetch } = useQuery<Document[]>({
    queryKey: [`/api/documents/deal/${dealId}`],
    enabled: !!dealId,
  });
  
  // Update docs state when data changes
  useEffect(() => {
    console.log(`🔍 useDealDocuments: Processing data for deal ${dealId}:`, data);
    if (data && Array.isArray(data)) {
      // Filter out corrupt documents and convert to DocMeta format
      const validDocs = data.filter(doc => doc && doc.id && doc.fileName);
      const docMetas: DocMeta[] = validDocs.map(doc => ({
        id: doc.id,
        name: doc.fileName,
        fileName: doc.fileName,
        fileType: doc.fileType,
        downloadUrl: `/api/documents/${doc.id}/download`,
        documentType: doc.documentType,
      }));
      
      console.log(`📝 useDealDocuments: Setting ${docMetas.length} documents in context:`, docMetas);
      
      // Update docs state
      setDocs(docMetas);
      
      // Preserve current selection if it's still valid, otherwise auto-select first
      if (docMetas.length > 0) {
        const currentStillValid = current && docMetas.some(doc => doc.id === current.id);
        if (!current || !currentStillValid) {
          console.log(`🎯 useDealDocuments: Auto-selecting first document:`, docMetas[0]);
          setCurrent(docMetas[0]);
        }
      } else {
        console.log(`❌ useDealDocuments: No documents found, clearing selection`);
        setCurrent(null);
      }
    } else {
      console.log(`⚠️ useDealDocuments: No data received or data is not an array:`, data);
      setDocs([]);
      setCurrent(null);
    }
  }, [data, setDocs, setCurrent, current, dealId]);
  
  const documentCount = Array.isArray(data) ? data.length : 0;
  const hasDocuments = documentCount > 0;
  
  return {
    isLoading,
    error,
    refetch,
    hasDocuments,
    documentCount,
  };
}