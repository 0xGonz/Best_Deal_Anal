import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { formatDateForAPI } from '@/lib/dateUtils';
import { ALLOCATION_STATUS } from '@/lib/constants/allocation-constants';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface AllocateFundModalProps {
  isOpen: boolean;
  onClose: () => void;
  dealId: number;
  dealName: string;
}

interface AllocationFormData {
  fundId: number | null;
  dealId: number;
  amount: number;
  allocationDate: Date;
  notes: string;
  status: string;
  paymentOption: 'commit_only' | 'pay_immediately' | 'partial_payment';
  immediatePaymentAmount: number;
}

export default function AllocateFundModal({ isOpen, onClose, dealId, dealName }: AllocateFundModalProps) {
  const { toast } = useToast();

  // State for the allocation form
  const [allocationData, setAllocationData] = useState<AllocationFormData>({
    fundId: null,
    dealId: dealId,
    amount: 0,
    allocationDate: new Date(),
    notes: '',
    status: ALLOCATION_STATUS.COMMITTED,
    paymentOption: 'commit_only',
    immediatePaymentAmount: 0
  });

  // Update dealId when prop changes (fixes bug where dealId wouldn't update when modal reopens)
  useEffect(() => {
    setAllocationData(prev => ({
      ...prev,
      dealId: dealId
    }));
  }, [dealId]);

  // Fetch funds for dropdown
  const { data: funds = [], isLoading: isFundsLoading } = useQuery<any[]>({
    queryKey: ['/api/funds'],
  });

  // Create immediate payment if needed
  const createImmediatePayment = async (allocationId: number, data: AllocationFormData) => {
    try {
      if (data.paymentOption === 'pay_immediately' || data.paymentOption === 'partial_payment') {
        const paymentAmount = data.paymentOption === 'pay_immediately' 
          ? data.amount 
          : data.immediatePaymentAmount;
        
        const capitalCallPayload = {
          allocationId: allocationId,
          callAmount: paymentAmount,
          amountType: 'dollar',
          callDate: formatDateForAPI(data.allocationDate),
          dueDate: formatDateForAPI(data.allocationDate),
          status: 'paid',
          notes: `Immediate payment at commitment - ${data.paymentOption === 'pay_immediately' ? 'Full funding' : 'Partial funding'}`
        };
        
        const response = await apiRequest('POST', '/api/capital-calls', capitalCallPayload);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to create immediate payment: ${response.statusText}`);
        }
      }
    } catch (error) {
      console.error('Error creating immediate payment:', error);
      throw error;
    }
  };

  // Create allocation mutation
  const createAllocation = useMutation({
    mutationFn: async (data: AllocationFormData) => {
      // Create allocation first
      const allocationPayload = {
        fundId: data.fundId,
        dealId: data.dealId,
        amount: data.amount,
        allocationDate: formatDateForAPI(data.allocationDate),
        status: data.paymentOption === 'pay_immediately' ? 'funded' : 
                data.paymentOption === 'partial_payment' ? 'partially_paid' : 'committed',
        notes: data.notes,
        portfolioWeight: 0,
        interestPaid: 0,
        distributionPaid: 0,
        marketValue: data.amount,
        moic: 1,
        irr: 0
      };

      const response = await apiRequest('POST', '/api/production/allocations', allocationPayload);
      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle conflict error for existing allocations
        if (response.status === 409 && errorData.error?.includes('already exists')) {
          throw new Error(`This deal is already allocated to the selected fund. Please check the fund's portfolio or modify the existing allocation instead.`);
        }
        
        throw new Error(errorData.error || `Failed to create allocation: ${response.statusText}`);
      }
      
      const result = await response.json();
      const allocation = result.data || result.allocation || result;
      
      // Create immediate payment if needed
      if (allocation && allocation.id) {
        await createImmediatePayment(allocation.id, data);
      }
      
      return allocation;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Fund allocation for ${dealName} has been created.`,
        variant: "success"
      });
      
      // Reset form and close modal
      setAllocationData({
        fundId: null,
        dealId: dealId,
        amount: 0,
        allocationDate: new Date(),
        notes: '',
        status: ALLOCATION_STATUS.COMMITTED,
        paymentOption: 'commit_only',
        immediatePaymentAmount: 0
      });
      
      onClose();
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: [`/api/production/allocations/fund/${allocationData.fundId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/funds/${allocationData.fundId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
    },
    onError: (error: any) => {
      console.error('Allocation creation error:', error);
      
      let errorMessage = "Failed to create allocation.";
      let errorTitle = "Error";
      
      // Handle specific error types
      if (error.status === 409) {
        errorTitle = "Allocation Already Exists";
        errorMessage = error.data?.error || "An allocation for this deal and fund combination already exists.";
      } else if (error.data?.error) {
        errorMessage = error.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    // Basic validation
    if (!allocationData.fundId) {
      toast({
        title: "Validation Error",
        description: "Please select a fund.",
        variant: "destructive",
      });
      return;
    }
    
    if (allocationData.amount <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid allocation amount.",
        variant: "destructive",
      });
      return;
    }

    if (allocationData.paymentOption === 'partial_payment' && allocationData.immediatePaymentAmount <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid immediate payment amount.",
        variant: "destructive",
      });
      return;
    }

    if (allocationData.paymentOption === 'partial_payment' && allocationData.immediatePaymentAmount >= allocationData.amount) {
      toast({
        title: "Validation Error",
        description: "Immediate payment amount should be less than total commitment.",
        variant: "destructive",
      });
      return;
    }
    
    createAllocation.mutate(allocationData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Allocate Deal to Fund</DialogTitle>
          <DialogDescription>
            Create a capital commitment for {dealName}. You can commit capital only, or make an immediate payment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Fund Selection */}
          <div className="space-y-2">
            <Label htmlFor="fund">Select Fund *</Label>
            <Select
              value={allocationData.fundId?.toString() || ""}
              onValueChange={(value) => setAllocationData(prev => ({ ...prev, fundId: parseInt(value) }))}
            >
              <SelectTrigger id="fund">
                <SelectValue placeholder="Choose a fund" />
              </SelectTrigger>
              <SelectContent>
                {isFundsLoading ? (
                  <SelectItem value="loading" disabled>Loading funds...</SelectItem>
                ) : (
                  funds.map((fund) => (
                    <SelectItem key={fund.id} value={fund.id.toString()}>
                      {fund.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Commitment Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Total Commitment Amount *</Label>
            <Input
              id="amount"
              type="number"
              value={allocationData.amount}
              onChange={(e) => setAllocationData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
              placeholder="0.00"
            />
          </div>

          {/* Allocation Date */}
          <div className="space-y-2">
            <Label htmlFor="allocationDate">Commitment Date</Label>
            <Input
              id="allocationDate"
              type="date"
              value={format(allocationData.allocationDate, 'yyyy-MM-dd')}
              onChange={(e) => setAllocationData(prev => ({ ...prev, allocationDate: new Date(e.target.value) }))}
            />
          </div>

          {/* Payment Option */}
          <div className="space-y-4">
            <Label>Payment Option</Label>
            <RadioGroup
              value={allocationData.paymentOption}
              onValueChange={(value: 'commit_only' | 'pay_immediately' | 'partial_payment') => 
                setAllocationData(prev => ({ ...prev, paymentOption: value, immediatePaymentAmount: 0 }))
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="commit_only" id="commit_only" />
                <Label htmlFor="commit_only" className="cursor-pointer">
                  <div>
                    <div className="font-medium">Commit Only</div>
                    <div className="text-sm text-gray-500">Make commitment, wait for capital calls</div>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pay_immediately" id="pay_immediately" />
                <Label htmlFor="pay_immediately" className="cursor-pointer">
                  <div>
                    <div className="font-medium">Pay Immediately (Full)</div>
                    <div className="text-sm text-gray-500">Fund the entire commitment now</div>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <RadioGroupItem value="partial_payment" id="partial_payment" />
                <Label htmlFor="partial_payment" className="cursor-pointer">
                  <div>
                    <div className="font-medium">Partial Payment</div>
                    <div className="text-sm text-gray-500">Make partial payment now, rest on future calls</div>
                  </div>
                </Label>
              </div>
            </RadioGroup>

            {/* Immediate Payment Amount for Partial */}
            {allocationData.paymentOption === 'partial_payment' && (
              <div className="space-y-2 ml-6">
                <Label htmlFor="immediateAmount">Immediate Payment Amount</Label>
                <Input
                  id="immediateAmount"
                  type="number"
                  value={allocationData.immediatePaymentAmount}
                  onChange={(e) => setAllocationData(prev => ({ ...prev, immediatePaymentAmount: parseFloat(e.target.value) || 0 }))}
                  placeholder="0.00"
                  max={allocationData.amount}
                />
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={allocationData.notes}
              onChange={(e) => setAllocationData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Add any notes about this allocation..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={createAllocation.isPending}
          >
            {createAllocation.isPending ? 'Creating...' : 'Create Allocation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}