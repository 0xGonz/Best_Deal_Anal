import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";
import { UserAvatar } from "@/components/common/UserAvatar";
import { 
  CheckCircle, 
  FileEdit,
  MessageSquare,
  Star,
  DollarSign,
  FileText,
  RocketIcon,
  Info,
  Trash2,
  Pencil,
  X,
  Check,
  Filter,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  AlertCircle
} from "lucide-react";
import { ICON_SIZES } from "@/lib/constants/ui-constants";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";

// Types for timeline events and filtering
type EventType = 'note' | 'stage_change' | 'document_upload' | 'memo_added' | 'star_added' | 'ai_analysis' | 'fund_allocation';

interface TimelineEvent {
  id: number;
  dealId: number;
  eventType: EventType;
  content: string | null;
  createdBy: number;
  createdAt: string;
  metadata: Record<string, any> | null;
  user?: {
    id: number;
    fullName: string;
    initials: string;
    avatarColor: string | null;
    role?: string;
  };
}

interface TimelineProps {
  dealId?: number;
}

interface FilterOptions {
  eventTypes: EventType[];
  dateRange: 'all' | 'today' | 'week' | 'month';
  userFilter: number | null;
}

export default function Timeline({ dealId }: TimelineProps) {
  // State for note input and editing
  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState<'note' | 'question' | 'decision' | 'concern'>('note');
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [eventToDelete, setEventToDelete] = useState<number | null>(null);
  
  // State for filtering and view options
  const [activeTab, setActiveTab] = useState<'all' | 'notes' | 'documents' | 'stages'>('all');
  const [expandedFilters, setExpandedFilters] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    eventTypes: ['note', 'stage_change', 'document_upload', 'memo_added', 'star_added', 'ai_analysis', 'fund_allocation'],
    dateRange: 'all',
    userFilter: null
  });
  
  const { toast } = useToast();
  const { data: user } = useAuth();

  // Fetch timeline events
  const { data: timelineData = [], isLoading } = useQuery<TimelineEvent[]>({
    queryKey: [`/api/deals/${dealId}/timeline`],
    enabled: !!dealId,
  });
  
  // Fetch users for filtering
  const { data: usersData = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  // Filter and process timeline data
  const filteredTimelineData = timelineData
    .filter(event => {
      // Filter by event type
      if (!filters.eventTypes.includes(event.eventType)) return false;
      
      // Filter by user if specified
      if (filters.userFilter && event.createdBy !== filters.userFilter) return false;
      
      // Filter by date range
      const eventDate = new Date(event.createdAt);
      const today = new Date();
      const todayStart = new Date(today.setHours(0, 0, 0, 0));
      
      if (filters.dateRange === 'today' && eventDate < todayStart) return false;
      
      if (filters.dateRange === 'week') {
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - 7);
        if (eventDate < weekStart) return false;
      }
      
      if (filters.dateRange === 'month') {
        const monthStart = new Date(today);
        monthStart.setMonth(monthStart.getMonth() - 1);
        if (eventDate < monthStart) return false;
      }
      
      // Apply tab filtering
      if (activeTab === 'notes' && event.eventType !== 'note') return false;
      if (activeTab === 'documents' && event.eventType !== 'document_upload') return false;
      if (activeTab === 'stages' && event.eventType !== 'stage_change') return false;
      
      return true;
    })
    // Sort by date descending (newest first)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  // Function to toggle event type filter
  const toggleEventTypeFilter = (eventType: EventType) => {
    setFilters(prev => {
      const currentFilters = [...prev.eventTypes];
      if (currentFilters.includes(eventType)) {
        return { ...prev, eventTypes: currentFilters.filter(type => type !== eventType) };
      } else {
        return { ...prev, eventTypes: [...currentFilters, eventType] };
      }
    });
  };

  // Function to set date range filter
  const setDateRangeFilter = (range: FilterOptions['dateRange']) => {
    setFilters(prev => ({ ...prev, dateRange: range }));
  };

  // Function to set user filter
  const setUserFilter = (userId: number | null) => {
    setFilters(prev => ({ ...prev, userFilter: userId }));
  };

  const addNoteMutation = useMutation({
    mutationFn: async (data: { content: string, noteType: string }) => {
      return apiRequest("POST", `/api/deals/${dealId}/timeline`, {
        eventType: "note",
        content: data.content,
        metadata: { noteType: data.noteType }
      });
    },
    onSuccess: async () => {
      setNewNote("");
      toast({
        title: "Note added",
        description: "Your note has been added to the timeline.",
        variant: "success"
      });
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

  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number | null>(null);
  const [answerText, setAnswerText] = useState("");
  
  const updateNoteMutation = useMutation({
    mutationFn: async ({ 
      eventId, 
      content, 
      metadata 
    }: { 
      eventId: number, 
      content: string, 
      metadata?: Record<string, any> 
    }) => {
      return apiRequest("PUT", `/api/deals/${dealId}/timeline/${eventId}`, {
        content,
        metadata
      });
    },
    onSuccess: async () => {
      setEditingEventId(null);
      setEditContent("");
      setSelectedQuestionIndex(null);
      setAnswerText("");
      toast({
        title: "Note updated",
        description: "Your note has been updated successfully.",
        variant: "success"
      });
      await queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/timeline`] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update note. Please try again.",
        variant: "destructive"
      });
    }
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (eventId: number) => {
      return apiRequest("DELETE", `/api/deals/${dealId}/timeline/${eventId}`);
    },
    onSuccess: async () => {
      setEventToDelete(null);
      toast({
        title: "Note deleted",
        description: "Your note has been removed from the timeline.",
        variant: "success"
      });
      await queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/timeline`] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete note. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    addNoteMutation.mutate({
      content: newNote,
      noteType: noteType
    });
  };

  const handleEditNote = (event: TimelineEvent) => {
    setEditingEventId(event.id);
    setEditContent(event.content || '');
  };

  const handleCancelEdit = () => {
    setEditingEventId(null);
    setEditContent("");
    setSelectedQuestionIndex(null);
    setAnswerText("");
  };

  const handleSaveEdit = () => {
    if (!editContent.trim() || !editingEventId) return;
    
    // Get the current event being edited
    const event = timelineData.find(e => e.id === editingEventId);
    if (!event) return;
    
    // If we're editing a regular note
    if (selectedQuestionIndex === null) {
      updateNoteMutation.mutate({ 
        eventId: editingEventId, 
        content: editContent,
        metadata: event.metadata || undefined
      });
    } 
    // If we're answering a specific question
    else {
      // Create a copy of the existing metadata, or initialize empty object
      const metadata = { ...(event.metadata || {}) };
      
      // Initialize answers object if it doesn't exist
      metadata.answers = metadata.answers || {};
      
      // Update the specific answer
      metadata.answers[selectedQuestionIndex] = answerText;
      
      // Update the note with the new metadata
      updateNoteMutation.mutate({ 
        eventId: editingEventId, 
        content: event.content || '',
        metadata 
      });
    }
  };
  
  const handleAddAnswer = (event: TimelineEvent, questionIndex: number) => {
    setEditingEventId(event.id);
    setSelectedQuestionIndex(questionIndex);
    setAnswerText('');
  };

  const handleDeleteNote = (eventId: number) => {
    setEventToDelete(eventId);
  };

  const confirmDeleteNote = () => {
    if (eventToDelete) {
      deleteNoteMutation.mutate(eventToDelete);
    }
  };
  
  // Check if the current user can edit/delete a note
  const canModifyNote = (event: TimelineEvent) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return event.createdBy === user.id;
  };

  // Helper to get the appropriate icon for each event type
  const getEventIcon = (eventType: string) => {
    const containerClass = `absolute left-0 top-0 ${ICON_SIZES.TIMELINE.CONTAINER.DEFAULT} rounded-full flex items-center justify-center z-10`;
    const iconClass = `${ICON_SIZES.TIMELINE.ICON.DEFAULT} text-white`;
    
    switch (eventType) {
      case 'stage_change':
        return (
          <div className={`${containerClass} bg-primary-light`}>
            <CheckCircle className={iconClass} />
          </div>
        );
      case 'memo_added':
        return (
          <div className={`${containerClass} bg-accent`}>
            <FileEdit className={iconClass} />
          </div>
        );
      case 'note':
        return (
          <div className={`${containerClass} bg-secondary`}>
            <MessageSquare className={iconClass} />
          </div>
        );
      case 'star_added':
        return (
          <div className={`${containerClass} bg-accent`}>
            <Star className={iconClass} />
          </div>
        );
      case 'document_upload':
        return (
          <div className={`${containerClass} bg-secondary`}>
            <FileText className={iconClass} />
          </div>
        );
      case 'fund_allocation':
        return (
          <div className={`${containerClass} bg-success`}>
            <DollarSign className={iconClass} />
          </div>
        );
      case 'ai_analysis':
        return (
          <div className={`${containerClass} bg-info`}>
            <RocketIcon className={iconClass} />
          </div>
        );
      default:
        return (
          <div className={`${containerClass} bg-info`}>
            <Info className={iconClass} />
          </div>
        );
    }
  };

  return (
    <div>
      {/* Add quick note field */}
      <div className="mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="mb-3">
              <h3 className="text-sm font-medium mb-2">Add a new note</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge 
                  variant={noteType === 'note' ? 'default' : 'outline'}
                  className={`cursor-pointer ${noteType === 'note' ? '' : 'hover:bg-secondary/50'}`}
                  onClick={() => setNoteType('note')}
                >
                  <MessageSquare className="mr-1 h-3 w-3" /> Note
                </Badge>
                <Badge 
                  variant={noteType === 'question' ? 'default' : 'outline'}
                  className={`cursor-pointer ${noteType === 'question' ? 'bg-amber-500 hover:bg-amber-600' : 'hover:bg-amber-200'}`}
                  onClick={() => setNoteType('question')}
                >
                  <Info className="mr-1 h-3 w-3" /> Question
                </Badge>
                <Badge 
                  variant={noteType === 'decision' ? 'default' : 'outline'}
                  className={`cursor-pointer ${noteType === 'decision' ? 'bg-green-500 hover:bg-green-600' : 'hover:bg-green-200'}`}
                  onClick={() => setNoteType('decision')}
                >
                  <CheckCircle className="mr-1 h-3 w-3" /> Decision
                </Badge>
                <Badge 
                  variant={noteType === 'concern' ? 'default' : 'outline'}
                  className={`cursor-pointer ${noteType === 'concern' ? 'bg-red-500 hover:bg-red-600' : 'hover:bg-red-200'}`}
                  onClick={() => setNoteType('concern')}
                >
                  <AlertCircle className="mr-1 h-3 w-3" /> Concern
                </Badge>
              </div>
            </div>
            <div className="flex space-x-2">
              <Textarea 
                placeholder={`Add a ${noteType === 'question' ? 'question' : noteType === 'decision' ? 'decision' : noteType === 'concern' ? 'concern' : 'note'}...`} 
                className="resize-none"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
              />
              <Button 
                className="shrink-0"
                onClick={handleAddNote}
                disabled={addNoteMutation.isPending || !newNote.trim()}
              >
                {addNoteMutation.isPending ? "Adding..." : "Add"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timeline events */}
      {/* Filter and tab navigation */}
      <div className="mb-4">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
            <TabsTrigger value="notes" className="flex-1">Notes</TabsTrigger>
            <TabsTrigger value="documents" className="flex-1">Documents</TabsTrigger>
            <TabsTrigger value="stages" className="flex-1">Stage Changes</TabsTrigger>
          </TabsList>
        </Tabs>
        
        <div className="mt-3 flex justify-between items-center">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setExpandedFilters(!expandedFilters)}
            className="text-xs"
          >
            <Filter size={14} className="mr-1" />
            {expandedFilters ? 'Hide filters' : 'Show filters'}
            {expandedFilters ? <ChevronUp size={14} className="ml-1" /> : <ChevronDown size={14} className="ml-1" />}
          </Button>
          
          <Select value={filters.dateRange} onValueChange={(value) => setDateRangeFilter(value as any)}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 days</SelectItem>
              <SelectItem value="month">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {expandedFilters && (
          <Card className="mt-3">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Event Types</h4>
                  <div className="flex flex-wrap gap-2">
                    {([
                      { id: 'note', label: 'Notes', color: 'bg-secondary' },
                      { id: 'stage_change', label: 'Stage Changes', color: 'bg-primary-light' },
                      { id: 'document_upload', label: 'Documents', color: 'bg-secondary' },
                      { id: 'memo_added', label: 'Memos', color: 'bg-accent' },
                      { id: 'star_added', label: 'Stars', color: 'bg-accent' },
                      { id: 'fund_allocation', label: 'Fund Allocations', color: 'bg-success' },
                      { id: 'ai_analysis', label: 'AI Analysis', color: 'bg-info' }
                    ] as const).map(type => (
                      <div key={type.id} className="flex items-center">
                        <Checkbox 
                          id={`filter-${type.id}`} 
                          checked={filters.eventTypes.includes(type.id)} 
                          onCheckedChange={() => toggleEventTypeFilter(type.id)}
                          className="mr-1"
                        />
                        <label 
                          htmlFor={`filter-${type.id}`}
                          className="text-xs cursor-pointer flex items-center"
                        >
                          <span className={`inline-block w-2 h-2 rounded-full ${type.color} mr-1`}></span>
                          {type.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium mb-2">Users</h4>
                  <Select 
                    value={filters.userFilter?.toString() || "all"} 
                    onValueChange={(value) => setUserFilter(value === "all" ? null : parseInt(value))}
                  >
                    <SelectTrigger className="w-full h-8 text-xs">
                      <SelectValue placeholder="Filter by user" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All users</SelectItem>
                      {usersData.map((user: any) => (
                        <SelectItem key={user.id} value={user.id.toString()}>{user.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Timeline events */}
      <div className="space-y-0 max-h-[500px] overflow-y-auto scrollbar-thin pr-2">
        {isLoading ? (
          <div className="flex justify-center items-center py-10">
            <p className="text-neutral-500">Loading timeline...</p>
          </div>
        ) : filteredTimelineData.length === 0 ? (
          <div className="flex justify-center items-center py-10">
            <p className="text-neutral-500">No timeline events match your filters.</p>
          </div>
        ) : (
          filteredTimelineData.map((event: TimelineEvent) => (
            <div key={event.id} className="timeline-dot relative pl-8 pb-6">
              {getEventIcon(event.eventType)}
              <div>
                <div className="flex justify-between">
                  <span className="text-xs text-neutral-500">
                    {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                  </span>
                  {event.eventType === 'note' && canModifyNote(event) && (
                    <div className="flex space-x-1">
                      {/* Edit button */}
                      <button 
                        onClick={() => handleEditNote(event)}
                        className="text-neutral-400 hover:text-primary-dark transition-colors">
                        <Pencil size={14} />
                      </button>
                      
                      {/* Delete button */}
                      <AlertDialog open={eventToDelete === event.id} onOpenChange={(open) => !open && setEventToDelete(null)}>
                        <AlertDialogTrigger asChild>
                          <button 
                            onClick={() => handleDeleteNote(event.id)}
                            className="text-neutral-400 hover:text-red-500 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete note</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this note? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={confirmDeleteNote}
                              className="bg-red-500 hover:bg-red-600 text-white"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
                
                {/* Display note with appropriate styling based on type */}
                {event.eventType === 'note' && event.metadata?.noteType && (
                  <div className="mt-1 mb-2">
                    <Badge
                      variant="outline"
                      className={`
                        ${event.metadata.noteType === 'question' ? 'text-amber-600 border-amber-300 bg-amber-50' : ''}
                        ${event.metadata.noteType === 'decision' ? 'text-green-600 border-green-300 bg-green-50' : ''}
                        ${event.metadata.noteType === 'concern' ? 'text-red-600 border-red-300 bg-red-50' : ''}
                      `}
                    >
                      {event.metadata.noteType === 'question' ? (
                        <>
                          <Info className="mr-1 h-3 w-3" /> 
                          Question
                        </>
                      ) : event.metadata.noteType === 'decision' ? (
                        <>
                          <CheckCircle className="mr-1 h-3 w-3" /> 
                          Decision
                        </>
                      ) : event.metadata.noteType === 'concern' ? (
                        <>
                          <AlertCircle className="mr-1 h-3 w-3" /> 
                          Concern
                        </>
                      ) : (
                        <>
                          <MessageSquare className="mr-1 h-3 w-3" /> 
                          Note
                        </>
                      )}
                    </Badge>
                  </div>
                )}
                
                {editingEventId === event.id ? (
                  <div className="mt-1">
                    {selectedQuestionIndex !== null ? (
                      <div className="bg-amber-50 p-3 rounded-md">
                        <div className="text-sm font-medium text-amber-800 mb-2">
                          Adding answer to question #{selectedQuestionIndex + 1}
                        </div>
                        <Textarea 
                          value={answerText}
                          onChange={(e) => setAnswerText(e.target.value)}
                          className="resize-none text-sm min-h-[60px] mb-2"
                          placeholder="Type your answer here..."
                        />
                        <div className="flex justify-end space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleCancelEdit}
                            className="h-7 px-2 text-xs"
                          >
                            <X size={12} className="mr-1" /> Cancel
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={handleSaveEdit}
                            disabled={updateNoteMutation.isPending || !answerText.trim()}
                            className="h-7 px-2 text-xs"
                          >
                            <Check size={12} className="mr-1" /> Save Answer
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="resize-none text-sm min-h-[60px] mb-2"
                        />
                        <div className="flex justify-end space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleCancelEdit}
                            className="h-7 px-2 text-xs"
                          >
                            <X size={12} className="mr-1" /> Cancel
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={handleSaveEdit}
                            disabled={updateNoteMutation.isPending || !editContent.trim()}
                            className="h-7 px-2 text-xs"
                          >
                            <Check size={12} className="mr-1" /> Save
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className={`text-sm text-neutral-800 mt-1 p-2 rounded-md whitespace-pre-line ${
                    event.eventType === 'note' && event.metadata?.noteType === 'question' ? 'bg-amber-50' :
                    event.eventType === 'note' && event.metadata?.noteType === 'decision' ? 'bg-green-50' :
                    event.eventType === 'note' && event.metadata?.noteType === 'concern' ? 'bg-red-50' :
                    'bg-gray-50'
                  }`}>
                    {event.eventType === 'note' && event.metadata?.noteType === 'question' && event.content
                      ? event.content.split(/\n|(?:\d+[\.\)]?\s*)/g)
                          .map((line, index) => line.trim())
                          .filter(line => line.length > 0)
                          .map((line, index) => (
                            <div key={index} className="mb-2 last:mb-0">
                              <div className="flex items-start gap-2">
                                <div className="flex-shrink-0 bg-amber-200 text-amber-800 w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium">
                                  {index + 1}
                                </div>
                                <div className="flex-grow">
                                  <p>{line}</p>
                                  {event.metadata?.answers && event.metadata.answers[index] ? (
                                    <div className="mt-1 ml-2 pl-2 border-l-2 border-amber-200 text-neutral-600">
                                      {event.metadata.answers[index]}
                                    </div>
                                  ) : canModifyNote(event) && (
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="mt-1 text-xs text-amber-600 hover:text-amber-800 hover:bg-amber-50 h-auto py-1"
                                      onClick={() => handleAddAnswer(event, index)}
                                    >
                                      + Add Answer
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                      : (event.content || '')
                    }
                  </div>
                )}
                
                {event.user && (
                  <div className="flex items-center mt-2">
                    <UserAvatar 
                      user={event.user}
                      size="sm"
                      className="mr-2"
                    />
                    <span className="text-xs text-neutral-500">{event.user.fullName}</span>
                    <span className="text-xs text-neutral-400 ml-auto">
                      {format(new Date(event.createdAt), 'MMM d, yyyy')}
                    </span>
                  </div>
                )}                
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
