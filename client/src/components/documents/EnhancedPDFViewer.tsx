import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Download, ZoomIn, ZoomOut, RotateCw, File, Printer, ChevronLeft, ChevronRight } from 'lucide-react';

// Import react-pdf components
import { Document as PDFDocument, Page as PDFPage } from 'react-pdf';

interface EnhancedPDFViewerProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: number;
  documentName: string;
}

export default function EnhancedPDFViewer({ isOpen, onClose, documentId, documentName }: EnhancedPDFViewerProps) {
  const { toast } = useToast();
  const documentUrl = `/api/documents/${documentId}/download`;
  
  // PDF worker is already configured via the side-effect import in main.tsx
  // No need to manually initialize anything here
  
  // Function to handle authentication errors
  const handleAuthError = (error: any) => {
    toast({
      title: 'Authentication Error',
      description: 'You must be logged in to view this document. Please log in and try again.',
      variant: 'destructive',
    });
    console.error('Authentication error while loading document:', error);
    setIsFailed(true);
    setIsLoading(false);
    setError(error); // Make sure the error is stored for reference in the UI
    
    // Redirect to login page if available in your authentication flow
    // This is commented out because we need to implement proper authentication routing
    // window.location.href = '/auth'; 
  };

  // PDF viewer state
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isFailed, setIsFailed] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Reset state when document changes
  useEffect(() => {
    if (isOpen) {
      setPageNumber(1);
      setScale(1);
      setRotation(0);
      setIsLoading(true);
      setIsFailed(false);
      setError(null); // Reset any previous errors
    }
  }, [isOpen, documentId]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setIsLoading(false);
  }

  function onDocumentLoadError(error: Error) {
    console.error('Error loading PDF document:', error);
    setIsLoading(false);
    setIsFailed(true);
    setError(error); // Store the error for reference in the UI
    
    // Check if this is an authentication error (401 Unauthorized)
    // The error message would typically contain the status code or "unauthorized" keyword
    if (error.message && 
        (error.message.includes('401') || 
         error.message.toLowerCase().includes('unauthorized') || 
         error.message.toLowerCase().includes('authentication')))
    {
      handleAuthError(error);
    } else {
      toast({
        title: 'Error loading document',
        description: 'The document could not be loaded. Try downloading it instead.',
        variant: 'destructive',
      });
    }
  }

  const changePage = (offset: number) => {
    if (numPages !== null) {
      const newPage = pageNumber + offset;
      if (newPage >= 1 && newPage <= numPages) {
        setPageNumber(newPage);
      }
    }
  }

  const previousPage = () => changePage(-1);
  const nextPage = () => changePage(1);

  const zoomIn = () => setScale((prevScale) => Math.min(prevScale + 0.2, 3));
  const zoomOut = () => setScale((prevScale) => Math.max(prevScale - 0.2, 0.4));
  const rotate = () => setRotation((prevRotation) => (prevRotation + 90) % 360);

  const print = () => {
    window.open(documentUrl, '_blank')?.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{documentName}</DialogTitle>
          <DialogDescription>
            View, navigate, and interact with the document
          </DialogDescription>
        </DialogHeader>
        
        {/* PDF Controls */}
        <div className="flex flex-wrap gap-2 mb-4 p-2 bg-neutral-50 rounded-md">
          {/* Page Navigation */}
          <div className="flex items-center mr-auto">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={previousPage} 
              disabled={pageNumber <= 1 || isLoading || isFailed}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center mx-2">
              <Input
                className="w-12 text-center"
                type="number"
                min={1}
                max={numPages || 1}
                value={pageNumber}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (numPages !== null && val >= 1 && val <= numPages) {
                    setPageNumber(val);
                  }
                }}
                disabled={isLoading || isFailed}
              />
              <span className="mx-2 text-sm text-neutral-500">
                of {numPages || '-'}
              </span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={nextPage} 
              disabled={!numPages || pageNumber >= numPages || isLoading || isFailed}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={zoomOut} 
              disabled={scale <= 0.4 || isLoading || isFailed}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 w-28">
              <Slider 
                value={[scale * 100]} 
                min={40} 
                max={300} 
                step={10} 
                onValueChange={(vals) => setScale(vals[0] / 100)}
                disabled={isLoading || isFailed}
              />
              <span className="text-xs w-10 text-right">{Math.round(scale * 100)}%</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={zoomIn} 
              disabled={scale >= 3 || isLoading || isFailed}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Other Controls */}
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={rotate} 
              disabled={isLoading || isFailed}
            >
              <RotateCw className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={print}
              disabled={isLoading || isFailed}
            >
              <Printer className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              asChild
            >
              <a href={documentUrl} target="_blank" rel="noopener noreferrer" download>
                <Download className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
        
        {/* PDF Document Container */}
        <div className="flex-1 overflow-auto bg-neutral-100 rounded-md relative p-4 flex items-center justify-center">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="space-y-3 w-64">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          )}
          
          {isFailed ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <File className="h-16 w-16 text-neutral-400 mb-4" />
              <h3 className="text-lg font-medium mb-2">Document Preview Unavailable</h3>
              <p className="text-neutral-500 mb-4">
                {error && error.message && 
                 (error.message.includes('401') || 
                  error.message.toLowerCase().includes('unauthorized') || 
                  error.message.toLowerCase().includes('authentication')) 
                ? 'Authentication error. Please log in to view this document.'
                : 'This document could not be previewed in the browser.'}
              </p>
              <Button asChild>
                <a href={documentUrl} target="_blank" rel="noopener noreferrer" download>
                  <Download className="h-4 w-4 mr-2" />
                  Download Document
                </a>
              </Button>
            </div>
          ) : (
            <div>
              {/* Main PDF viewer with rotation */}
              <div id="enhanced-pdf-viewer" style={{ transform: `rotate(${rotation}deg)` }} className="transition-transform duration-300">
                <PDFDocument
                  file={{ url: documentUrl, withCredentials: true }}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={(error) => {
                    // First try standard error handling
                    onDocumentLoadError(error);
                    
                    // Then switch to iframe fallback if needed
                    const container = document.getElementById('enhanced-pdf-viewer');
                    const fallback = document.getElementById('enhanced-pdf-iframe-fallback');
                    
                    if (container && fallback) {
                      container.style.display = 'none';
                      fallback.style.display = 'block';
                    }
                    
                    toast({
                      title: 'Using simple document viewer',
                      description: 'PDF viewer could not be initialized. Using simple document viewer instead.',
                    });
                  }}
                  className="pdf-document"
                  loading={<div className="opacity-0">Loading document...</div>}
                >
                  <PDFPage
                    key={`page_${pageNumber}`}
                    pageNumber={pageNumber}
                    scale={scale}
                    renderAnnotationLayer={true}
                    renderTextLayer={true}
                    className="shadow-md"
                  />
                </PDFDocument>
              </div>
              
              {/* Fallback iframe viewer */}
              <div id="enhanced-pdf-iframe-fallback" style={{display: 'none'}} className="w-full h-full flex items-center justify-center">
                <iframe 
                  src={documentUrl}
                  className="w-full h-[800px] border-0" 
                  title={documentName}
                />
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter className="pt-4 border-t mt-4">
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button asChild>
              <a href={documentUrl} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4 mr-1" />
                Download
              </a>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
