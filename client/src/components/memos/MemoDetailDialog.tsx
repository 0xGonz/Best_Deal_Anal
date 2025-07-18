import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { MiniMemoDisplay } from './MiniMemoDisplay';
import { MiniMemoForm } from './MiniMemoForm';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessageCircle, MoreVertical, Pencil, Trash2 } from 'lucide-react';

interface Comment {
  id: number;
  memoId: number;
  dealId: number;
  userId: number;
  text: string;
  createdAt: string;
  user?: {
    id: number;
    fullName: string;
    initials: string;
    avatarColor: string;
    role: string;
  };
}

interface MemoDetailDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  memo: any;
  dealId: number;
  onDelete?: () => void;
  onEdit?: () => void;
}

export function MemoDetailDialog({ isOpen, onOpenChange, memo, dealId, onDelete, onEdit }: MemoDetailDialogProps) {
  const { data: user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditMemoOpen, setIsEditMemoOpen] = useState(false);

  // Check if current user is the owner of the memo
  const isOwner = user?.id === memo?.userId;

  // Fetch comments when memo is opened
  useEffect(() => {
    if (isOpen && memo?.id) {
      fetchComments();
    }
  }, [isOpen, memo?.id]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/deals/${dealId}/memos/${memo.id}/comments`);
      if (response.ok) {
        const data = await response.json();
        setComments(data);
      } else {
        // If the endpoint doesn't exist yet, use empty array
        setComments([]);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
      setComments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    
    try {
      setIsSubmitting(true);
      
      // Send the comment to the API
      await apiRequest('POST', `/api/deals/${dealId}/memos/${memo.id}/comments`, {
        text: newComment,
        userId: user?.id,
        dealId: dealId,
        memoId: memo.id
      });
      
      // Add comment to local state (optimistic update)
      const newCommentObj: Comment = {
        id: Date.now(), // Temporary ID until we refresh
        memoId: memo.id,
        dealId: dealId,
        userId: user?.id || 0,
        text: newComment,
        createdAt: new Date().toISOString(),
        user: {
          id: user?.id || 0,
          fullName: user?.fullName || 'Anonymous',
          initials: user?.initials || user?.fullName?.substring(0, 2) || 'AN',
          avatarColor: user?.avatarColor || '#4338ca',
          role: user?.role || 'observer'
        }
      };
      
      setComments([...comments, newCommentObj]);
      setNewComment('');
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}`] });
      
      toast({
        title: 'Comment added',
        description: 'Your comment has been added to the memo',
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: 'Error',
        description: 'Failed to add comment',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMemo = async () => {
    try {
      setIsDeleting(true);
      
      // Call API to delete the memo
      const response = await apiRequest('DELETE', `/api/deals/${dealId}/memos/${memo.id}`);
      
      if (response.ok) {
        // Close both dialogs
        setIsDeleteDialogOpen(false);
        onOpenChange(false);
        
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}`] });
        
        // Show success toast
        toast({
          title: 'Memo deleted',
          description: 'Your memo has been successfully deleted',
        });
        
        // Call onDelete callback if provided
        if (onDelete) onDelete();
      } else {
        throw new Error('Failed to delete memo');
      }
    } catch (error) {
      console.error('Error deleting memo:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete memo. You can only delete memos you created.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle memo edit submission
  const handleEditSubmit = () => {
    setIsEditMemoOpen(false);
    // Refresh data
    queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}`] });
    
    // Show success message
    toast({
      title: 'Memo updated',
      description: 'Your memo has been updated successfully',
    });
    
    // Call onEdit callback if provided
    if (onEdit) onEdit();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader className="flex justify-between items-start">
            <div>
              <DialogTitle>Team Assessment Details</DialogTitle>
              <DialogDescription>
                View detailed assessment and add comments
              </DialogDescription>
            </div>
            
            {/* Show edit/delete options only if current user is the memo owner */}
            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="-mr-2 -mt-2">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    onClick={() => setIsEditMemoOpen(true)}
                    className="cursor-pointer"
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Memo
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => setIsDeleteDialogOpen(true)}
                    className="text-red-600 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Memo
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </DialogHeader>
          
          <div className="mt-4">
            <MiniMemoDisplay memo={memo} expanded={true} />
          </div>
          
          <div className="mt-6">
            <CardHeader className="px-0 pt-0 pb-2">
              <CardTitle className="text-base flex items-center gap-1">
                <MessageCircle className="h-4 w-4" />
                Comments
              </CardTitle>
            </CardHeader>
            
            <CardContent className="p-0 space-y-4">
              {loading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : comments.length > 0 ? (
                comments.map((comment) => (
                  <Card key={comment.id} className="p-3 bg-slate-50">
                    <div className="flex items-start gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback 
                          className="text-xs" 
                          style={{ backgroundColor: comment.user?.avatarColor || '#4338ca', color: '#fff' }}
                        >
                          {comment.user?.initials || '--'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                          <p className="text-sm font-medium">{comment.user?.fullName || 'Anonymous'}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(comment.createdAt).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <p className="text-sm mt-1">{comment.text}</p>
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <div className="text-center py-4 text-gray-500">
                  <p className="text-sm">No comments yet</p>
                  <p className="text-xs mt-1">Be the first to comment on this assessment</p>
                </div>
              )}
            </CardContent>
            
            <CardFooter className="px-0 pt-3 pb-0 flex flex-col items-stretch">
              <div className="mt-2 relative">
                <Textarea
                  placeholder="Add your comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="min-h-[80px] pr-16"
                />
                <Button 
                  size="sm" 
                  onClick={handleSubmitComment} 
                  disabled={isSubmitting || !newComment.trim()}
                  className="absolute bottom-2 right-2"
                >
                  {isSubmitting ? (
                    <div className="flex items-center">
                      <div className="h-3 w-3 mr-1 animate-spin rounded-full border-b-2 border-white"></div>
                      <span>Posting...</span>
                    </div>
                  ) : 'Post'}
                </Button>
              </div>
            </CardFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your memo assessment. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteMemo} 
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <div className="flex items-center">
                  <div className="h-3 w-3 mr-1 animate-spin rounded-full border-b-2 border-white"></div>
                  <span>Deleting...</span>
                </div>
              ) : 'Delete Memo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit memo form dialog */}
      {isEditMemoOpen && memo && (
        <MiniMemoForm
          isOpen={isEditMemoOpen}
          onOpenChange={setIsEditMemoOpen}
          dealId={dealId}
          initialData={memo}
          onSubmit={handleEditSubmit}
          isEdit={true}
        />
      )}
    </>
  );
}
