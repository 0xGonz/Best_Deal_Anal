import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format, addDays } from 'date-fns';
import { DollarSign, Calendar, AlertCircle, Info } from 'lucide-react';
import { formatDateForInput, formatDisplayDate, getTodayUTC, parseUTCDate } from '@shared/utils/dateUtils';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface CreateCapitalCallFormProps {
  isOpen: boolean;
  onClose: () => void;
  dealId: number;
  onSuccess?: () => void;
}

interface CapitalCallFormData {
  allocationId: number | null;
  callAmount: number;
  amountType: 'percentage' | 'dollar';
  callDate: string;
  dueDate: string;
  notes: string;
  status: string;
}

export function CreateCapitalCallForm({ isOpen, onClose, dealId, onSuccess }: CreateCapitalCallFormProps) {
  const { toast } = useToast();
  
  // Default values for the form
  const [formData, setFormData] = useState<CapitalCallFormData>({
    allocationId: null,
    callAmount: 0,
    amountType: 'percentage',
    callDate: getTodayUTC(),
    dueDate: formatDateForInput(addDays(new Date(), 30)),
    notes: '',
    status: 'scheduled'
  });

  // Fetch allocations for this deal
  const { data: allocations = [], isLoading: isAllocationsLoading } = useQuery<any[]>({
    queryKey: [`/api/allocations/deal/${dealId}`],
    enabled: isOpen && !!dealId
  });

  // Create capital call mutation
  const createCapitalCallMutation = useMutation({
    mutationFn: async (data: CapitalCallFormData) => {
      // Convert date strings to proper UTC date objects for the API
      const formattedData = {
        ...data,
        callDate: parseUTCDate(data.callDate).toISOString(),
        dueDate: parseUTCDate(data.dueDate).toISOString()
      };
      
      const response = await apiRequest("POST", "/api/capital-calls", formattedData);
      if (!response.ok) {
        const errorResponse = await response.json();
        throw new Error(errorResponse.message || 'Failed to create capital call');
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Capital call created successfully"
      });
      
      // Reset form
      setFormData({
        allocationId: null,
        callAmount: 0,
        amountType: 'percentage',
        callDate: getTodayUTC(),
        dueDate: formatDateForInput(addDays(new Date(), 30)),
        notes: '',
        status: 'scheduled'
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: [`/api/capital-calls/deal/${dealId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}`] });
      
      // Close dialog and call onSuccess if provided
      onClose();
      if (onSuccess) onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to create capital call: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.allocationId) {
      toast({
        title: "Error",
        description: "Please select a fund allocation",
        variant: "destructive"
      });
      return;
    }
    
    if (!formData.callAmount || formData.callAmount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount greater than 0",
        variant: "destructive"
      });
      return;
    }
    
    createCapitalCallMutation.mutate(formData);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Create Capital Call
          </DialogTitle>
          <DialogDescription>
            Schedule a new capital call for this investment
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <Alert className="mb-3">
            <Info className="h-4 w-4" />
            <AlertTitle>About Capital Calls</AlertTitle>
            <AlertDescription>
              Capital calls request funds from investors for a specific allocation. You can specify either a percentage of the committed amount or a specific dollar amount.
            </AlertDescription>
          </Alert>
          
          <div className="space-y-2">
            <Label htmlFor="allocation">Fund Allocation *</Label>
            <Select
              value={formData.allocationId ? formData.allocationId.toString() : undefined}
              onValueChange={(value) => setFormData({
                ...formData,
                allocationId: parseInt(value)
              })}
            >
              <SelectTrigger id="allocation">
                <SelectValue placeholder="Select an allocation" />
              </SelectTrigger>
              <SelectContent>
                {isAllocationsLoading ? (
                  <SelectItem value="loading" disabled>Loading allocations...</SelectItem>
                ) : allocations.length === 0 ? (
                  <SelectItem value="none" disabled>No allocations available</SelectItem>
                ) : (
                  allocations.map((allocation: any) => (
                    <SelectItem key={allocation.id} value={allocation.id.toString()}>
                      {allocation.fund?.name || 'Unnamed Fund'} (${allocation.amount.toLocaleString()})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="callAmount">Call Amount *</Label>
              <div className="flex items-center space-x-2">
                <Label htmlFor="amountType" className="text-xs">Type:</Label>
                <Select
                  value={formData.amountType}
                  onValueChange={(value) => setFormData({
                    ...formData,
                    amountType: value as 'dollar' | 'percentage'
                  })}
                >
                  <SelectTrigger id="amountType" className="h-7 w-[90px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dollar">Dollar</SelectItem>
                    <SelectItem value="percentage">Percentage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                {formData.amountType === 'dollar' ? '$' : ''}
              </span>
              <Input
                id="callAmount"
                type="number"
                min="0"
                step={formData.amountType === 'dollar' ? '1000' : '1'}
                className={formData.amountType === 'dollar' ? 'pl-6' : ''}
                value={formData.callAmount || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  callAmount: parseFloat(e.target.value)
                })}
                placeholder="0.00"
              />
              {formData.amountType === 'percentage' && (
                <span className="absolute inset-y-0 right-3 flex items-center text-neutral-500">
                  %
                </span>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="callDate" className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Call Date *
              </Label>
              <Input
                id="callDate"
                type="date"
                value={formData.callDate}
                onChange={(e) => setFormData({
                  ...formData,
                  callDate: e.target.value
                })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="dueDate" className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Due Date *
              </Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({
                  ...formData,
                  dueDate: e.target.value
                })}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="status" className="flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" />
              Status
            </Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({
                ...formData,
                status: value
              })}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="called">Called</SelectItem>
                <SelectItem value="partial">Partial Payment</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="defaulted">Defaulted</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {formData.status === 'scheduled' && "The capital call is planned but not yet issued to investors."}
              {formData.status === 'called' && "Official notice has been issued to investors."}
              {formData.status === 'partially_paid' && "Some funds have been received but not the full amount."}
              {formData.status === 'paid' && "The capital call has been fully paid by investors."}
              {formData.status === 'defaulted' && "The investor failed to meet their payment obligation."}
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({
                ...formData,
                notes: e.target.value
              })}
              placeholder="Optional notes about this capital call"
            />
          </div>
          
          <DialogFooter className="mt-6">
            <DialogClose asChild>
              <Button variant="outline" type="button">Cancel</Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={createCapitalCallMutation.isPending}
            >
              {createCapitalCallMutation.isPending ? "Creating..." : "Create Capital Call"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}