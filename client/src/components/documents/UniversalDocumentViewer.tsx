import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Download, FileText, FileSpreadsheet, FileImage, Eye } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import SimpleDocumentViewer from './SimpleDocumentViewer';
import EmbeddedPDFViewer from './EmbeddedPDFViewer';

interface UniversalDocumentViewerProps {
  documentId: number;
  documentName: string;
  fileType?: string;
}

// Document type detection and configuration
const getDocumentConfig = (fileName: string, fileType?: string) => {
  if (!fileName) return { type: 'document', extensions: [], icon: FileText, canPreview: false, viewerType: 'download', color: 'text-gray-600', aiCategory: 'document', description: 'Document' };
  
  const extension = fileName.toLowerCase().split('.').pop() || '';
  const name = fileName.toLowerCase();
  
  // Investment document categories for AI analysis
  const configs = {
    // Spreadsheets - Critical for financial analysis (Download only due to external service limitations)
    excel: {
      extensions: ['xlsx', 'xls', 'xlsm'],
      icon: FileSpreadsheet,
      canPreview: false,
      viewerType: 'download',
      color: 'text-green-600',
      aiCategory: 'financial-model',
      description: 'Financial Model/Spreadsheet'
    },
    
    // CSV - Data files
    csv: {
      extensions: ['csv'],
      icon: FileSpreadsheet,
      canPreview: true,
      viewerType: 'csv',
      color: 'text-blue-600',
      aiCategory: 'data-table',
      description: 'Data Table'
    },
    
    // PDFs - Pitch decks, reports, legal docs
    pdf: {
      extensions: ['pdf'],
      icon: FileText,
      canPreview: true,
      viewerType: 'pdf',
      color: 'text-red-600',
      aiCategory: 'document',
      description: 'Document/Presentation'
    },
    
    // Images - Charts, diagrams
    image: {
      extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
      icon: FileImage,
      canPreview: true,
      viewerType: 'image',
      color: 'text-purple-600',
      aiCategory: 'visual',
      description: 'Image/Chart'
    },
    
    // Default fallback
    document: {
      extensions: ['doc', 'docx', 'ppt', 'pptx', 'txt'],
      icon: FileText,
      canPreview: false,
      viewerType: 'download',
      color: 'text-gray-600',
      aiCategory: 'document',
      description: 'Document'
    }
  };
  
  // Find matching config
  for (const [type, config] of Object.entries(configs)) {
    if (config.extensions.includes(extension)) {
      return { type, ...config };
    }
  }
  
  return { type: 'document', ...configs.document };
};

export default function UniversalDocumentViewer({ documentId, documentName, fileType }: UniversalDocumentViewerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const { toast } = useToast();
  
  const documentUrl = `/api/documents/${documentId}/download`;
  const docConfig = getDocumentConfig(documentName, fileType);
  const IconComponent = docConfig.icon;

  const handleDownload = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(documentUrl, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to download document');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = documentName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Download Complete",
        description: `${documentName} has been downloaded.`,
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Could not download the document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadPreviewData = async () => {
    if (docConfig.viewerType === 'csv') {
      try {
        const response = await fetch(documentUrl, { credentials: 'include' });
        const text = await response.text();
        const rows = text.split('\n').slice(0, 10); // Preview first 10 rows
        const headers = rows[0]?.split(',') || [];
        const data = rows.slice(1).map(row => row.split(','));
        setPreviewData({ headers, data, totalRows: text.split('\n').length });
      } catch (error) {
        console.error('Failed to load CSV preview:', error);
      }
    }
  };

  useEffect(() => {
    if (docConfig.viewerType === 'csv') {
      loadPreviewData();
    }
  }, [documentId, docConfig.viewerType]);

  const renderViewer = () => {
    switch (docConfig.viewerType) {
      case 'pdf':
        return <EmbeddedPDFViewer documentId={documentId} documentName={documentName} fileType={fileType} />;
      
      case 'excel':
        return (
          <div className="w-full h-full flex flex-col">
            <div className="flex items-center justify-between p-4 border-b bg-green-50">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-green-600" />
                <h3 className="text-lg font-medium text-neutral-900">Excel Spreadsheet Preview</h3>
              </div>
              <Button onClick={handleDownload} disabled={isLoading} size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download Excel
              </Button>
            </div>
            <div className="flex-1 flex items-center justify-center p-8">
              <iframe 
                src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(window.location.origin + documentUrl)}`}
                className="w-full h-full border-0 rounded"
                title={documentName}
                style={{ minHeight: '600px' }}
              />
            </div>
            <div className="p-2 text-xs text-neutral-500 bg-blue-50 text-center">
              💡 AI-Ready: This financial model will be available for AI analysis and insights
            </div>
          </div>
        );
      
      case 'csv':
        return (
          <div className="w-full h-full flex flex-col p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-neutral-900">Data Preview</h3>
                <p className="text-sm text-neutral-600">
                  {previewData?.totalRows || 0} rows total (showing first 10)
                </p>
              </div>
              <Button onClick={handleDownload} disabled={isLoading} size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download CSV
              </Button>
            </div>
            
            {previewData && (
              <div className="flex-1 overflow-auto">
                <table className="w-full text-sm border-collapse border border-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      {previewData.headers.map((header: string, index: number) => (
                        <th key={index} className="border border-gray-300 px-2 py-1 text-left font-medium">
                          {header.trim()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.data.map((row: string[], rowIndex: number) => (
                      <tr key={rowIndex} className="hover:bg-gray-50">
                        {row.map((cell: string, cellIndex: number) => (
                          <td key={cellIndex} className="border border-gray-300 px-2 py-1">
                            {cell.trim()}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            <div className="mt-4 text-xs text-neutral-500">
              💡 Future: AI will analyze this data for investment insights
            </div>
          </div>
        );
      
      case 'image':
        return (
          <div className="w-full h-full flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-medium">Image Preview</h3>
              <Button onClick={handleDownload} disabled={isLoading} size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
            <div className="flex-1 flex items-center justify-center p-4">
              <img 
                src={documentUrl} 
                alt={documentName}
                className="max-w-full max-h-full object-contain"
                style={{ maxHeight: 'calc(100vh - 200px)' }}
              />
            </div>
          </div>
        );
      
      default:
        return (
          <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-neutral-50">
            <IconComponent className={`h-16 w-16 ${docConfig.color} mb-4`} />
            <h3 className="text-lg font-medium text-neutral-900 mb-2">{docConfig.description}</h3>
            <p className="text-sm text-neutral-600 mb-4 text-center max-w-md">
              This document type requires downloading to view in the appropriate application.
            </p>
            <Button onClick={handleDownload} disabled={isLoading}>
              <Download className="h-4 w-4 mr-2" />
              {isLoading ? 'Downloading...' : 'Download Document'}
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="w-full h-full">
      {renderViewer()}
    </div>
  );
}