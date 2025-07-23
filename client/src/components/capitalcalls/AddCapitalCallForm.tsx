import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, DollarSign, AlertCircle, CreditCard, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/services/formatters';
import { format } from 'date-fns';

interface AddCapitalCallFormProps {
  isOpen: boolean;
  onClose: () => void;
  allocationId: number;
  allocationDetails?: {
    dealName: string;
    fundName: string;
    totalCommitted: number;
    totalCalled: number;
    uncalledAmount: number;
    status: string;
  };
}

// Validation schema
const capitalCallSchema = z.object({
  callAmount: z.number().positive('Call amount must be greater than 0'),
  amountType: z.enum(['dollar', 'percentage'], { required_error: 'Please select amount type' }),
  callDate: z.string().min(1, 'Call date is required'),
  dueDate: z.string().optional(),
  status: z.enum(['scheduled', 'called', 'partially_paid', 'paid'], { required_error: 'Please select status' }),
  notes: z.string().optional(),
});

type CapitalCallFormData = z.infer<typeof capitalCallSchema>;

export function AddCapitalCallForm({
  isOpen,
  onClose,
  allocationId,
  allocationDetails,
}: AddCapitalCallFormProps) {
  const { toast } = useToast();
  
  // Form state
  const [formData, setFormData] = useState<CapitalCallFormData>({
    callAmount: 0,
    amountType: 'percentage',
    callDate: format(new Date(), 'yyyy-MM-dd'),
    dueDate: undefined,
    status: 'called',
    notes: '',
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Fetch existing capital calls for this allocation to show context
  const { data: existingCalls = [], isLoading: isLoadingCalls } = useQuery<any[]>({
    queryKey: [`/api/capital-calls/allocation/${allocationId}`],
    enabled: isOpen && !!allocationId,
  });

  // Create capital call mutation
  const createCapitalCallMutation = useMutation({
    mutationFn: async (data: CapitalCallFormData) => {
      return apiRequest('POST', '/api/capital-calls', {
        allocationId,
        callAmount: data.callAmount,
        amountType: data.amountType,
        callDate: data.callDate,
        dueDate: data.dueDate,
        status: data.status,
        notes: data.notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/capital-calls/allocation/${allocationId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/production/allocations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/funds'] });
      
      toast({
        title: 'Capital call created',
        description: 'The new capital call has been successfully added to the allocation.',
      });
      
      // Reset form and close
      setFormData({
        callAmount: 0,
        amountType: 'percentage',
        callDate: format(new Date(), 'yyyy-MM-dd'),
        dueDate: undefined,
        status: 'called',
        notes: '',
      });
      setValidationErrors({});
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Error creating capital call',
        description: error.message || 'An unexpected error occurred',
        variant: 'destructive',
      });
    },
  });

  // Calculate amounts for display
  const calculateDollarAmount = () => {
    if (!allocationDetails) return 0;
    
    if (formData.amountType === 'dollar') {
      return formData.callAmount;
    } else {
      return (formData.callAmount / 100) * allocationDetails.totalCommitted;
    }
  };

  const calculatePercentageAmount = () => {
    if (!allocationDetails) return 0;
    
    if (formData.amountType === 'percentage') {
      return formData.callAmount;
    } else {
      return (formData.callAmount / allocationDetails.totalCommitted) * 100;
    }
  };

  // Validate form
  const validateForm = () => {
    try {
      capitalCallSchema.parse(formData);
      
      // Additional business logic validation
      const errors: Record<string, string> = {};
      
      if (allocationDetails) {
        const dollarAmount = calculateDollarAmount();
        
        // Check if the call amount would exceed uncalled capital
        if (dollarAmount > allocationDetails.uncalledAmount) {
          errors.callAmount = `Call amount (${formatCurrency(dollarAmount)}) exceeds uncalled capital (${formatCurrency(allocationDetails.uncalledAmount)})`;
        }
        
        // Check if due date is after call date (only if due date is provided)
        if (formData.dueDate && new Date(formData.dueDate) <= new Date(formData.callDate)) {
          errors.dueDate = 'Due date must be after call date';
        }
      }
      
      setValidationErrors(errors);
      return Object.keys(errors).length === 0;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            errors[err.path[0] as string] = err.message;
          }
        });
        setValidationErrors(errors);
      }
      return false;
    }
  };

  // Handle form submission
  const handleSubmit = () => {
    if (validateForm()) {
      createCapitalCallMutation.mutate(formData);
    }
  };

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setValidationErrors({});
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-blue-600" />
            Add Capital Call
          </DialogTitle>
          <DialogDescription>
            Create an additional capital call for this allocation. This will be stacked with any existing capital calls.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Allocation Summary */}
          {allocationDetails && (
            <Alert>
              <TrendingUp className="h-4 w-4" />
              <AlertTitle>Allocation Overview</AlertTitle>
              <AlertDescription>
                <div className="mt-2 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{allocationDetails.dealName}</span>
                    <Badge variant="outline">{allocationDetails.status}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Total Committed:</span>
                      <div className="font-medium">{formatCurrency(allocationDetails.totalCommitted)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Already Called:</span>
                      <div className="font-medium text-green-600">{formatCurrency(allocationDetails.totalCalled)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Available to Call:</span>
                      <div className="font-medium text-blue-600">{formatCurrency(allocationDetails.uncalledAmount)}</div>
                    </div>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Existing Capital Calls Summary */}
          {existingCalls.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Existing Capital Calls ({existingCalls.length})</AlertTitle>
              <AlertDescription>
                <div className="mt-2 space-y-1">
                  {existingCalls.slice(0, 3).map((call: any, index: number) => (
                    <div key={call.id} className="flex justify-between text-sm">
                      <span>Call #{index + 1} - {format(new Date(call.callDate), 'MMM dd, yyyy')}</span>
                      <span className="font-medium">{formatCurrency(call.callAmount)}</span>
                    </div>
                  ))}
                  {existingCalls.length > 3 && (
                    <div className="text-sm text-muted-foreground">...and {existingCalls.length - 3} more</div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Form Fields */}
          <div className="grid grid-cols-1 gap-4">
            {/* Amount Type and Amount */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amountType">Amount Type</Label>
                <Select
                  value={formData.amountType}
                  onValueChange={(value: 'dollar' | 'percentage') => 
                    setFormData({ ...formData, amountType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="dollar">Dollar Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="callAmount">
                  Call Amount {formData.amountType === 'percentage' ? '(%)' : '($)'}
                </Label>
                <div className="relative">
                  {formData.amountType === 'dollar' && (
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  )}
                  <Input
                    id="callAmount"
                    type="number"
                    min="0"
                    step={formData.amountType === 'dollar' ? '1000' : '0.1'}
                    className={formData.amountType === 'dollar' ? 'pl-10' : ''}
                    value={formData.callAmount || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      callAmount: parseFloat(e.target.value) || 0 
                    })}
                    placeholder={formData.amountType === 'dollar' ? '50000' : '25.0'}
                  />
                  {formData.amountType === 'percentage' && (
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">%</span>
                  )}
                </div>
                {validationErrors.callAmount && (
                  <p className="text-sm text-destructive">{validationErrors.callAmount}</p>
                )}
                
                {/* Amount preview */}
                {allocationDetails && formData.callAmount > 0 && (
                  <div className="text-sm text-muted-foreground">
                    = {formatCurrency(calculateDollarAmount())} ({calculatePercentageAmount().toFixed(1)}% of commitment)
                  </div>
                )}
              </div>
            </div>

            {/* Call Date */}
            <div className="space-y-2">
              <Label htmlFor="callDate">Call Date</Label>
              <Input
                id="callDate"
                type="date"
                value={formData.callDate}
                onChange={(e) => setFormData({ ...formData, callDate: e.target.value })}
              />
              {validationErrors.callDate && (
                <p className="text-sm text-destructive">{validationErrors.callDate}</p>
              )}
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: 'scheduled' | 'called' | 'partially_paid' | 'paid') => 
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="called">Called</SelectItem>
                  <SelectItem value="partially_paid">Partially Paid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional details about this capital call..."
                rows={3}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={createCapitalCallMutation.isPending}
          >
            {createCapitalCallMutation.isPending ? 'Creating...' : 'Create Capital Call'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}