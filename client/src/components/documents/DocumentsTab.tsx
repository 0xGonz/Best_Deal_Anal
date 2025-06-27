import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { DocumentsProvider } from '@/context/DocumentsContext';
import { DocumentsPane } from './DocumentsPane';

interface DocumentsTabProps {
  dealId: number;
}

export const DocumentsTab: React.FC<DocumentsTabProps> = ({ dealId }) => {
  return (
    <Card className="h-[calc(100vh-120px)] flex flex-col">
      <CardHeader className="pb-2 sm:pb-4 flex-shrink-0">
        <CardTitle className="text-base sm:text-xl">Documents</CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Deal-related files and attachments
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 p-4 overflow-hidden min-h-0">
        <div className="h-full min-h-0">
          <DocumentsProvider>
            <DocumentsPane dealId={dealId} />
          </DocumentsProvider>
        </div>
      </CardContent>
    </Card>
  );
};