import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Loader2, AlertCircle } from 'lucide-react';

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
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { DATE_FORMATS } from '@/lib/constants/time-constants';
import { Deal, FundAllocation } from '@/lib/types';

// Define form schema
const capitalCallFormSchema = z.object({
  dealId: z.coerce.number().min(1, 'Deal is required'),
  percentage: z.coerce.number().min(0, 'Amount must be 0 or greater'),
  amountType: z.enum(['percentage', 'dollar']).default('percentage'),
  dueDate: z.string().min(1, 'Due date is required'),
  notes: z.string().optional(),
  createdBy: z.number().optional(),
});

type CapitalCallFormValues = z.infer<typeof capitalCallFormSchema>;

interface CapitalCallFormProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate?: Date;
}

const CapitalCallForm: React.FC<CapitalCallFormProps> = ({ isOpen, onClose, selectedDate }) => {
  const { toast } = useToast();
  const { data: user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDealId, setSelectedDealId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Fetch deals
  const { data: deals = [], isLoading: isLoadingDeals } = useQuery<Deal[]>({
    queryKey: ['/api/deals'],
  });
  
  // Fetch allocations for the selected deal
  const { data: allocations = [], isLoading: isLoadingAllocations } = useQuery<FundAllocation[]>({
    queryKey: ['/api/allocations/deal', selectedDealId],
    enabled: !!selectedDealId,
  });
  
  // Check if the selected deal has allocations
  const dealHasAllocations = allocations.length > 0;
  
  const form = useForm<CapitalCallFormValues>({
    resolver: zodResolver(capitalCallFormSchema),
    defaultValues: {
      // Ensure we only use the date part without time
      dueDate: selectedDate ? format(selectedDate, DATE_FORMATS.ISO).split('T')[0] : '',
      percentage: undefined,
      amountType: 'percentage',
      dealId: undefined as unknown as number,
      notes: '',
      createdBy: user?.id
    } as unknown as CapitalCallFormValues
  });
  
  const createCapitalCall = useMutation({
    mutationFn: async (data: CapitalCallFormValues) => {
      const response = await apiRequest('POST', '/api/capital-calls', data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to create capital call');
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate the capital calls query to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/production/capital-calls'] });
      
      toast({
        title: 'Success',
        description: 'Capital call created successfully',
        variant: 'default',
      });
      
      // Close the dialog
      onClose();
    },
    onError: (error: Error) => {

      setErrorMessage(error.message);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create capital call',
        variant: 'destructive',
      });
    }
  });
  
  const onSubmit = (data: CapitalCallFormValues) => {
    // Check if the selected deal has allocations
    if (selectedDealId && !dealHasAllocations) {
      setErrorMessage('This deal must be allocated to at least one fund before capital calls can be created');
      toast({
        title: 'Allocation Required',
        description: 'This deal must be allocated to at least one fund before capital calls can be created.',
        variant: 'destructive',
      });
      return;
    }
    
    // Make sure the user ID is included and ensure date has no time portion
    const formData = {
      ...data,
      // Ensure the dueDate has no time component
      dueDate: data.dueDate ? data.dueDate.split('T')[0] : data.dueDate,
      createdBy: data.createdBy || user?.id
    };
    
    // Submit the form data
    createCapitalCall.mutate(formData);
  };
  
  // Filter deals that are relevant for capital calls (e.g., in closing or invested stage)
  const eligibleDeals = deals.filter(deal => {
    // Only deals that are in the closing or invested stage should be eligible for capital calls
    return deal.stage === 'closing' || deal.stage === 'invested' || deal.stage === 'closed';
  });
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Create Capital Call</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Deal selector */}
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
                    defaultValue={field.value?.toString()}
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
                  
                  {selectedDealId && isLoadingAllocations && (
                    <div className="mt-1 text-xs text-neutral-500 flex items-center">
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      Checking deal allocations...
                    </div>
                  )}
                  
                  {selectedDealId && !isLoadingAllocations && !dealHasAllocations && (
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
                disabled={createCapitalCall.isPending}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createCapitalCall.isPending || Boolean(selectedDealId && !isLoadingAllocations && !dealHasAllocations)}
              >
                {createCapitalCall.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Capital Call
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default CapitalCallForm;