import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { usePermissions } from "@/hooks/use-permissions";
import AppLayout from "@/components/layout/AppLayout";
import Timeline from "@/components/deals/Timeline";
import EditDealModal from "@/components/deals/EditDealModal";
import AssignUserModal from "@/components/deals/AssignUserModal";
import AllocateFundModal from "@/components/deals/AllocateFundModal";
import StageProgression from "@/components/deals/StageProgression";
import { DocumentsTab } from "@/components/documents/DocumentsTab";
import { MiniMemoForm } from "@/components/memos/MiniMemoForm";
import { MiniMemoDisplay } from "@/components/memos/MiniMemoDisplay";
import { MemoDetailDialog } from "@/components/memos/MemoDetailDialog";
import { CreateCapitalCallForm } from "@/components/capitalcalls/CreateCapitalCallForm";
import CapitalCallsList from "@/components/capitalcalls/CapitalCallsList";
import MeetingsList from "@/components/meetings/MeetingsList";
import ClosingEventsList from "@/components/closings/ClosingEventsList";
import UnifiedCalendarView from "@/components/calendar/UnifiedCalendarView";
import { CreateMeetingForm } from "@/components/meetings/CreateMeetingForm";
import { UserAvatar } from "@/components/common/UserAvatar";
import AIAnalysisTab from "@/components/AIAnalysisTab";
import { DocumentAnalysisPanel } from "@/components/DocumentAnalysisPanel";
import InvestmentTrackingTab from "@/components/deals/InvestmentTrackingTab";
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent,
  CardFooter
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Tabs, 
  TabsList, 
  TabsTrigger, 
  TabsContent 
} from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { 
  ChevronLeft, 
  ChevronDown,
  Star, 
  Edit, 
  Share2, 
  MessageSquare, 
  FileText, 
  Users, 
  DollarSign, 
  Building,
  Info as InfoIcon,
  Calendar, 
  Mail,
  BarChart4,
  Trash2
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { getDealStageBadgeClass } from "@/lib/utils/format";
import { enrichDealWithComputedProps } from "@/lib/utils";
import { Deal, MiniMemo, User } from "@/lib/types";
import { DEFAULT_EMPTY_TEXT, DEFAULT_AVATAR_TEXT, COMPANY_LABELS } from "@/lib/constants/display-constants";
import { DEAL_STAGES } from "@/lib/constants/deal-constants";
import { COMPANY_STAGES, CompanyStage } from "@/lib/constants/company-stages";

export default function DealDetail() {
  const [match, params] = useRoute("/deals/:id");
  const [newNote, setNewNote] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [, setLocation] = useLocation();
  const [selectedMemo, setSelectedMemo] = useState<MiniMemo | null>(null);
  const [isMemoDetailOpen, setIsMemoDetailOpen] = useState(false);
  const [isAllocateModalOpen, setIsAllocateModalOpen] = useState(false);
  const [isCapitalCallFormOpen, setIsCapitalCallFormOpen] = useState(false);
  const [isMeetingFormOpen, setIsMeetingFormOpen] = useState(false);
  
  // Get the active tab from URL query parameter
  const getActiveTab = () => {
    const searchParams = new URLSearchParams(window.location.search);
    const tab = searchParams.get('tab');
    return tab === 'timeline' || tab === 'memos' || tab === 'documents' || tab === 'calendar' || tab === 'ai-analysis'
      ? tab 
      : 'documents'; // Default tab
  };
  
  const [activeTab, setActiveTab] = useState(getActiveTab());
  
  const { toast } = useToast();
  const { canEdit, canDelete, canCreate } = usePermissions();
  
  // Safety check - redirect if ID is invalid
  const dealId = params?.id;
  if (!dealId || dealId === 'undefined' || dealId === 'null' || isNaN(Number(dealId))) {
    // Do a client-side redirect if the ID is missing or invalid
    setTimeout(() => {
      toast({
        title: "Error",
        description: "Invalid deal ID. Redirecting to pipeline.",
        variant: "destructive"
      });
      setLocation("/pipeline");
    }, 0);
    return <AppLayout><div className="p-6">Redirecting...</div></AppLayout>;
  }
  
  const { data: rawDeal, isLoading, refetch } = useQuery<Deal>({
    queryKey: [`/api/deals/${dealId}`],
    enabled: !!dealId,
  });
  
  // Apply computed properties to deal data
  const deal = rawDeal;
  
  // Get the stars for this deal to check if current user has starred it
  const { data: stars = [] } = useQuery({
    queryKey: [`/api/deals/${dealId}/stars`],
    enabled: !!dealId
  });
  
  // Get the current user info
  const { data: currentUser } = useAuth();
  
  // Check if current user has already starred this deal
  const hasUserStarred = Array.isArray(stars) && stars.some((star: any) => currentUser && star.userId === currentUser.id);
  
  const addNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", `/api/deals/${dealId}/timeline`, {
        eventType: "note",
        content,
        metadata: {}
      });
    },
    onSuccess: async () => {
      setNewNote("");
      toast({
        title: "Note added",
        description: "Your note has been added to the timeline."
      });
      await queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}`] });
      await queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/timeline`] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add note. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  const starDealMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/deals/${dealId}/star`, {});
    },
    onSuccess: async (response) => {
      const result = await response.json();
      toast({
        title: result.action === 'starred' ? "Deal starred" : "Star removed",
        description: result.action === 'starred' 
          ? "This deal has been added to your starred deals."
          : "This deal has been removed from your starred deals."
      });
      await queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}`] });
      await queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/stars`] });
      await queryClient.invalidateQueries({ queryKey: ['/api/leaderboard'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to star deal. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  const handleAddNote = () => {
    if (!newNote.trim()) return;
    addNoteMutation.mutate(newNote);
  };
  
  const handleStarDeal = () => {
    starDealMutation.mutate();
  };
  
  const updateDealMutation = useMutation({
    mutationFn: async (dealUpdate: { id: number, [key: string]: any }) => {
      return apiRequest("PATCH", `/api/deals/${dealUpdate.id}`, dealUpdate);
    },
    onSuccess: async () => {
      toast({
        title: "Deal updated",
        description: "The deal has been successfully updated."
      });
      
      // Invalidate relevant queries
      await queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}`] });
      await queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      await queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/timeline`] });
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update deal. Please try again.",
        variant: "destructive"
      });
    }
  });

  const deleteDealMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/deals/${dealId}`, {});
    },
    onSuccess: async () => {
      toast({
        title: "Deal deleted",
        description: "The deal has been permanently deleted."
      });
      
      // Invalidate relevant queries
      await queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/leaderboard"] });
      
      // Redirect to pipeline page
      setLocation("/pipeline");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete deal. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  const handleDeleteDeal = () => {
    // Deal ID should already be validated with our early return guard
    // at the beginning of the component
    deleteDealMutation.mutate();
  };
  
  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex-1 overflow-y-auto pb-20">
          <div className="animate-pulse">
            <div className="h-8 w-64 bg-neutral-200 rounded mb-4"></div>
            <div className="h-32 bg-white rounded-lg shadow-sm mb-6"></div>
            <div className="h-96 bg-white rounded-lg shadow-sm"></div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto pb-20">
        {/* Edit Deal Modal */}
        {deal && 
          <EditDealModal 
            isOpen={isEditModalOpen} 
            onClose={() => setIsEditModalOpen(false)} 
            dealId={Number(dealId)} 
          />
        }
        
        {/* Assign User Modal */}
        {deal && 
          <AssignUserModal
            isOpen={isAssignModalOpen}
            onClose={() => setIsAssignModalOpen(false)}
            dealId={Number(dealId)}
          />
        }
        
        {/* Memo Detail Dialog */}
        {selectedMemo && deal && (
          <MemoDetailDialog
            isOpen={isMemoDetailOpen}
            onOpenChange={setIsMemoDetailOpen}
            memo={selectedMemo}
            dealId={Number(dealId)}
          />
        )}
        
        {/* Allocate Fund Modal */}
        {deal && (
          <AllocateFundModal
            isOpen={isAllocateModalOpen}
            onClose={() => setIsAllocateModalOpen(false)}
            dealId={Number(dealId)}
            dealName={deal.name}
          />
        )}
        
        {/* Capital Call Form */}
        {deal && (
          <CreateCapitalCallForm
            isOpen={isCapitalCallFormOpen}
            onClose={() => setIsCapitalCallFormOpen(false)}
            dealId={Number(dealId)}
            onSuccess={() => {
              // Refresh capital calls data
              queryClient.invalidateQueries({ queryKey: [`/api/capital-calls/deal/${dealId}`] });
            }}
          />
        )}
        
        {/* Back button and page title */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center justify-between">
            <Button variant="ghost" className="mr-2 h-9 px-2 sm:px-3" asChild>
              <a href="/pipeline" className="flex items-center">
                <ChevronLeft className="h-4 w-4 mr-1" />
                <span className="text-sm">Back</span>
              </a>
            </Button>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                className="h-9 px-2 sm:px-3"
                onClick={handleStarDeal}
              >
                <Star className={`h-4 w-4 sm:mr-1 ${hasUserStarred ? 'fill-accent text-accent' : ''}`} />
                <span className="hidden sm:inline">{hasUserStarred ? 'Starred' : 'Star'} {deal?.starCount ? `(${deal.starCount})` : ''}</span>
              </Button>
              {canEdit('deal') && (
                <Button 
                  size="sm"
                  className="h-9 px-2 sm:px-3"
                  onClick={() => setIsEditModalOpen(true)}
                >
                  <Edit className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Edit</span>
                </Button>
              )}
              {deal?.stage === DEAL_STAGES.INVESTED && canEdit('fund') && (
                <Button 
                  size="sm"
                  variant="outline"
                  className="h-9 px-2 sm:px-3 text-green-600 border-green-600 hover:bg-green-50"
                  onClick={() => setIsAllocateModalOpen(true)}
                >
                  <DollarSign className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Allocate</span>
                </Button>
              )}
              {canDelete('deal') && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      className="h-9 px-2 sm:px-3"
                    >
                      <Trash2 className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">Delete</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure you want to delete this deal?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the deal
                        and all its associated data including timeline events, memos, and allocations.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteDeal}>
                        {deleteDealMutation.isPending ? "Deleting..." : "Delete Deal"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
          
          <h1 className="text-xl sm:text-2xl font-semibold text-neutral-800">{deal?.name}</h1>
        </div>
        
        {/* Deal Overview Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 sm:gap-0">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={`${getDealStageBadgeClass(deal?.stage || '')} text-xs sm:text-sm px-2 py-0.5`}>
                    {deal?.stageLabel}
                  </Badge>
                  {canEdit('deal') && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                          Change Stage <ChevronDown className="ml-1 h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56">
                        <DropdownMenuLabel className="text-xs">Change stage to:</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {Object.entries(DEAL_STAGES).map(([key, value]) => (
                          <DropdownMenuItem 
                            key={key}
                            disabled={deal?.stage === value}
                            onClick={() => {
                              if (dealId && deal?.stage !== value) {
                                updateDealMutation.mutate({ 
                                  id: Number(dealId), 
                                  stage: value 
                                });
                              }
                            }}
                            className="text-xs flex items-center justify-between px-3 py-1.5"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Badge className={`${getDealStageBadgeClass(value)} text-xs px-1.5 py-0 whitespace-nowrap`}>
                                {key.replace(/_/g, ' ')}
                              </Badge>
                              <span className="truncate">{key.replace(/_/g, ' ')}</span>
                            </div>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <CardTitle className="text-lg sm:text-xl">{deal?.name}</CardTitle>
                <CardDescription className="text-sm leading-normal mt-1">{deal?.description}</CardDescription>
              </div>
              <div className="flex items-center self-end sm:self-start mt-2 sm:mt-0">
                <div className="flex -space-x-2 mr-2 sm:mr-4">
                  {deal?.assignedUsers ? deal.assignedUsers.map((user: User) => (
                    <div 
                      key={user.id}
                      className="border-2 border-white rounded-full overflow-hidden h-7 w-7 sm:h-8 sm:w-8"
                    >
                      <UserAvatar 
                        user={user} 
                        size="sm"
                      />
                    </div>
                  )) : (
                    <div className="border-2 border-white rounded-full overflow-hidden h-7 w-7 sm:h-8 sm:w-8 bg-neutral-300 text-neutral-700 flex items-center justify-center text-xs sm:text-sm">
                      {DEFAULT_AVATAR_TEXT}
                    </div>
                  )}
                </div>
                {canEdit('deal') && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="h-7 sm:h-8 px-2 sm:px-3 text-xs sm:text-sm" 
                    onClick={() => setIsAssignModalOpen(true)}
                  >
                    <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    Assign
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {/* Row 1 */}
              <div>
                <h3 className="text-xs sm:text-sm font-medium text-neutral-500 mb-1.5 sm:mb-2">Deal Details</h3>
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-start">
                    <Building className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-neutral-500 mt-0.5 mr-1.5 sm:mr-2 flex-shrink-0" />
                    <div>
                      <p className="text-xs sm:text-sm font-medium">Sector</p>
                      <p className="text-xs sm:text-sm text-neutral-600 truncate">{deal?.sector || DEFAULT_EMPTY_TEXT}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-neutral-500 mt-0.5 mr-1.5 sm:mr-2 flex-shrink-0" />
                    <div>
                      <p className="text-xs sm:text-sm font-medium">Added</p>
                      <p className="text-xs sm:text-sm text-neutral-600 truncate">
                        {deal?.createdAt ? formatDistanceToNow(new Date(deal.createdAt), { addSuffix: true }) : 'Recently'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-xs sm:text-sm font-medium text-neutral-500 mb-1.5 sm:mb-2">Company Info</h3>
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-start">
                    <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-neutral-500 mt-0.5 mr-1.5 sm:mr-2 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-medium">Contact</p>
                      <p className="text-xs sm:text-sm text-neutral-600 truncate">{deal?.contactEmail || DEFAULT_EMPTY_TEXT}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <InfoIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-neutral-500 mt-0.5 mr-1.5 sm:mr-2 flex-shrink-0" />
                    <div>
                      <p className="text-xs sm:text-sm font-medium">Company Stage</p>
                      <p className="text-xs sm:text-sm text-neutral-600">
                        {deal?.companyStage ? COMPANY_STAGES[deal.companyStage as CompanyStage] : DEFAULT_EMPTY_TEXT}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-xs sm:text-sm font-medium text-neutral-500 mb-1.5 sm:mb-2">Evaluation</h3>
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-start">
                    <BarChart4 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-neutral-500 mt-0.5 mr-1.5 sm:mr-2 flex-shrink-0" />
                    <div>
                      <p className="text-xs sm:text-sm font-medium">Leaderboard Score</p>
                      <p className="text-xs sm:text-sm text-neutral-600 font-semibold">{deal?.score || 'Not rated'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <Star className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-neutral-500 mt-0.5 mr-1.5 sm:mr-2 flex-shrink-0" />
                    <div>
                      <p className="text-xs sm:text-sm font-medium">Stars</p>
                      <p className="text-xs sm:text-sm text-neutral-600">{deal?.starCount || 0}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-xs sm:text-sm font-medium text-neutral-500 mb-1.5 sm:mb-2">Return Metrics</h3>
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-start">
                    <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-neutral-500 mt-0.5 mr-1.5 sm:mr-2 flex-shrink-0" />
                    <div>
                      <p className="text-xs sm:text-sm font-medium">Target Return</p>
                      <p className="text-xs sm:text-sm text-neutral-600">
                        {deal?.targetReturn ? `${deal.targetReturn}${!deal.targetReturn.includes('%') ? '%' : ''}` : 'Not specified'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-neutral-500 mt-0.5 mr-1.5 sm:mr-2 flex-shrink-0" />
                    <div>
                      <p className="text-xs sm:text-sm font-medium">Projected Multiple</p>
                      <p className="text-xs sm:text-sm text-neutral-600">
                        {deal?.projectedMultiple ? `${deal.projectedMultiple}x` : 'Not specified'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Row 2 - Removed deal size, ownership, memos, and investment thesis sections as requested */}
            </div>
          </CardContent>
        </Card>
        
        {/* Main content tabs */}
        <Tabs 
          value={activeTab} 
          onValueChange={(value) => {
            setActiveTab(value);
            // Update the URL query parameter without page refresh
            const url = new URL(window.location.href);
            url.searchParams.set('tab', value);
            window.history.pushState({}, '', url);
          }} 
          className="space-y-4"
        >
          <div className="overflow-x-auto pb-1">
            <TabsList className="flex w-auto min-w-full sm:w-full sm:min-w-0">
              <TabsTrigger value="documents" className="text-xs sm:text-sm h-8 sm:h-10 px-2 sm:px-4 flex-1">
                Documents
              </TabsTrigger>
              <TabsTrigger value="timeline" className="text-xs sm:text-sm h-8 sm:h-10 px-2 sm:px-4 flex-1">
                Timeline
              </TabsTrigger>
              <TabsTrigger value="memos" className="text-xs sm:text-sm h-8 sm:h-10 px-2 sm:px-4 flex-1">
                Mini-Memos
              </TabsTrigger>
              <TabsTrigger value="calendar" className="text-xs sm:text-sm h-8 sm:h-10 px-2 sm:px-4 flex-1">
                Calendar
              </TabsTrigger>
              <TabsTrigger value="ai-analysis" className="text-xs sm:text-sm h-8 sm:h-10 px-2 sm:px-4 flex-1">
                AI Analysis
              </TabsTrigger>
              <TabsTrigger value="investments" className="text-xs sm:text-sm h-8 sm:h-10 px-2 sm:px-4 flex-1">
                Investments
              </TabsTrigger>
              <TabsTrigger value="distributions" className="text-xs sm:text-sm h-8 sm:h-10 px-2 sm:px-4 flex-1">
                Distributions
              </TabsTrigger>

            </TabsList>
          </div>
          

          
          <TabsContent value="timeline">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 mt-4">
              <div className="sm:col-span-12 md:col-span-12">
                <Card>
                  <CardContent className="p-6">
                    <Timeline dealId={deal?.id} />
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="memos">
            <div className="mt-4">
              <Card>
                <CardHeader className="pb-2 sm:pb-4">
                  <CardTitle className="text-base sm:text-xl">Mini-Memos</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Investment theses and evaluations
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  {deal?.miniMemos?.length ? (
                    <div className="space-y-4 sm:space-y-6">
                      {/* Display header explaining team assessments */}
                      <div className="text-sm text-muted-foreground p-2 rounded bg-muted/50">
                        <InfoIcon className="h-4 w-4 inline-block mr-2" />
                        Team members can submit individual assessments for collaborative evaluation.
                      </div>
                    
                      {/* Add button to create a new memo */}
                      <div className="flex justify-end">
                        <MiniMemoForm
                          dealId={deal.id}
                          onSubmit={() => refetch()}
                          buttonLabel="Add Team Assessment"
                          buttonVariant="outline"
                          buttonSize="sm"
                          buttonIcon={<Users className="h-3.5 w-3.5 mr-1.5" />}
                        />
                      </div>
                      
                      {/* Loop through deal's mini memos but display as multiple cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {deal.miniMemos.map((memo: MiniMemo) => (
                          <MiniMemoDisplay 
                            key={memo.id} 
                            memo={memo} 
                            onClick={() => {
                              setSelectedMemo(memo);
                              setIsMemoDetailOpen(true);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 sm:py-8 text-neutral-500">
                      <FileText className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-3 opacity-30" />
                      <p className="text-sm sm:text-base">No team assessments have been submitted for this deal yet.</p>
                      {deal && (
                        <MiniMemoForm
                          dealId={deal.id}
                          onSubmit={() => refetch()}
                          buttonLabel="Create Team Assessment"
                          buttonSize="sm"
                          buttonIcon={<FileText className="h-3.5 w-3.5 mr-1.5" />}
                          className="mt-3 inline-flex"
                        />
                      )}
                    </div>
                  )}
              </CardContent>
            </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="documents">
            <div className="mt-4">
              {deal && <DocumentsTab dealId={deal.id} />}
            </div>
          </TabsContent>
          
          <TabsContent value="calendar">
            <div className="mt-4">
              <Card>
                <CardHeader className="pb-2 sm:pb-4">
                  <CardTitle className="text-base sm:text-xl">Calendar</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    View and manage all scheduled events in one place
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  {deal?.id ? (
                    <UnifiedCalendarView 
                      dealId={Number(dealId)} 
                      onCreateCapitalCall={() => canCreate('capital-call') && deal?.allocations?.length && setIsCapitalCallFormOpen(true)}
                      onCreateMeeting={() => setIsMeetingFormOpen(true)}
                    />
                  ) : (
                    <div className="text-center py-8 text-neutral-500">
                      <div className="animate-spin h-8 w-8 border-2 border-primary border-opacity-50 border-t-primary rounded-full mx-auto mb-4"></div>
                      <p>Loading calendar events...</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="ai-analysis">
            <div className="mt-4">
              <Card className="h-[calc(100vh-230px)]">
                <CardContent className="h-full p-0">
                  {deal && (
                    <AIAnalysisTab 
                      dealId={deal.id} 
                      dealName={deal.name}
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="investments">
            <InvestmentTrackingTab dealId={Number(dealId)} />
          </TabsContent>

        </Tabs>
      </div>

      {/* Meeting form modal */}
      {isMeetingFormOpen && dealId && (
        <CreateMeetingForm
          dealId={Number(dealId)}
          isOpen={isMeetingFormOpen}
          onClose={() => setIsMeetingFormOpen(false)}
        />
      )}

    </AppLayout>
  );
}


