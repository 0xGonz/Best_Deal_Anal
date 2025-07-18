
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Bot, Send, FileText, Database, TrendingUp, Loader2, Brain, MessageSquare, FileSpreadsheet, Eye } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import FormattedText from "@/components/common/FormattedText";
import { useAIAnalysis, AnalysisMessage } from "@/hooks/useAIAnalysis";

interface AIAnalysisTabProps {
  dealId: number;
  dealName: string;
}

interface Document {
  id: number;
  fileName: string;
  documentType: string;
  fileSize: number;
  uploadedAt: string;
  description?: string;
}

export default function AIAnalysisTab({ dealId, dealName }: AIAnalysisTabProps) {
  const [loadingDocumentId, setLoadingDocumentId] = useState<number | null>(null);

  // Use the shared AI Analysis hook
  const {
    messages,
    inputValue,
    setInputValue,
    sendMessage,
    generateAnalysis,
    clearMessages,
    messagesEndRef,
    isGeneratingAnalysis,
    contextData,
    contextLoading
  } = useAIAnalysis({
    dealId,
    dealName,
    persistMessages: true
  });

  // Fetch documents for this deal
  const { data: documents = [], isLoading: documentsLoading } = useQuery<Document[]>({
    queryKey: [`/api/documents/deal/${dealId}`],
    enabled: !!dealId
  });

  const handleSendMessage = () => {
    if (!inputValue.trim() || isGeneratingAnalysis) return;
    sendMessage();
  };

  const handleGenerateAnalysis = () => {
    generateAnalysis();
  };

  const handleDocumentAnalysis = async (document: Document) => {
    setLoadingDocumentId(document.id);
    
    // Set the input value and trigger analysis through the hook
    const analysisQuery = `Analyze the document "${document.fileName}" in detail. Provide key insights, financial metrics, risks, and strategic implications.`;
    setInputValue(analysisQuery);
    
    try {
      await sendMessage(analysisQuery);
    } catch (error) {

    } finally {
      setLoadingDocumentId(null);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold">AI Analysis</h3>
          <Badge variant="secondary">{String(dealName || 'Deal')}</Badge>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleGenerateAnalysis}
            disabled={isGeneratingAnalysis}
            variant="outline"
            size="sm"
          >
            {isGeneratingAnalysis ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4 mr-2" />
                Full Analysis
              </>
            )}
          </Button>
          <Button 
            onClick={() => sendMessage("Provide a comprehensive investment thesis for this deal including market opportunity, competitive advantages, risks, and recommendation.")}
            disabled={isGeneratingAnalysis}
            variant="outline"
            size="sm"
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            Investment Thesis
          </Button>
        </div>
      </div>

      {/* Context Panel */}
      {contextData && (
        <div className="p-4 bg-gray-50 border-b">
          <div className="flex items-center gap-2 mb-2">
            <Database className="h-4 w-4" />
            <span className="text-sm font-medium">Available Data Sources</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {Array.isArray((contextData as any).dataTypes) && (contextData as any).dataTypes?.map((type: string) => (
              <Badge key={type} variant="outline" className="text-xs">
                {type}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Quick Analysis Actions */}
      <div className="p-4 border-b">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Quick Analysis:</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => sendMessage("Analyze the financial metrics and projections for this deal.")}
            disabled={isGeneratingAnalysis}
            className="flex items-center gap-2"
          >
            <TrendingUp className="h-3 w-3" />
            Financials
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => sendMessage("What are the key risks and mitigation strategies for this investment?")}
            disabled={isGeneratingAnalysis}
            className="flex items-center gap-2"
          >
            <Eye className="h-3 w-3" />
            Risk Analysis
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => sendMessage("Analyze the market opportunity and competitive landscape.")}
            disabled={isGeneratingAnalysis}
            className="flex items-center gap-2"
          >
            <Database className="h-3 w-3" />
            Market
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => sendMessage("Summarize all legal documents and highlight key terms.")}
            disabled={isGeneratingAnalysis}
            className="flex items-center gap-2"
          >
            <FileText className="h-3 w-3" />
            Legal
          </Button>
        </div>
      </div>

      {/* Documents Section */}
      {documents && documents.length > 0 && (
        <div className="p-4 border-b">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Analyze Individual Documents:</h4>
          <div className="flex flex-wrap gap-2">
            {documents.map((document: Document) => (
              <Button
                key={document.id}
                variant="outline"
                size="sm"
                onClick={() => handleDocumentAnalysis(document)}
                disabled={isGeneratingAnalysis || loadingDocumentId === document.id}
                className="flex items-center gap-2"
                title={document.fileName}
              >
                {loadingDocumentId === document.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : document.fileName.toLowerCase().includes('.pdf') ? (
                  <FileText className="h-3 w-3" />
                ) : document.fileName.toLowerCase().includes('.xlsx') || document.fileName.toLowerCase().includes('.xls') ? (
                  <FileSpreadsheet className="h-3 w-3" />
                ) : (
                  <FileText className="h-3 w-3" />
                )}
                <span className="max-w-[120px] truncate">{document.fileName}</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <Bot className="h-12 w-12 mx-auto text-blue-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">Ready for Analysis</h3>
              <p className="text-gray-500">Ask questions about {dealName} or generate a comprehensive analysis</p>
            </div>
          ) : (
            messages.map((message: AnalysisMessage) => (
              <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-lg ${
                  message.type === 'user' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-900'
                }`}>
                  {message.type === 'user' ? (
                    <p>{message.content}</p>
                  ) : (
                    <FormattedText content={message.content} />
                  )}
                  {message.context && (
                    <div className="mt-2 pt-2 border-t border-gray-200/20">
                      <p className="text-xs opacity-75">
                        Sources: {message.context.dataSourcesUsed.join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          
          {isGeneratingAnalysis && (
            <div className="flex justify-start">
              <div className="bg-gray-100 p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Analyzing...</span>
                </div>
              </div>
            </div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={`Ask a question about ${dealName}...`}
            className="flex-1 min-h-[44px] max-h-32"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          <Button 
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isGeneratingAnalysis}
            size="lg"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}