import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  AlertTriangle, 
  Plus, 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  XCircle,
  TrendingDown,
  Shield,
  DollarSign,
  Users,
  Zap,
  Scale,
  Target,
  Calendar,
  MoreHorizontal
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { UserAvatar } from '@/components/common/UserAvatar';
import { useAuth } from '@/hooks/use-auth';

interface DevilsAdvocateComment {
  id: number;
  dealId: number;
  userId: number;
  title: string;
  content: string;
  category: 'market_risk' | 'execution_risk' | 'financial_risk' | 'competitive_risk' | 'regulatory_risk' | 'team_risk' | 'technology_risk' | 'timing_risk' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'addressed' | 'dismissed';
  response?: string;
  respondedBy?: number;
  respondedAt?: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: number;
    fullName: string;
    initials: string;
    avatarColor: string;
  };
  respondent?: {
    id: number;
    fullName: string;
    initials: string;
    avatarColor: string;
  };
}

interface DevilsAdvocateTabProps {
  dealId: number;
}

const commentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  category: z.enum(['market_risk', 'execution_risk', 'financial_risk', 'competitive_risk', 'regulatory_risk', 'team_risk', 'technology_risk', 'timing_risk', 'other']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
});

const responseSchema = z.object({
  response: z.string().min(1, 'Response is required'),
});

type CommentFormData = z.infer<typeof commentSchema>;
type ResponseFormData = z.infer<typeof responseSchema>;

const categoryIcons = {
  market_risk: TrendingDown,
  execution_risk: Target,
  financial_risk: DollarSign,
  competitive_risk: Shield,
  regulatory_risk: Scale,
  team_risk: Users,
  technology_risk: Zap,
  timing_risk: Calendar,
  other: MoreHorizontal,
};

const categoryLabels = {
  market_risk: 'Market Risk',
  execution_risk: 'Execution Risk',
  financial_risk: 'Financial Risk',
  competitive_risk: 'Competitive Risk',
  regulatory_risk: 'Regulatory Risk',
  team_risk: 'Team Risk',
  technology_risk: 'Technology Risk',
  timing_risk: 'Timing Risk',
  other: 'Other',
};

const severityColors = {
  low: 'bg-green-100 text-green-800 border-green-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  critical: 'bg-red-100 text-red-800 border-red-200',
};

const statusColors = {
  open: 'bg-blue-100 text-blue-800 border-blue-200',
  addressed: 'bg-green-100 text-green-800 border-green-200',
  dismissed: 'bg-gray-100 text-gray-800 border-gray-200',
};

export const DevilsAdvocateTab: React.FC<DevilsAdvocateTabProps> = ({ dealId }) => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isRespondDialogOpen, setIsRespondDialogOpen] = useState(false);
  const [selectedComment, setSelectedComment] = useState<DevilsAdvocateComment | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: user } = useAuth();

  // Fetch devil's advocate comments
  const { data: comments = [], isLoading } = useQuery<DevilsAdvocateComment[]>({
    queryKey: [`/api/deals/${dealId}/devils-advocate`],
    enabled: !!dealId,
  });

  const form = useForm<CommentFormData>({
    resolver: zodResolver(commentSchema),
    defaultValues: {
      category: 'other',
      severity: 'medium',
    },
  });

  const responseForm = useForm<ResponseFormData>({
    resolver: zodResolver(responseSchema),
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: (data: CommentFormData) => 
      apiRequest('POST', `/api/deals/${dealId}/devils-advocate`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/devils-advocate`] });
      setIsAddDialogOpen(false);
      form.reset();
      toast({
        title: "Concern added",
        description: "Your devil's advocate comment has been added successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add comment. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Respond to comment mutation
  const respondMutation = useMutation({
    mutationFn: ({ commentId, data }: { commentId: number; data: ResponseFormData }) =>
      apiRequest('PATCH', `/api/deals/${dealId}/devils-advocate/${commentId}/respond`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/devils-advocate`] });
      setIsRespondDialogOpen(false);
      setSelectedComment(null);
      responseForm.reset();
      toast({
        title: "Response added",
        description: "Your response has been added successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add response. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ commentId, status }: { commentId: number; status: string }) =>
      apiRequest('PATCH', `/api/deals/${dealId}/devils-advocate/${commentId}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/devils-advocate`] });
      toast({
        title: "Status updated",
        description: "Comment status has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update status. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CommentFormData) => {
    addCommentMutation.mutate(data);
  };

  const onRespond = (data: ResponseFormData) => {
    if (selectedComment) {
      respondMutation.mutate({ commentId: selectedComment.id, data });
    }
  };

  const handleStatusUpdate = (commentId: number, status: string) => {
    updateStatusMutation.mutate({ commentId, status });
  };

  const openResponseDialog = (comment: DevilsAdvocateComment) => {
    setSelectedComment(comment);
    setIsRespondDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-20 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-red-600" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Devil's Advocate</h2>
            <p className="text-sm text-gray-600">
              Challenge assumptions and identify potential risks
            </p>
          </div>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Concern
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Devil's Advocate Comment</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Brief description of the concern..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(categoryLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="severity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Severity</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="critical">Critical</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Detailed Concern</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Explain the potential risk, concern, or issue in detail. What could go wrong? What are the implications?"
                          className="min-h-[120px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsAddDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={addCommentMutation.isPending}>
                    {addCommentMutation.isPending ? 'Adding...' : 'Add Concern'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Comments List */}
      {comments.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No concerns raised yet
            </h3>
            <p className="text-gray-600 mb-4">
              Be the first to play devil's advocate and identify potential risks
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              Add First Concern
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => {
            const CategoryIcon = categoryIcons[comment.category];
            
            return (
              <Card key={comment.id} className="border-l-4 border-l-red-500">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <CategoryIcon className="h-5 w-5 text-gray-600 mt-0.5" />
                      <div className="flex-1">
                        <CardTitle className="text-lg">{comment.title}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={severityColors[comment.severity]}>
                            {comment.severity.toUpperCase()}
                          </Badge>
                          <Badge className={statusColors[comment.status]}>
                            {comment.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                          <Badge variant="outline">
                            {categoryLabels[comment.category]}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {comment.user && (
                        <UserAvatar 
                          user={comment.user}
                          size="sm"
                        />
                      )}
                      <span className="text-sm text-gray-500">
                        {new Date(comment.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <p className="text-gray-700 leading-relaxed">{comment.content}</p>
                  
                  {comment.response && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageSquare className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-green-800">Team Response</span>
                        {comment.respondent && (
                          <div className="flex items-center gap-2 ml-auto">
                            <UserAvatar 
                              user={comment.respondent}
                              size="xs"
                            />
                            <span className="text-xs text-green-600">
                              {comment.respondedAt && new Date(comment.respondedAt).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                      <p className="text-green-700">{comment.response}</p>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-2">
                      {comment.status === 'open' && !comment.response && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => openResponseDialog(comment)}
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Respond
                        </Button>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {comment.status === 'open' && (
                        <>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleStatusUpdate(comment.id, 'addressed')}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Mark Addressed
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleStatusUpdate(comment.id, 'dismissed')}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Dismiss
                          </Button>
                        </>
                      )}
                      
                      {comment.status !== 'open' && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleStatusUpdate(comment.id, 'open')}
                        >
                          <Clock className="h-4 w-4 mr-2" />
                          Reopen
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Response Dialog */}
      <Dialog open={isRespondDialogOpen} onOpenChange={setIsRespondDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Respond to Concern</DialogTitle>
          </DialogHeader>
          {selectedComment && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium mb-2">{selectedComment.title}</h4>
                <p className="text-sm text-gray-600">{selectedComment.content}</p>
              </div>
              
              <Form {...responseForm}>
                <form onSubmit={responseForm.handleSubmit(onRespond)} className="space-y-4">
                  <FormField
                    control={responseForm.control}
                    name="response"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Your Response</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Address the concern, provide mitigation strategies, or explain why this risk is acceptable..."
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsRespondDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={respondMutation.isPending}>
                      {respondMutation.isPending ? 'Responding...' : 'Add Response'}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DevilsAdvocateTab;