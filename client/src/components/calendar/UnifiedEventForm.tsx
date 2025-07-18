import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Loader2, AlertCircle } from 'lucide-react';
import { CLOSING_EVENT_TYPES, CLOSING_EVENT_TYPE_LABELS } from '@/lib/constants/closing-event-constants';
import { DATE_FORMATS } from '@/lib/constants/time-constants';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Deal, FundAllocation } from '@/lib/types';

// Define the different event types
enum EventType {
  CAPITAL_CALL = 'capital-call',
  CLOSING_EVENT = 'closing-event',
  MEETING = 'meeting'
}

// Define interfaces for event data coming from the API
interface CapitalCallData {
  id: number;
  dealId: number;
  allocationId: number;
  callAmount: number;
  amountType: 'percentage' | 'dollar';
  callDate: string;
  dueDate: string;
  status: string;
  notes?: string;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  dealName?: string;
}

interface ClosingScheduleData {
  id: number;
  dealId: number;
  eventType: string;
  eventName: string;
  scheduledDate: string;
  targetAmount?: number;
  amountType: 'percentage' | 'dollar';
  status: string;
  notes?: string;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  actualDate?: string | null;
  actualAmount?: number | null;
  dealName?: string;
}

interface MeetingData {
  id: number;
  dealId: number;
  title: string;
  date: string;
  attendees?: string;
  notes?: string;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  dealName?: string;
}

// Base form schema for common fields across all event types
const baseFormSchema = z.object({
  eventType: z.nativeEnum(EventType),
  dealId: z.coerce.number().min(1, 'Deal is required'),
  notes: z.string().optional(),
  createdBy: z.number().optional(),
});

// Form schema for capital calls
const capitalCallFormSchema = baseFormSchema.extend({
  eventType: z.literal(EventType.CAPITAL_CALL),
  percentage: z.coerce.number().min(0, 'Amount must be 0 or greater').optional(),
  callAmount: z.coerce.number().min(0, 'Amount must be 0 or greater').optional(),
  allocationId: z.coerce.number().min(1, 'Allocation is required').optional(),
  callDate: z.string().min(1, 'Call date is required').optional(),
  dueDate: z.string().min(1, 'Due date is required'),
  amountType: z.enum(['percentage', 'dollar']).default('percentage'),
  capitalCallStatus: z.string().optional(),
});

// Form schema for closing events
const closingEventFormSchema = baseFormSchema.extend({
  eventType: z.literal(EventType.CLOSING_EVENT),
  eventName: z.string().min(1, 'Event name is required').max(100, 'Event name is too long'),
  closingEventType: z.union([
    z.enum([
      CLOSING_EVENT_TYPES.FIRST_CLOSE,
      CLOSING_EVENT_TYPES.SECOND_CLOSE,
      CLOSING_EVENT_TYPES.FINAL_CLOSE,
      CLOSING_EVENT_TYPES.EXTENSION,
      CLOSING_EVENT_TYPES.CUSTOM
    ]),
    z.string()
  ]),
  scheduledDate: z.string().min(1, 'Scheduled date is required'),
  targetAmount: z.union([
    z.number().min(0, 'Target amount must be 0 or greater'),
    z.string().transform((val) => val === '' ? undefined : Number(val)),
    z.undefined()
  ]).optional(),
  amountType: z.enum(['percentage', 'dollar']).default('percentage'),
  closingStatus: z.string().optional(),
  actualDate: z.union([z.string(), z.null(), z.undefined()]),
  actualAmount: z.union([z.number(), z.null(), z.undefined()]),
});

// Form schema for meetings
const meetingFormSchema = baseFormSchema.extend({
  eventType: z.literal(EventType.MEETING),
  meetingTitle: z.string().min(1, 'Meeting title is required'),
  meetingDate: z.string().min(1, 'Meeting date is required'),
  attendees: z.string().optional(),
  title: z.string().optional(), // For edit mode compatibility
  date: z.string().optional(), // For edit mode compatibility
});

// Combined form schema
const formSchema = z.discriminatedUnion('eventType', [
  capitalCallFormSchema,
  closingEventFormSchema,
  meetingFormSchema,
]);

type FormValues = z.infer<typeof formSchema>;

interface UnifiedEventFormProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate?: Date;
  eventToEdit?: {
    type: 'capital-call' | 'closing-event' | 'meeting';
    id: number;
  } | null;
}

const UnifiedEventForm: React.FC<UnifiedEventFormProps> = ({ isOpen, onClose, selectedDate, eventToEdit }) => {
  const { toast } = useToast();
  const { data: user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDealId, setSelectedDealId] = useState<number | null>(null);
  const [selectedEventType, setSelectedEventType] = useState<EventType>(EventType.MEETING);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  
  // Fetch deals
  const { data: deals = [], isLoading: isLoadingDeals } = useQuery<Deal[]>({
    queryKey: ['/api/deals'],
  });
  
  // Fetch allocations for the selected deal if it's a capital call
  const { data: allocations = [], isLoading: isLoadingAllocations } = useQuery<FundAllocation[]>({
    queryKey: ['/api/allocations', { dealId: selectedDealId }],
    enabled: !!selectedDealId && selectedEventType === EventType.CAPITAL_CALL,
  });
  
  // Check if the selected deal has allocations (needed for capital calls)
  const dealHasAllocations = allocations.length > 0;
  
  // Fetch capital call details if editing
  const { data: capitalCallToEdit, isLoading: isLoadingCapitalCallEdit } = useQuery<CapitalCallData>({
    queryKey: ['/api/capital-calls', eventToEdit?.id],
    enabled: isEditMode && eventToEdit?.type === 'capital-call',
  });
  
  // Fetch closing event details if editing
  const { data: closingEventToEdit, isLoading: isLoadingClosingEventEdit } = useQuery<ClosingScheduleData>({
    queryKey: ['/api/closing-schedules', eventToEdit?.id],
    enabled: isEditMode && eventToEdit?.type === 'closing-event',
  });
  
  // Fetch meeting details if editing
  const { data: meetingToEdit, isLoading: isLoadingMeetingEdit } = useQuery<MeetingData>({
    queryKey: ['/api/meetings', eventToEdit?.id],
    enabled: isEditMode && eventToEdit?.type === 'meeting',
  });
  
  const isLoadingEditData = isLoadingCapitalCallEdit || isLoadingClosingEventEdit || isLoadingMeetingEdit;
  
  // Filter deals that are relevant based on the event type
  const eligibleDeals = deals.filter(deal => {
    if (selectedEventType === EventType.CAPITAL_CALL) {
      // Only deals that are in the closing or invested stage should be eligible for capital calls
      return deal.stage === 'closing' || deal.stage === 'invested' || deal.stage === 'closed';
    }
    // For closing events and meetings, any deal is eligible regardless of stage
    // A closing event represents when capital is called, not the stage of the deal
    return true;
  });

  // Set default values based on the selected event type
  const getDefaultValues = (): Partial<FormValues> => {
    const baseValues = {
      eventType: selectedEventType,
      dealId: undefined as unknown as number,
      notes: '',
      createdBy: user?.id,
    };

    const formattedDate = selectedDate ? format(selectedDate, DATE_FORMATS.ISO) : '';

    if (selectedEventType === EventType.CAPITAL_CALL) {
      return {
        ...baseValues,
        eventType: EventType.CAPITAL_CALL,
        percentage: undefined,
        amountType: 'percentage',
        dueDate: formattedDate,
      };
    }
    
    if (selectedEventType === EventType.CLOSING_EVENT) {
      return {
        ...baseValues,
        eventType: EventType.CLOSING_EVENT,
        eventName: '',
        closingEventType: CLOSING_EVENT_TYPES.CUSTOM,
        scheduledDate: formattedDate,
        targetAmount: undefined,
        amountType: 'percentage',
      };
    }
    
    return {
      ...baseValues,
      eventType: EventType.MEETING,
      meetingTitle: '',
      meetingDate: formattedDate,
      attendees: '',
    };
  };

  // Initialize form with default values
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: getDefaultValues() as FormValues,
  });
  
  // Reset form when event type changes (but not in edit mode)
  React.useEffect(() => {
    if (!isEditMode) {
      form.reset(getDefaultValues() as FormValues);
      setErrorMessage(null);
    }
  }, [selectedEventType, isEditMode]);
  
  // Handle edit mode and populate form with event data
  React.useEffect(() => {
    if (eventToEdit) {
      setIsEditMode(true);
      
      // Set the event type based on event being edited
      if (eventToEdit.type === 'capital-call') {
        setSelectedEventType(EventType.CAPITAL_CALL);
      } else if (eventToEdit.type === 'closing-event') {
        setSelectedEventType(EventType.CLOSING_EVENT);
      } else if (eventToEdit.type === 'meeting') {
        setSelectedEventType(EventType.MEETING);
      }
    } else {
      setIsEditMode(false);
    }
  }, [eventToEdit]);
  
  // Populate form with event data when in edit mode and data is loaded
  React.useEffect(() => {
    if (isEditMode && !isLoadingEditData) {
      if (eventToEdit?.type === 'capital-call' && capitalCallToEdit) {
        setSelectedDealId(capitalCallToEdit.dealId);
        form.reset({
          dealId: capitalCallToEdit.dealId,
          eventType: EventType.CAPITAL_CALL,
          allocationId: capitalCallToEdit.allocationId,
          callAmount: capitalCallToEdit.callAmount,
          amountType: capitalCallToEdit.amountType,
          callDate: capitalCallToEdit.callDate,
          dueDate: capitalCallToEdit.dueDate,
          capitalCallStatus: capitalCallToEdit.status,
          notes: capitalCallToEdit.notes || '',
        });
      } else if (eventToEdit?.type === 'closing-event' && closingEventToEdit) {
        setSelectedDealId(closingEventToEdit.dealId);
        form.reset({
          dealId: closingEventToEdit.dealId,
          eventType: EventType.CLOSING_EVENT,
          closingEventType: closingEventToEdit.eventType,
          eventName: closingEventToEdit.eventName,
          scheduledDate: closingEventToEdit.scheduledDate,
          targetAmount: closingEventToEdit.targetAmount || undefined,
          amountType: closingEventToEdit.amountType,
          closingStatus: closingEventToEdit.status,
          notes: closingEventToEdit.notes || '',
          actualDate: closingEventToEdit.actualDate || undefined,
          actualAmount: closingEventToEdit.actualAmount || undefined,
        });
      } else if (eventToEdit?.type === 'meeting' && meetingToEdit) {
        setSelectedDealId(meetingToEdit.dealId);
        form.reset({
          dealId: meetingToEdit.dealId,
          eventType: EventType.MEETING,
          meetingTitle: meetingToEdit.title,
          meetingDate: meetingToEdit.date,
          attendees: meetingToEdit.attendees || '',
          notes: meetingToEdit.notes || '',
        });
      }
    }
  }, [isEditMode, isLoadingEditData, eventToEdit, capitalCallToEdit, closingEventToEdit, meetingToEdit, form]);

  // Create or update event mutation
  const eventMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      let endpoint = '';
      let payload: any = { ...data };
      let method = isEditMode ? 'PATCH' : 'POST';
      
      console.log(`Preparing ${isEditMode ? 'edit' : 'create'} request for ${data.eventType}`);
      
      // Prepare the data based on event type
      if (data.eventType === EventType.CAPITAL_CALL) {
        endpoint = '/api/capital-calls';
        if (isEditMode && eventToEdit?.id) {
          endpoint = `${endpoint}/${eventToEdit.id}`;
        }
        // Transform capital call data
        const capitalCallPayload: any = {
          dealId: data.dealId,
          notes: data.notes,
          createdBy: data.createdBy || user?.id,
          amountType: data.amountType,
        };
        
        // Add optional fields based on what is provided
        if (data.allocationId) capitalCallPayload.allocationId = data.allocationId;
        if (data.callAmount) capitalCallPayload.callAmount = data.callAmount;
        if (data.percentage) capitalCallPayload.callAmount = data.percentage; // Use percentage as callAmount if provided
        if (data.callDate) capitalCallPayload.callDate = data.callDate;
        if (data.dueDate) capitalCallPayload.dueDate = data.dueDate;
        if (data.capitalCallStatus) capitalCallPayload.status = data.capitalCallStatus;
        
        payload = capitalCallPayload;
        console.log('Capital call payload:', payload);
      } else if (data.eventType === EventType.CLOSING_EVENT) {
        endpoint = '/api/closing-schedules';
        if (isEditMode && eventToEdit?.id) {
          endpoint = `${endpoint}/${eventToEdit.id}`;
        }
        // Transform closing event data
        const closingEventPayload: any = {
          dealId: data.dealId,
          eventName: data.eventName,
          eventType: typeof data.closingEventType === 'string' ? data.closingEventType : undefined,
          scheduledDate: data.scheduledDate,
          amountType: data.amountType,
          notes: data.notes,
          createdBy: data.createdBy || user?.id,
        };
        
        // Add optional fields
        if (data.targetAmount) closingEventPayload.targetAmount = data.targetAmount;
        if (data.closingStatus) closingEventPayload.status = data.closingStatus;
        if (data.actualDate) closingEventPayload.actualDate = data.actualDate;
        if (data.actualAmount) closingEventPayload.actualAmount = data.actualAmount;
        
        payload = closingEventPayload;
        console.log('Closing event payload:', payload);
      } else if (data.eventType === EventType.MEETING) {
        endpoint = '/api/meetings';
        if (isEditMode && eventToEdit?.id) {
          endpoint = `${endpoint}/${eventToEdit.id}`;
        }
        // Transform meeting data
        payload = {
          dealId: data.dealId,
          title: data.title || data.meetingTitle, // Support both property names
          date: data.date || data.meetingDate, // Support both property names
          attendees: data.attendees,
          notes: data.notes,
          createdBy: data.createdBy || user?.id,
        };
        console.log('Meeting payload:', payload);
      }
      
      console.log(`${method} request to ${endpoint}:`, payload);
      
      const response = await apiRequest(method, endpoint, payload);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || `Failed to ${isEditMode ? 'update' : 'create'} ${data.eventType}`);
      }
      
      return await response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate all event queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/capital-calls'] });
      queryClient.invalidateQueries({ queryKey: ['/api/closing-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
      
      toast({
        title: 'Success',
        description: `${getEventTypeLabel(variables.eventType)} ${isEditMode ? 'updated' : 'created'} successfully`,
        variant: 'default',
      });
      
      // Close the dialog
      onClose();
    },
    onError: (error: Error) => {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} event:`, error);
      setErrorMessage(error.message);
      toast({
        title: 'Error',
        description: error.message || `Failed to ${isEditMode ? 'update' : 'create'} event`,
        variant: 'destructive',
      });
    }
  });
  
  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: async () => {
      if (!eventToEdit?.id || !eventToEdit?.type) {
        throw new Error('No event selected for deletion');
      }
      
      let endpoint = '';
      let eventTypeName = '';
      
      // Determine the correct endpoint based on event type
      if (eventToEdit.type === 'capital-call') {
        endpoint = `/api/capital-calls/${eventToEdit.id}`;
        eventTypeName = 'capital call';
      } else if (eventToEdit.type === 'closing-event') {
        endpoint = `/api/closing-schedules/${eventToEdit.id}`;
        eventTypeName = 'closing event';
      } else if (eventToEdit.type === 'meeting') {
        endpoint = `/api/meetings/${eventToEdit.id}`;
        eventTypeName = 'meeting';
      }
      
      console.log(`Sending DELETE request to ${endpoint}`);
      
      try {
        const response = await apiRequest('DELETE', endpoint);
        
        // Handle common error responses with specific messages
        if (response.status === 401) {
          throw new Error('You need to be logged in to delete this event');
        }
        
        if (response.status === 403) {
          throw new Error('You do not have permission to delete this event');
        }
        
        if (response.status === 404) {
          throw new Error(`This ${eventTypeName} no longer exists or has already been deleted`);
        }
        
        if (!response.ok) {
          let errorMessage = `Failed to delete ${eventTypeName}`;
          try {
            const errorData = await response.json();
            if (errorData) {
              errorMessage = errorData.message || errorData.details || errorData.error || errorMessage;
            }
          } catch (e) {
            // If we can't parse the error JSON, use the default message
          }
          throw new Error(errorMessage);
        }
        
        // Try to parse the success response
        let result;
        try {
          result = await response.json();
        } catch (e) {
          // If we can't parse the response JSON, still consider it a success
          // because response.ok was true
          result = { success: true, id: eventToEdit.id };
        }
        
        return result;
      } catch (error) {
        console.error(`Error during DELETE request to ${endpoint}:`, error);
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate all event queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/capital-calls'] });
      queryClient.invalidateQueries({ queryKey: ['/api/closing-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
      
      toast({
        title: "Event deleted successfully",
        description: `The event has been permanently removed.`,
        variant: "default",
      });
      
      // Close the dialog
      onClose();
    },
    onError: (error: Error) => {
      console.error('Error deleting event:', error);
      toast({
        variant: 'destructive',
        title: "Failed to delete event",
        description: error.message || "An unknown error occurred",
      });
    },
  });
  
  const onSubmit = (data: FormValues) => {
    // Check if the selected deal has allocations for capital calls
    if (data.eventType === EventType.CAPITAL_CALL && selectedDealId && !dealHasAllocations) {
      setErrorMessage('This deal must be allocated to at least one fund before capital calls can be created');
      toast({
        title: 'Allocation Required',
        description: 'This deal must be allocated to at least one fund before capital calls can be created.',
        variant: 'destructive',
      });
      return;
    }
    
    // Submit the form data
    eventMutation.mutate(data);
  };
  
  // Helper function to get human-readable event type labels
  const getEventTypeLabel = (type: EventType): string => {
    switch (type) {
      case EventType.CAPITAL_CALL:
        return 'Capital Call';
      case EventType.CLOSING_EVENT:
        return 'Closing Event';
      case EventType.MEETING:
        return 'Meeting';
      default:
        return 'Event';
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit' : 'Create New'} Event</DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? 'Modify event details below.' 
              : 'Add an event to the calendar. Select the type of event you want to create.'}
          </DialogDescription>
        </DialogHeader>
        
        {/* Event Type Selector */}
        <div className="mb-4">
          <label className="text-sm font-medium">Event Type</label>
          <Select
            value={selectedEventType}
            onValueChange={(value) => setSelectedEventType(value as EventType)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select event type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EventType.MEETING}>Meeting</SelectItem>
              <SelectItem value={EventType.CAPITAL_CALL}>Capital Call</SelectItem>
              <SelectItem value={EventType.CLOSING_EVENT}>Closing Event</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Deal selector - common for all event types */}
            <FormField
              control={form.control}
              name="dealId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deal</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      const dealId = parseInt(value);
                      field.onChange(dealId);
                      setSelectedDealId(dealId);
                      setErrorMessage(null); // Clear any previous errors
                    }}
                    value={field.value?.toString() || ''}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select deal" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {isLoadingDeals ? (
                        <div className="p-2 flex justify-center">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : (
                        eligibleDeals.map((deal) => (
                          <SelectItem key={deal.id} value={deal.id.toString()}>
                            {deal.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                  
                  {/* Show allocation warning for capital calls */}
                  {selectedEventType === EventType.CAPITAL_CALL && selectedDealId && isLoadingAllocations && (
                    <div className="mt-1 text-xs text-neutral-500 flex items-center">
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      Checking deal allocations...
                    </div>
                  )}
                  
                  {selectedEventType === EventType.CAPITAL_CALL && selectedDealId && !isLoadingAllocations && !dealHasAllocations && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Allocation Required</AlertTitle>
                      <AlertDescription>
                        This deal must be allocated to at least one fund before capital calls can be created.
                        Please allocate this deal to a fund first.
                      </AlertDescription>
                    </Alert>
                  )}
                </FormItem>
              )}
            />
            
            {/* Fields specific to Capital Calls */}
            {selectedEventType === EventType.CAPITAL_CALL && (
              <>
                {/* Amount type selector */}
                <FormField
                  control={form.control}
                  name="amountType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select amount type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="percentage">Percentage (%)</SelectItem>
                          <SelectItem value="dollar">Dollar Amount ($)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Amount input */}
                <FormField
                  control={form.control}
                  name="percentage"
                  render={({ field }) => {
                    const amountType = form.watch('amountType');
                    return (
                    <FormItem>
                      <FormLabel>
                        {amountType === 'dollar' ? 'Amount ($)' : 'Percentage (%)'}
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            type="number" 
                            placeholder={amountType === 'dollar' ? 'Amount' : 'Percentage'} 
                            {...field} 
                            onChange={(e) => {
                              const value = e.target.value;
                              field.onChange(value === '' ? undefined : parseFloat(value));
                            }}
                            value={field.value === undefined ? '' : field.value}
                            className="pr-8"
                            min="0"
                            max={amountType === 'percentage' ? 100 : undefined}
                            step={amountType === 'dollar' ? 1000 : 1}
                          />
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-neutral-500">
                            {amountType === 'dollar' ? '$' : '%'}
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}}
                />
                
                {/* Due date input */}
                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
            
            {/* Fields specific to Closing Events */}
            {selectedEventType === EventType.CLOSING_EVENT && (
              <>
                {/* Event name input */}
                <FormField
                  control={form.control}
                  name="eventName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. First Closing Round" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Event type selector */}
                <FormField
                  control={form.control}
                  name="closingEventType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Closing Event Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select event type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(CLOSING_EVENT_TYPE_LABELS).map(([value, label]) => (
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
                
                {/* Scheduled date input */}
                <FormField
                  control={form.control}
                  name="scheduledDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Scheduled Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Amount type selector */}
                <FormField
                  control={form.control}
                  name="amountType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select amount type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="percentage">Percentage (%)</SelectItem>
                          <SelectItem value="dollar">Dollar Amount ($)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Target amount input */}
                <FormField
                  control={form.control}
                  name="targetAmount"
                  render={({ field }) => {
                    const amountType = form.watch('amountType');
                    return (
                    <FormItem>
                      <FormLabel>
                        {amountType === 'dollar' ? 'Target Amount ($)' : 'Target Percentage (%)'} (optional)
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            type="number" 
                            placeholder={amountType === 'dollar' ? 'Amount' : 'Percentage'} 
                            {...field} 
                            onChange={(e) => {
                              const value = e.target.value;
                              field.onChange(value === '' ? undefined : parseFloat(value));
                            }}
                            value={field.value === undefined ? '' : field.value}
                            className="pr-8"
                            min="0"
                            max={amountType === 'percentage' ? 100 : undefined}
                            step={amountType === 'dollar' ? 1000 : 1}
                          />
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-neutral-500">
                            {amountType === 'dollar' ? '$' : '%'}
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}}
                />
              </>
            )}
            
            {/* Fields specific to Meetings */}
            {selectedEventType === EventType.MEETING && (
              <>
                {/* Meeting title input */}
                <FormField
                  control={form.control}
                  name="meetingTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Meeting Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Investment Committee Review" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Meeting date input */}
                <FormField
                  control={form.control}
                  name="meetingDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Meeting Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Attendees input */}
                <FormField
                  control={form.control}
                  name="attendees"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Attendees (optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="List of attendees, one per line"
                          className="resize-none"
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
            
            {/* Notes textarea - common for all event types */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Add any additional information here"
                      className="resize-none"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Error message */}
            {errorMessage && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}
            
            <DialogFooter className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isEditMode && (
                  <Button 
                    type="button" 
                    variant="destructive" 
                    onClick={() => deleteEventMutation.mutate()}
                    disabled={eventMutation.isPending || deleteEventMutation.isPending}
                  >
                    {deleteEventMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Delete
                  </Button>
                )}
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={onClose}
                  disabled={eventMutation.isPending || deleteEventMutation.isPending}
                >
                  Cancel
                </Button>
              </div>
              <Button 
                type="submit" 
                disabled={
                  eventMutation.isPending || 
                  deleteEventMutation.isPending ||
                  (selectedEventType === EventType.CAPITAL_CALL && 
                   Boolean(selectedDealId && !isLoadingAllocations && !dealHasAllocations))
                }
              >
                {eventMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isEditMode ? 'Update' : 'Create'} {getEventTypeLabel(selectedEventType)}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default UnifiedEventForm;