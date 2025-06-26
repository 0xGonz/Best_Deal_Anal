import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Download, Trash2, FileUp, File, Eye, Edit2 } from 'lucide-react';
import { Document } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { formatBytes } from '@/lib/utils/format';
// Temporarily inline the function until import path is fixed
const getDocumentTypeLabel = (type: string) => {
  const types: Record<string, string> = {
    'pitch_deck': 'Pitch Deck',
    'financial_model': 'Financial Model',
    'legal_document': 'Legal Document',
    'diligence_report': 'Diligence Report',
    'investor_report': 'Investor Report',
    'term_sheet': 'Term Sheet',
    'cap_table': 'Cap Table',
    'subscription_agreement': 'Subscription Agreement',
    'other': 'Other'
  };
  return types[type] || 'Other';
};
import EnhancedPDFViewer from './EnhancedPDFViewer';
import EmbeddedPDFViewer from './EmbeddedPDFViewer';
// Import react-pdf components
import { Document as PDFDocument, Page as PDFPage } from 'react-pdf';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface DocumentListProps {
  dealId: number;
}

export default function DocumentList({ dealId }: DocumentListProps) {
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState('pitch_deck');
  const [description, setDescription] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [editDocumentType, setEditDocumentType] = useState('other');
  const [editDescription, setEditDescription] = useState('');
  const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: documents, isLoading } = useQuery({
    queryKey: [`/api/documents/deal/${dealId}`],
    enabled: !!dealId,
  }) as { data: Document[] | undefined, isLoading: boolean };

  // Add useEffect to log when documents data changes
  useEffect(() => {
    if (documents) {
      console.log(`📊 Documents query SUCCESS for dealId=${dealId}:`, documents);
    }
  }, [documents, dealId]);
  
  // Set the selected document when documents are loaded and none is selected yet
  // Only run when documents change, NOT when selectedDocument changes
  useEffect(() => {
    if (documents && documents.length > 0 && !selectedDocument) {
      setSelectedDocument(documents[0]);
      console.log(`📋 Auto-selected first document: ${documents[0]?.fileName}`);
    }
  }, [documents]); // Removed selectedDocument from dependency array

  // Document uploads use the native fetch API with FormData directly
  // instead of using the query client, since we need to send files

  const deleteMutation = useMutation({
    mutationFn: async (documentId: number) => {
      return apiRequest('DELETE', `/api/documents/${documentId}`, {});
    },
    onSuccess: (_, deletedDocumentId) => {
      // Clear selected document if it's the one that was deleted
      if (selectedDocument && selectedDocument.id === deletedDocumentId) {
        setSelectedDocument(null);
      }
      
      // Immediately update the cache to remove the deleted document
      queryClient.setQueryData([`/api/documents/deal/${dealId}`], (oldDocs: Document[] | undefined) => {
        if (!oldDocs) return oldDocs;
        const filteredDocs = oldDocs.filter(doc => doc.id !== deletedDocumentId);
        console.log(`🗑️ Removed document ${deletedDocumentId} from cache, ${filteredDocs.length} documents remaining`);
        return filteredDocs;
      });
      
      // Also invalidate all related queries to ensure consistency
      queryClient.invalidateQueries({ queryKey: [`/api/documents/deal/${dealId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/documents`] });
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}`] });
      
      toast({
        title: 'Document deleted',
        description: 'The document has been successfully deleted.',
      });
    },
    onError: () => {
      toast({
        title: 'Delete failed',
        description: 'There was an error deleting your document. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Edit document mutation - now saves both type and description
  const editDocumentMutation = useMutation({
    mutationFn: async ({ documentId, documentType, description }: { documentId: number, documentType: string, description?: string }) => {
      console.log(`🔄 Starting document update mutation: documentId=${documentId}, documentType=${documentType}, description=${description}`);
      const updateData: any = { documentType };
      if (description !== undefined) {
        updateData.description = description;
      }
      const result = await apiRequest('PATCH', `/api/documents/${documentId}`, updateData);
      console.log(`✅ Document update mutation completed:`, result);
      return result;
    },
    onSuccess: (data, variables) => {
      console.log(`🎉 Document update mutation onSuccess triggered for documentId=${variables.documentId}, newType=${variables.documentType}, newDescription=${variables.description}`);
      setIsEditDialogOpen(false);
      setEditingDocument(null);

      // 🔄 Immediately update ALL cached documents queries to prevent reversion
      queryClient.setQueryData([`/api/documents/deal/${dealId}`], (oldDocs: Document[] | undefined) => {
        if (!oldDocs) return oldDocs;
        const updatedDocs = oldDocs.map(doc =>
          doc.id === variables.documentId
            ? {
                ...doc,
                documentType: variables.documentType,
                description: variables.description,
              }
            : doc
        );
        console.log(`🔄 Updated documents cache directly:`, updatedDocs);
        return updatedDocs;
      });

      // 🔄 Invalidate all related queries to ensure consistency
      queryClient.invalidateQueries({ queryKey: [`/api/documents/deal/${dealId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/documents`] });
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}`] });

      // 🧠 Update selectedDocument to reflect the changes
      setSelectedDocument((prev) => {
        if (prev && prev.id === variables.documentId) {
          const updated = { 
            ...prev, 
            documentType: variables.documentType,
            description: variables.description 
          };
          console.log(`📝 Updated selectedDocument state:`, updated);
          return updated;
        }
        return prev;
      });
      
      console.log(`✅ Cache updated directly - no need for invalidation or refetch!`);
      
      toast({
        title: 'Document updated',
        description: 'Document type has been successfully updated.',
      });
      
      console.log(`✨ Document update process completed successfully`);
    },
    onError: (error) => {
      toast({
        title: 'Error updating document',
        description: error.message || 'Failed to update document type',
        variant: 'destructive',
      });
    },
  });

  const handleEditDocument = (document: Document) => {
    setEditingDocument(document);
    setEditDocumentType(document.documentType);
    setEditDescription(document.description || ''); // Set current description or empty string
    setIsEditDialogOpen(true);
  };

  const handleSaveDocumentType = () => {
    console.log(`💾 Save button clicked! editingDocument:`, editingDocument);
    console.log(`💾 editDocumentType:`, editDocumentType);
    console.log(`💾 editDescription:`, editDescription);
    
    if (editingDocument) {
      console.log(`✨ Calling mutation with documentId=${editingDocument.id}, documentType=${editDocumentType}, description=${editDescription}`);
      editDocumentMutation.mutate({
        documentId: editingDocument.id,
        documentType: editDocumentType,
        description: editDescription,
      });
    } else {
      console.log(`❌ No editingDocument found, cannot save`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadingFile(e.target.files[0]);
    }
  };
  
  // Drag and drop event handlers
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('bg-neutral-50', 'border-blue-300');
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('bg-neutral-50', 'border-blue-300');
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('bg-neutral-50', 'border-blue-300');
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // Only take the first file if multiple files are dropped
      setUploadingFile(e.dataTransfer.files[0]);
      
      // Log for debugging
      console.log('File dropped:', e.dataTransfer.files[0].name);
    }
  }, []);

  const handleUpload = async () => {
    if (!uploadingFile) return;

    setIsUploading(true);
    
    // Create FormData for file upload - this matches the multer implementation on the server
    const formData = new FormData();
    // The key 'file' must match the multer field name in upload.single('file')
    formData.append('file', uploadingFile);
    formData.append('dealId', dealId.toString());
    formData.append('documentType', documentType);
    // Will use the authenticated user's ID from the session in the backend
    if (description) {
      formData.append('description', description);
    }

    // Debug logging
    console.log('📤 Starting upload for:', {
      fileName: uploadingFile.name,
      dealId: dealId.toString(),
      documentType,
      description: description || 'none',
      endpoint: '/api/upload/simple-upload'
    });

    // Validate dealId exists before upload - check for known invalid IDs
    const invalidDealIds = [5]; // Add any other known invalid deal IDs here
    if (!dealId || invalidDealIds.includes(Number(dealId))) {
      console.error('❌ Invalid deal ID detected:', dealId);
      toast({
        title: 'Upload failed',
        description: `Deal ID ${dealId} does not exist. Please navigate to a valid deal and try again.`,
        variant: 'destructive',
      });
      setIsUploading(false);
      return;
    }

    // Check file size before upload (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (uploadingFile.size > maxSize) {
      console.error('❌ File too large:', uploadingFile.size);
      toast({
        title: 'File too large',
        description: `File size is ${(uploadingFile.size / 1024 / 1024).toFixed(1)}MB. Maximum allowed is 50MB.`,
        variant: 'destructive',
      });
      setIsUploading(false);
      return;
    }

    try {
      // Create an AbortController for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      // Use the reliable simple upload endpoint
      const res = await fetch('/api/upload/simple-upload', {
        method: 'POST',
        body: formData,
        credentials: 'include', // Include cookies for authentication
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      console.log('📡 Upload response status:', res.status);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('💥 Upload failed with status:', res.status, errorData);
        throw new Error(errorData.error || errorData.message || 'Failed to upload document');
      }
      
      const responseData = await res.json();
      console.log('✅ Upload successful:', responseData);
      
      // Force immediate refresh of document list
      await queryClient.invalidateQueries({ queryKey: [`/api/documents/deal/${dealId}`] });
      await queryClient.refetchQueries({ queryKey: [`/api/documents/deal/${dealId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}`] });
      
      toast({
        title: 'Document uploaded',
        description: `${uploadingFile.name} has been successfully uploaded.`,
      });
      
      // Reset form
      setIsUploadDialogOpen(false);
      setUploadingFile(null);
      setDescription('');
      setDocumentType('pitch_deck');
      
    } catch (error) {
      console.error('💥 Document upload error:', error);
      
      let errorMessage = 'There was an error uploading your document. Please try again.';
      
      if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
        errorMessage = 'Upload timed out after 30 seconds. Please try a smaller file or check your connection.';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: 'Upload failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };



  const getDocumentTypeIcon = (type: string, className = 'h-10 w-10') => {
    // Default icon
    return <FileText className={className} />;
  };
  
  const handleViewDocument = (document: Document) => {
    // Pre-check if document exists before setting it as selected
    // This helps avoid errors with the PDF viewer
    if (document.fileType === 'application/pdf' || document.fileName.toLowerCase().endsWith('.pdf')) {
      fetch(`/api/documents/${document.id}/download`, { 
        method: 'HEAD',
        credentials: 'include'
      })
      .then(response => {
        if (response.ok) {
          // Document exists, safe to select it
          setSelectedDocument(document);
        } else if (response.status === 404) {
          // Document is missing, show helpful error
          toast({
            title: 'Document file not found',
            description: 'The file may have been deleted or not properly saved. Try re-uploading the document.',
            variant: 'destructive'
          });
          // Still set as selected so user can see the error state in the viewer
          setSelectedDocument(document);
        } else {
          // Other server error
          toast({
            title: 'Error accessing document',
            description: `Server returned error ${response.status}. Try again later.`,
            variant: 'destructive'
          });
          setSelectedDocument(document);
        }
      })
      .catch(error => {
        // Network error
        console.error('Error checking document existence:', error);
        setSelectedDocument(document);
      });
    } else {
      // For non-PDF documents, just select without pre-check
      setSelectedDocument(document);
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-40 w-full bg-neutral-100 rounded-lg mb-4"></div>
        <div className="h-40 w-full bg-neutral-100 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-medium">Documents</h3>
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <FileUp className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
              <DialogDescription>
                Upload a document related to this deal. Supported formats include PDF, DOC, DOCX, XLS, XLSX, and more.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="documentType">Document Type</Label>
                <Select value={documentType} onValueChange={setDocumentType}>
                  <SelectTrigger id="documentType">
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pitch_deck">Pitch Deck</SelectItem>
                    <SelectItem value="financial_model">Financial Model</SelectItem>
                    <SelectItem value="legal_document">Legal Document</SelectItem>
                    <SelectItem value="diligence_report">Diligence Report</SelectItem>
                    <SelectItem value="investor_report">Investor Report</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea 
                  id="description" 
                  placeholder="Add a description for this document"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="file">File</Label>
                <div className="mt-1">
                  {uploadingFile ? (
                    <div className="flex items-center justify-between border p-3 rounded-md">
                      <div className="flex items-center">
                        <File className="h-5 w-5 text-blue-500 mr-2" />
                        <span className="text-sm truncate">{uploadingFile.name}</span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setUploadingFile(null)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div 
                      className="flex justify-center p-6 border border-dashed rounded-md cursor-pointer transition-colors duration-200"
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      <div className="text-center">
                        <FileUp className="h-10 w-10 text-neutral-400 mx-auto mb-2" />
                        <p className="text-sm font-medium">Click to select or drop a file</p>
                        <p className="text-xs text-neutral-500 mt-1">PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, etc.</p>
                      </div>
                    </div>
                  )}
                  <input 
                    id="file" 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={handleUpload} 
                disabled={!uploadingFile}
              >
                Upload Document
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Document Type Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Document Type</DialogTitle>
              <DialogDescription>
                Change the document type to properly categorize this file.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {editingDocument && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">Document: {editingDocument.fileName}</p>
                </div>
              )}
              <div>
                <Label htmlFor="editDocumentType">Document Type</Label>
                <Select value={editDocumentType} onValueChange={setEditDocumentType}>
                  <SelectTrigger id="editDocumentType">
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pitch_deck">Pitch Deck</SelectItem>
                    <SelectItem value="financial_model">Financial Model</SelectItem>
                    <SelectItem value="legal_document">Legal Document</SelectItem>
                    <SelectItem value="diligence_report">Diligence Report</SelectItem>
                    <SelectItem value="investor_report">Investor Report</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="editDescription">Description (Optional)</Label>
                <Input
                  id="editDescription"
                  type="text"
                  placeholder="Enter a description for this document..."
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={handleSaveDocumentType} 
                disabled={editDocumentMutation.isPending}
              >
                {editDocumentMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {documents && documents.length > 0 ? (
        <div>
          {/* Document list - compact view */}
          <div>
            <h3 className="text-sm font-medium mb-2">All Documents</h3>
            <div className="grid gap-2 grid-cols-1">
              {documents.map((document) => (
                <div 
                  key={document.id} 
                  className={`flex justify-between items-center p-2 rounded border cursor-pointer ${
                    selectedDocument?.id === document.id 
                      ? 'bg-blue-50 border-blue-200' 
                      : 'bg-neutral-50'
                  }`}
                  onClick={() => handleViewDocument(document)}
                >
                  <div className="flex items-center flex-1 min-w-0">
                    <div className="mr-2 flex-shrink-0 flex items-center justify-center bg-neutral-100 p-1.5 rounded">
                      {getDocumentTypeIcon(document.documentType, 'h-4 w-4')}
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-medium truncate">{document.fileName}</p>
                      <p className="text-xs text-neutral-500 truncate">
                        {(() => {
                          const label = getDocumentTypeLabel(document.documentType);
                          console.log(`🏷️ Document ${document.id} (${document.fileName}): documentType="${document.documentType}" → label="${label}"`);
                          return label;
                        })()} • {formatBytes(document.fileSize)}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-1 ml-2">
                    <Button variant="ghost" size="sm" asChild className="h-6 w-6 p-0">
                      <a 
                        href={`/api/documents/${document.id}/download`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditDocument(document);
                      }}
                    >
                      <Edit2 className="h-3.5 w-3.5 text-blue-500" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 w-6 p-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this document and cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(document.id)}
                          >
                            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Document preview section */}
          <div className="mt-8">
            {selectedDocument ? (
              <div className="space-y-1">
                <div className="flex justify-between items-center h-8 px-1">
                  <div className="text-xs text-neutral-500 truncate flex-1">
                    {selectedDocument.fileName}
                  </div>
                  <Button variant="ghost" size="sm" asChild className="h-6 w-6 p-0">
                    <a href={`/api/documents/${selectedDocument.id}/download`} target="_blank" rel="noopener noreferrer">
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                </div>
                
                <Card className="p-0 w-full overflow-hidden">
                  <div className="overflow-hidden h-[900px] bg-neutral-50 flex justify-center">
                    {selectedDocument.fileType === 'application/pdf' || 
                     selectedDocument.fileName.toLowerCase().endsWith('.pdf') ? (
                      <div className="w-full h-full">
                        <div id="pdf-viewer-container" className="w-full h-full">
                          <EmbeddedPDFViewer 
                            documentId={selectedDocument.id} 
                            documentName={selectedDocument.fileName}
                          />
                        </div>
                      </div>
                    ) : (
                      <iframe 
                        src={`/api/documents/${selectedDocument.id}/download`} 
                        className="w-full h-full border-0" 
                        title={selectedDocument.fileName}
                      />
                    )}
                  </div>
                </Card>
              </div>
            ) : (
              <Card className="p-6 w-full">
                <div className="flex flex-col items-center justify-center text-center">
                  <FileText className="h-12 w-12 text-neutral-300 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No document selected</h3>
                  <p className="text-neutral-500 text-sm max-w-md">
                    Select a document from the list above to preview it here.
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-neutral-500 bg-white rounded-lg shadow-sm">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No documents uploaded yet.</p>
          <Button 
            className="mt-4" 
            onClick={() => setIsUploadDialogOpen(true)}
          >
            <FileText className="h-4 w-4 mr-2" />
            Upload Document
          </Button>
        </div>
      )}
      
      {/* Modal PDF Viewer (for detailed view) */}
      {selectedDocument && (
        <EnhancedPDFViewer
          isOpen={isPdfViewerOpen}
          onClose={() => setIsPdfViewerOpen(false)}
          documentId={selectedDocument.id}
          documentName={selectedDocument.fileName}
        />
      )}
    </div>
  );
}