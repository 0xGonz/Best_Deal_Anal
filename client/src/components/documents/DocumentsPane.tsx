import React, { useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { PdfViewer } from './PdfViewer';
import { useDealDocuments } from '@/hooks/useDealDocuments';

interface DocumentsPaneProps {
  dealId: number;
}

export const DocumentsPane: React.FC<DocumentsPaneProps> = ({ dealId }) => {
  // Use our custom hook to load documents for this deal
  const { isLoading } = useDealDocuments(dealId);

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left sidebar for document list and actions */}
      <div className="w-64 border-r border-border overflow-y-auto flex-shrink-0">
        <Sidebar dealId={dealId} />
      </div>
      
      {/* Main PDF viewer area */}
      <div className="flex-1 overflow-auto min-w-0">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-muted-foreground">Loading documents...</p>
          </div>
        ) : (
          <div className="h-full">
            <PdfViewer />
          </div>
        )}
      </div>
    </div>
  );
};