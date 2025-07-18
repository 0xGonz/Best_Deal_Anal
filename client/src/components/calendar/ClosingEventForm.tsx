import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { insertClosingScheduleEventSchema } from '@shared/schema';
import { CLOSING_EVENT_TYPES, CLOSING_EVENT_TYPE_LABELS } from '@/lib/constants/closing-event-constants';
import { format } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { DATE_FORMATS } from '@/lib/constants/time-constants';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';

// Define a custom schema for the form, extending the database schema with validation
const closingEventFormSchema = z.object({
  scheduledDate: z.string().min(1, 'Scheduled date is required'),
  dealId: z.number().min(1, 'Deal is required'),
  eventName: z.string().min(1, 'Event name is required').max(100, 'Event name is too long'),
  eventType: z.enum([
    CLOSING_EVENT_TYPES.FIRST_CLOSE,
    CLOSING_EVENT_TYPES.SECOND_CLOSE,
    CLOSING_EVENT_TYPES.FINAL_CLOSE,
    CLOSING_EVENT_TYPES.EXTENSION,
    CLOSING_EVENT_TYPES.CUSTOM
  ]),
  targetAmount: z.union([
    z.number().min(0, 'Target amount must be 0 or greater'),
    z.string().transform((val) => val === '' ? undefined : Number(val)),
    z.undefined()
  ]).optional(),
  amountType: z.enum(['percentage', 'dollar']).default('percentage'),
  notes: z.union([z.string(), z.null()]).optional(),
  createdBy: z.number().optional()
});

type ClosingEventFormValues = z.infer<typeof closingEventFormSchema>;

interface ClosingEventFormProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate?: Date;
}

interface Deal {
  id: number;
  name: string;
  stage: string;
}

const ClosingEventForm: React.FC<ClosingEventFormProps> = ({ isOpen, onClose, selectedDate }) => {
  const { toast } = useToast();
  const { data: user } = useAuth();
  const queryClient = useQueryClient();
  
  // Fetch deals that are in the pipeline
  const { data: deals = [], isLoading: isLoadingDeals } = useQuery<Deal[]>({
    queryKey: ['/api/deals'],
  });
  
  // All deals are eligible for closing events regardless of stage
  // A closing event represents when the capital is called, not the stage of the deal
  const eligibleDeals = deals;
  
  const form = useForm<ClosingEventFormValues>({
    resolver: zodResolver(closingEventFormSchema),
    defaultValues: {
      // Ensure we only use the date part without time
      scheduledDate: selectedDate ? format(selectedDate, DATE_FORMATS.ISO).split('T')[0] : '',
      eventName: '',
      eventType: CLOSING_EVENT_TYPES.CUSTOM,
      dealId: undefined as unknown as number,
      targetAmount: undefined,
      amountType: 'percentage', // Default to percentage
      notes: '',
      createdBy: user?.id
    } as unknown as ClosingEventFormValues
  });
  
  const createClosingEvent = useMutation({
    mutationFn: async (data: ClosingEventFormValues) => {
      const response = await apiRequest('POST', '/api/closing-schedules', data);
      return response.json();
    },
    onSuccess: () => {
      // Invalidate the closing events query to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/closing-schedules'] });
      
      toast({
        title: 'Success',
        description: 'Closing event created successfully',
        variant: 'default',
      });
      
      // Close the dialog
      onClose();
    },
    onError: (error) => {
      console.error('Error creating closing event:', error);
      toast({
        title: 'Error',
        description: 'Failed to create closing event',
        variant: 'destructive',
      });
    }
  });
  
  const onSubmit = (data: ClosingEventFormValues) => {
    // Make sure the user ID is included and ensure date has no time portion
    const formData = {
      ...data,
      // Ensure the scheduledDate has no time component
      scheduledDate: data.scheduledDate ? data.scheduledDate.split('T')[0] : data.scheduledDate,
      createdBy: data.createdBy || user?.id
    };
    
    // Submit the form data
    createClosingEvent.mutate(formData);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Create Closing Schedule Event</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Deal selector - Searchable */}
            <FormField
              control={form.control}
              name="dealId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deal</FormLabel>
                  {/* Using Combobox for searchable dropdown */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between"
                          disabled={isLoadingDeals || createClosingEvent.isPending}
                        >
                          {field.value
                            ? eligibleDeals.find(
                                (deal) => deal.id === field.value
                              )?.name || "Select deal"
                            : "Select deal"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0">
                      <Command>
                        <CommandInput placeholder="Search deals..." />
                        <CommandEmpty>No deal found.</CommandEmpty>
                        <CommandGroup>
                          <ScrollArea className="h-72">
                            {isLoadingDeals ? (
                              <div className="p-2 flex justify-center">
                                <Loader2 className="h-4 w-4 animate-spin" />
                              </div>
                            ) : (
                              eligibleDeals.map((deal) => (
                                <CommandItem
                                  key={deal.id}
                                  value={deal.name}
                                  onSelect={() => {
                                    field.onChange(deal.id);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      deal.id === field.value
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  {deal.name}
                                </CommandItem>
                              ))
                            )}
                          </ScrollArea>
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            
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
              name="eventType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
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
                    <Input 
                      type="date" 
                      {...field} 
                      // Ensure we only use the date part without time
                      onChange={(e) => {
                        // Split any potential datetime string and only use the date part
                        const dateValue = e.target.value.split('T')[0];
                        field.onChange(dateValue);
                      }}
                    />
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
                    defaultValue={field.value}
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
                        value={field.value ?? ''}
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
            
            {/* Notes textarea */}
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
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                disabled={createClosingEvent.isPending}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createClosingEvent.isPending}
              >
                {createClosingEvent.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Event
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ClosingEventForm;
