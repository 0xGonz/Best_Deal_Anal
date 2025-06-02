import React, { useState } from 'react';
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
  amount: string;
  commitmentDate: Date;
  notes: string;
  status: string;
  paymentOption: 'commit_only' | 'pay_immediately' | 'partial_payment';
  immediatePaymentAmount: string;
  immediatePaymentType: 'dollar' | 'percentage';
  fundingDate: Date;
}

export default function AllocateFundModal({ isOpen, onClose, dealId, dealName }: AllocateFundModalProps) {
  const { toast } = useToast();

  // State for the allocation form
  const [allocationData, setAllocationData] = useState<AllocationFormData>({
    fundId: null,
    dealId: dealId,
    amount: '',
    commitmentDate: new Date(),
    notes: '',
    status: ALLOCATION_STATUS.COMMITTED,
    paymentOption: 'commit_only',
    immediatePaymentAmount: '',
    immediatePaymentType: 'percentage',
    fundingDate: new Date()
  });

  // Fetch funds for dropdown
  const { data: funds = [], isLoading: isFundsLoading } = useQuery<any[]>({
    queryKey: ['/api/funds'],
  });

  // Calculate payment amounts with percentage support
  const calculatePaymentAmount = (totalAmount: number, paymentAmount: string, paymentType: 'dollar' | 'percentage'): number => {
    if (paymentType === 'percentage') {
      const percentage = parseFloat(paymentAmount) || 0;
      return (percentage / 100) * totalAmount;
    }
    return parseFloat(paymentAmount) || 0;
  };

  // Create immediate payment if needed
  const createImmediatePayment = async (allocationId: number, data: AllocationFormData) => {
    try {
      if (data.paymentOption === 'pay_immediately' || data.paymentOption === 'partial_payment') {
        const totalAmount = parseFloat(data.amount) || 0;
        const paymentAmount = data.paymentOption === 'pay_immediately' 
          ? totalAmount 
          : calculatePaymentAmount(totalAmount, data.immediatePaymentAmount, data.immediatePaymentType);
        
        const capitalCallPayload = {
          allocationId: allocationId,
          callAmount: paymentAmount,
          amountType: 'dollar',
          callDate: formatDateForAPI(data.fundingDate),
          dueDate: formatDateForAPI(data.fundingDate),
          status: 'paid',
          notes: `Immediate payment at commitment - ${data.paymentOption === 'pay_immediately' ? 'Full funding' : 'Partial funding'}`
        };
        
        const response = await apiRequest('POST', '/api/capital-calls', capitalCallPayload);
        if (!response.ok) {
          throw new Error(`Failed to create immediate payment: ${response.statusText}`);
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
        allocationDate: formatDateForAPI(data.commitmentDate),
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

      const response = await apiRequest('POST', '/api/allocations', allocationPayload);
      if (!response.ok) {
        throw new Error(`Failed to create allocation: ${response.statusText}`);
      }
      
      const allocation = await response.json();
      
      // Create immediate payment if needed
      await createImmediatePayment(allocation.id, data);
      
      return allocation;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Fund allocation for ${dealName} has been created.`,
      });
      
      // Reset form and close modal
      setAllocationData({
        fundId: null,
        dealId: dealId,
        amount: '',
        commitmentDate: new Date(),
        notes: '',
        status: ALLOCATION_STATUS.COMMITTED,
        paymentOption: 'commit_only',
        immediatePaymentAmount: '',
        immediatePaymentType: 'percentage',
        fundingDate: new Date()
      });
      
      onClose();
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/allocations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/funds'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create allocation.",
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
    
    const totalAmount = parseFloat(allocationData.amount) || 0;
    if (totalAmount <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid allocation amount.",
        variant: "destructive",
      });
      return;
    }

    if (allocationData.paymentOption === 'partial_payment') {
      const immediateAmount = parseFloat(allocationData.immediatePaymentAmount) || 0;
      if (immediateAmount <= 0) {
        toast({
          title: "Validation Error",
          description: "Please enter a valid immediate payment amount.",
          variant: "destructive",
        });
        return;
      }

      // Validate percentage vs dollar amounts
      if (allocationData.immediatePaymentType === 'percentage') {
        if (immediateAmount >= 100) {
          toast({
            title: "Validation Error",
            description: "Percentage should be less than 100%.",
            variant: "destructive",
          });
          return;
        }
      } else {
        if (immediateAmount >= totalAmount) {
          toast({
            title: "Validation Error",
            description: "Immediate payment amount should be less than total commitment.",
            variant: "destructive",
          });
          return;
        }
      }
    }
    
    createAllocation.mutate(allocationData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Allocate Deal to Fund</DialogTitle>
          <DialogDescription>
            Create a capital commitment for {dealName}. Separate commitment and funding dates reflect real institutional workflow.
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
              onChange={(e) => setAllocationData(prev => ({ ...prev, amount: e.target.value }))}
              placeholder="0.00"
            />
          </div>

          {/* Commitment Date */}
          <div className="space-y-2">
            <Label htmlFor="commitmentDate">Commitment Date</Label>
            <Input
              id="commitmentDate"
              type="date"
              value={format(allocationData.commitmentDate, 'yyyy-MM-dd')}
              onChange={(e) => {
                const date = new Date(e.target.value + 'T12:00:00.000Z');
                setAllocationData(prev => ({ ...prev, commitmentDate: date }));
              }}
            />
          </div>

          {/* Payment Option */}
          <div className="space-y-4">
            <Label>Payment Option</Label>
            <RadioGroup
              value={allocationData.paymentOption}
              onValueChange={(value: 'commit_only' | 'pay_immediately' | 'partial_payment') => 
                setAllocationData(prev => ({ ...prev, paymentOption: value, immediatePaymentAmount: '' }))
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

            {/* Funding Date for Immediate Payments */}
            {(allocationData.paymentOption === 'pay_immediately' || allocationData.paymentOption === 'partial_payment') && (
              <div className="space-y-2 ml-6">
                <Label htmlFor="fundingDate">Funding Date</Label>
                <Input
                  id="fundingDate"
                  type="date"
                  value={format(allocationData.fundingDate, 'yyyy-MM-dd')}
                  onChange={(e) => {
                    const date = new Date(e.target.value + 'T12:00:00.000Z');
                    setAllocationData(prev => ({ ...prev, fundingDate: date }));
                  }}
                />
              </div>
            )}

            {/* Immediate Payment Amount for Partial */}
            {allocationData.paymentOption === 'partial_payment' && (
              <div className="space-y-3 ml-6">
                <div className="space-y-2">
                  <Label>Payment Type</Label>
                  <Select
                    value={allocationData.immediatePaymentType}
                    onValueChange={(value: 'dollar' | 'percentage') => 
                      setAllocationData(prev => ({ ...prev, immediatePaymentType: value, immediatePaymentAmount: '' }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                      <SelectItem value="dollar">Dollar Amount ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="immediateAmount">
                    {allocationData.immediatePaymentType === 'percentage' ? 'Percentage to Pay' : 'Dollar Amount to Pay'}
                  </Label>
                  <Input
                    id="immediateAmount"
                    type="number"
                    value={allocationData.immediatePaymentAmount}
                    onChange={(e) => setAllocationData(prev => ({ ...prev, immediatePaymentAmount: e.target.value }))}
                    placeholder={allocationData.immediatePaymentType === 'percentage' ? '40' : '400000.00'}
                  />
                  {allocationData.immediatePaymentType === 'percentage' && (
                    <p className="text-sm text-gray-500">
                      Enter percentage (e.g., 40 for 40%)
                    </p>
                  )}
                </div>
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