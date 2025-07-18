
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, FileSpreadsheet, TrendingUp, Brain, Loader2, Eye } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from "@/hooks/use-toast";
import FormattedText from "@/components/common/FormattedText";

interface Document {
  id: number;
  fileName: string;
  documentType: string;
  fileSize: number;
  uploadedAt: string;
  description?: string;
}

interface DocumentAnalysisPanelProps {
  dealId: number;
  dealName: string;
}

export function DocumentAnalysisPanel({ dealId, dealName }: DocumentAnalysisPanelProps) {
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch documents for this deal
  const { data: documents = [], isLoading: documentsLoading } = useQuery({
    queryKey: [`/api/documents/deal/${dealId}`],
    enabled: !!dealId
  });

  // AI analysis mutation for specific documents
  const analyzeDocumentMutation = useMutation({
    mutationFn: async (documentId: number) => {
      const response = await fetch(`/api/v1/ai-analysis/deals/${dealId}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          query: `Please analyze the document "${selectedDocument?.fileName}" in detail.`,
          documentId 
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to analyze document');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setAnalysisResult(data.response || data.analysis);
      toast({
        title: "Document Analysis Complete",
        description: `Generated analysis for ${selectedDocument?.fileName}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze document",
        variant: "destructive"
      });
    }
  });

  const getDocumentIcon = (fileName: string) => {
    const ext = fileName.toLowerCase().split('.').pop();
    switch (ext) {
      case 'pdf':
        return <FileText className="h-5 w-5 text-red-500" />;
      case 'xlsx':
      case 'xls':
      case 'csv':
        return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
      default:
        return <FileText className="h-5 w-5 text-gray-500" />;
    }
  };

  const getDocumentTypeLabel = (fileName: string, docType: string) => {
    const ext = fileName.toLowerCase().split('.').pop();
    if (fileName.toLowerCase().includes('term sheet') || fileName.toLowerCase().includes('termsheet')) {
      return 'Term Sheet';
    }
    if (fileName.toLowerCase().includes('pitch') || fileName.toLowerCase().includes('deck')) {
      return 'Pitch Deck';
    }
    if (fileName.toLowerCase().includes('financial') || fileName.toLowerCase().includes('model')) {
      return 'Financial Model';
    }
    if (ext === 'pdf') return 'PDF Document';
    if (['xlsx', 'xls', 'csv'].includes(ext || '')) return 'Spreadsheet';
    return docType || 'Document';
  };

  const handleDocumentClick = (document: Document) => {
    setSelectedDocument(document);
    setAnalysisResult(null);
    analyzeDocumentMutation.mutate(document.id);
  };

  if (documentsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Document Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading documents...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Document Analysis for {dealName}
          </CardTitle>
          <p className="text-sm text-gray-600">
            Click on any document below to get AI-powered analysis
          </p>
        </CardHeader>
        <CardContent>
          {Array.isArray(documents) && documents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No documents uploaded for this deal yet.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {Array.isArray(documents) && documents.map((document: any) => (
                <div
                  key={document.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                    selectedDocument?.id === document.id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleDocumentClick(document)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getDocumentIcon(document.fileName)}
                      <div>
                        <h4 className="font-medium text-gray-900">{document.fileName}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {getDocumentTypeLabel(document.fileName, document.documentType)}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {Math.round(document.fileSize / 1024)} KB
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(document.uploadedAt).toLocaleDateString()}
                          </span>
                        </div>
                        {document.description && (
                          <p className="text-sm text-gray-600 mt-1">{document.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {analyzeDocumentMutation.isPending && selectedDocument?.id === document.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {selectedDocument && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Analysis: {selectedDocument.fileName}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analyzeDocumentMutation.isPending ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Analyzing document...</span>
              </div>
            ) : analysisResult ? (
              <div className="prose max-w-none">
                <FormattedText content={analysisResult} />
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                <p>Click "Analyze" to get AI insights for this document</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}