import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useDocs, DocMeta } from '@/context/DocumentsContext';
import { FileUp, Trash2, FileText, Edit2, Check } from 'lucide-react';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { getDocumentTypeLabel } from '@/../../shared/document-types';

// Document type options for dropdown
const documentTypeOptions = [
  { value: 'other', label: 'Other' },
  { value: 'pitch_deck', label: 'Pitch Deck' },
  { value: 'financial_model', label: 'Financial Model' },
  { value: 'legal_document', label: 'Legal Document' },
  { value: 'diligence_report', label: 'Diligence Report' },
  { value: 'investor_report', label: 'Investor Report' },
];

export const Sidebar = ({ dealId }: { dealId: number }) => {
  const { docs, setDocs, current, setCurrent } = useDocs();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mutation to upload a document
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('dealId', dealId.toString());
      formData.append('documentType', 'other'); // Default document type
      
      const response = await fetch(`/api/documents/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include', // Include session cookies for authentication
      });
      
      if (!response.ok) {
        // Try to get more specific error message from the server
        const errorData = await response.json().catch(() => null);
        
        if (errorData && errorData.message) {
          throw new Error(errorData.message);
        } else if (errorData && errorData.error) {
          throw new Error(errorData.error);
        } else {
          throw new Error(`Failed to upload document (${response.status})`);
        }
      }
      
      const data = await response.json();
      
      const docMeta: DocMeta = {
        id: data.id || data.documentId,
        name: data.fileName,
        fileName: data.fileName,
        fileType: data.fileType,
        downloadUrl: `/api/documents/${data.id || data.documentId}/download`,
        documentType: data.documentType
      };
      
      return docMeta;
    },
    onSuccess: (newDoc: DocMeta) => {
      setDocs((prev: DocMeta[]) => [...prev, newDoc]);
      toast({
        title: "Document uploaded successfully",
        description: `${newDoc.name} has been uploaded.`
      });
      queryClient.invalidateQueries({ queryKey: [`/api/documents/deal/${dealId}`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload document",
        variant: "destructive"
      });
    }
  });

  // Mutation to update document type
  const updateDocumentTypeMutation = useMutation({
    mutationFn: async ({ id, documentType }: { id: number, documentType: string }) => {
      const response = await fetch(`/api/documents/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documentType }),
        credentials: 'include', // Include session cookies for authentication
      });
      
      if (!response.ok) {
        throw new Error('Failed to update document type');
      }
      
      return { id, documentType };
    },
    onSuccess: ({ id, documentType }) => {
      setDocs((prev: DocMeta[]) => 
        prev.map(doc => 
          doc.id === id 
            ? { ...doc, documentType } 
            : doc
        )
      );
      if (current?.id === id) {
        setCurrent({ ...current, documentType });
      }
      
      // Invalidate all document-related queries to ensure consistency across components
      queryClient.invalidateQueries({ queryKey: [`/api/documents/deal/${dealId}`] });
      
      toast({
        title: "Document type updated",
        description: `Document type changed to ${getDocumentTypeLabel(documentType)}.`
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: "Failed to update document type",
        variant: "destructive"
      });
    }
  });

  // Mutation to delete a document
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
        credentials: 'include', // Include session cookies for authentication
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete document');
      }
      
      return id;
    },
    onSuccess: (id: number) => {
      setDocs((prev: DocMeta[]) => prev.filter((d: DocMeta) => d.id !== id));
      if (current?.id === id) {
        setCurrent(null);
      }
      
      // Invalidate all document-related queries to ensure consistency across components
      queryClient.invalidateQueries({ queryKey: [`/api/documents/deal/${dealId}`] });
      
      toast({
        title: "Document deleted",
        description: "The document has been removed."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: "Failed to delete document",
        variant: "destructive"
      });
    }
  });

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    // Reset the input
    e.target.value = '';
  };

  const handleFileUpload = (file: File) => {
    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB in bytes
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Please select a file smaller than 50MB.",
        variant: "destructive"
      });
      return;
    }
    
    // Check if the file type is supported
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    const supportedExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx'];
    
    if (!fileExt || !supportedExtensions.includes(fileExt)) {
      toast({
        title: "Unsupported file type",
        description: `Only ${supportedExtensions.join(', ')} files are supported. You tried to upload a ${fileExt || 'unknown'} file.`,
        variant: "destructive"
      });
      return;
    }
    
    // Upload the file
    uploadMutation.mutate(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  // State to track when we're dragging over the drop zone
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isDraggingOver) {
      setIsDraggingOver(true);
    }
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  return (
    <div 
      className={`p-4 h-full flex flex-col ${isDraggingOver ? 'bg-primary/10 border-2 border-dashed border-primary/50 rounded' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDragEnd={() => setIsDraggingOver(false)}
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium">Documents</h3>
        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf,.doc,.docx,.xls,.xlsx"
            className="hidden"
          />
          <Button 
            onClick={handleFileSelect}
            size="sm"
            disabled={uploadMutation.isPending}
            className="bg-[#136c34] hover:bg-[#B71C1C] text-white"
          >
            <FileUp className="h-4 w-4 mr-1" />
            {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {docs.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm p-4">
            No documents uploaded yet
          </div>
        ) : (
          <div className="space-y-2">
            {docs.map((doc) => (
              <div
                key={doc.id}
                role="button"
                aria-label={`View ${doc.name}`}
                className={`flex justify-between items-center p-2 rounded cursor-pointer ${
                  current?.id === doc.id
                    ? 'bg-secondary/50 border border-secondary'
                    : 'hover:bg-secondary/20'
                }`}
                onClick={() => setCurrent(doc)}
              >
                <div className="flex items-center overflow-hidden">
                  <FileText className="h-4 w-4 mr-2 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="truncate text-sm block">{doc.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {getDocumentTypeLabel(doc.documentType || 'other')}
                    </span>
                  </div>
                </div>
                <div className="flex space-x-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        aria-label={`Edit document type: ${doc.name}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Edit2 className="h-3.5 w-3.5 text-blue-500" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {documentTypeOptions.map((option) => (
                        <DropdownMenuItem
                          key={option.value}
                          onClick={(e) => {
                            e.stopPropagation();
                            updateDocumentTypeMutation.mutate({
                              id: doc.id,
                              documentType: option.value
                            });
                          }}
                          className="flex items-center justify-between"
                        >
                          <span>{option.label}</span>
                          {(doc.documentType || 'other') === option.value && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        aria-label={`Delete document: ${doc.name}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete document?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete this document. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate(doc.id)}
                          disabled={deleteMutation.isPending}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};