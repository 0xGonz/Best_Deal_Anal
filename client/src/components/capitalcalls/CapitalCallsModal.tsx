import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/services/formatters";
import { 
  Plus, 
  DollarSign, 
  Calendar,
  AlertCircle,
  Info,
  CreditCard,
  CheckCircle
} from "lucide-react";
import { FundAllocation } from "@/lib/types";

interface CapitalCallsModalProps {
  isOpen: boolean;
  onClose: () => void;
  allocation: FundAllocation;
  dealName: string;
}

interface CapitalCall {
  id: number;
  allocationId?: number;
  callAmount: number;
  amountType?: 'dollar' | 'percentage';
  callDate: string;
  dueDate: string;
  status: 'scheduled' | 'sent' | 'paid' | 'overdue';
  paidAmount: number | null;
  notes: string | null;
}

interface CapitalCallsResponse {
  allocationId: number;
  committedAmount: number;
  totalCalled: number;
  totalPaid: number;
  percentageCalled: number;
  percentagePaid: number;
  currentStatus: string;
  capitalCalls: CapitalCall[];
}

export default function CapitalCallsModal({ 
  isOpen, 
  onClose, 
  allocation,
  dealName 
}: CapitalCallsModalProps) {
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    callAmount: '',
    amountType: 'dollar' as 'dollar' | 'percentage',
    callDate: format(new Date(), "yyyy-MM-dd"),
    dueDate: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"), // 30 days from now
    status: 'called' as const,
    notes: ''
  });

  // Fetch capital calls for this allocation
  const { data: capitalCallsData, isLoading } = useQuery<CapitalCallsResponse>({
    queryKey: [`/api/capital-calls/allocation/${allocation.id}`],
    enabled: isOpen && !!allocation.id
  });

  // Extract data from response
  const capitalCalls = capitalCallsData?.capitalCalls || [];
  const totalCalled = capitalCallsData?.totalCalled || 0;
  const totalPaid = capitalCallsData?.totalPaid || 0;
  const remainingCommitment = allocation.amount - totalCalled;
  const outstandingAmount = totalCalled - totalPaid;

  // Create capital call mutation
  const createCapitalCall = useMutation({
    mutationFn: async (data: typeof formData) => {
      const amount = parseFloat(data.callAmount);
      const finalAmount = data.amountType === 'percentage' 
        ? (amount / 100) * allocation.amount 
        : amount;
      
      return apiRequest('POST', '/api/capital-calls', {
        allocationId: allocation.id,
        ...data,
        callAmount: finalAmount,
        amountType: data.amountType
      });
    },
    onSuccess: () => {
      // Invalidate all related queries to refresh called/uncalled amounts
      queryClient.invalidateQueries({ 
        queryKey: [`/api/capital-calls/allocation/${allocation.id}`] 
      });
      queryClient.invalidateQueries({ 
        queryKey: [`/api/production/allocations/fund/${allocation.fundId}`] 
      });
      queryClient.invalidateQueries({ 
        queryKey: [`/api/funds/${allocation.fundId}`] 
      });
      queryClient.invalidateQueries({ 
        queryKey: [`/api/fund-overview/${allocation.fundId}`] 
      });
      queryClient.invalidateQueries({ 
        queryKey: [`/api/allocations/deal/${allocation.dealId}`] 
      });
      toast({
        title: "Capital call created",
        description: "The capital call has been scheduled successfully.",
        variant: "success"
      });
      setShowAddForm(false);
      setFormData({
        callAmount: '',
        amountType: 'dollar',
        callDate: format(new Date(), "yyyy-MM-dd"),
        dueDate: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
        status: 'called',
        notes: ''
      });
    },
    onError: (error) => {
      toast({
        title: "Error creating capital call",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    }
  });

  // Mark capital call as paid mutation
  const markAsPaid = useMutation({
    mutationFn: async ({ id, amount }: { id: number, amount: number }) => {
      return apiRequest('PATCH', `/api/capital-calls/${id}/status`, {
        status: 'paid',
        paidAmount: amount
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: [`/api/capital-calls/allocation/${allocation.id}`] 
      });
      toast({
        title: "Payment recorded",
        description: "The capital call has been marked as paid.",
        variant: "success"
      });
    },
    onError: (error) => {
      toast({
        title: "Error recording payment",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    }
  });

  const getStatusBadge = (call: CapitalCall) => {
    const statusConfig = {
      scheduled: { label: "Scheduled", className: "bg-gray-100 text-gray-700 border-gray-200" },
      sent: { label: "Sent", className: "bg-blue-50 text-blue-700 border-blue-200" },
      paid: { label: "Paid", className: "bg-green-50 text-green-700 border-green-200" },
      overdue: { label: "Overdue", className: "bg-red-50 text-red-700 border-red-200" }
    };
    
    const config = statusConfig[call.status];
    return <Badge variant="outline" className={config.className}>{config.label}</Badge>;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Capital Calls for {dealName}
          </DialogTitle>
          <DialogDescription>
            Manage capital calls for this allocation
          </DialogDescription>
        </DialogHeader>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 my-6">
          <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Committed</p>
            <p className="text-xl font-semibold text-neutral-900">
              {formatCurrency(allocation.amount)}
            </p>
          </div>
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Called</p>
            <p className="text-xl font-semibold text-amber-700">
              {formatCurrency(totalCalled)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {allocation.amount > 0 ? ((totalCalled / allocation.amount) * 100).toFixed(0) : 0}% of commitment
            </p>
          </div>
          <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Paid</p>
            <p className="text-xl font-semibold text-green-700">
              {formatCurrency(totalPaid)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {totalCalled > 0 ? ((totalPaid / totalCalled) * 100).toFixed(0) : 0}% of called
            </p>
          </div>
          <div className="bg-neutral-50 border border-neutral-200 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Remaining</p>
            <p className="text-xl font-semibold text-neutral-700">
              {formatCurrency(remainingCommitment)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Available to call
            </p>
          </div>
        </div>

        {/* Outstanding Amount Alert */}
        {outstandingAmount > 0 && (
          <Alert className="mb-4 border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-700">
              <strong>{formatCurrency(outstandingAmount)}</strong> is outstanding 
              ({capitalCalls.filter(c => c.status !== 'paid').length} unpaid capital calls)
            </AlertDescription>
          </Alert>
        )}

        {/* Capital Calls List */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Capital Call History</h3>
            {!showAddForm && remainingCommitment > 0 && (
              <Button 
                onClick={() => setShowAddForm(true)}
                size="sm"
                className="bg-neutral-900 hover:bg-neutral-800 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Capital Call
              </Button>
            )}
          </div>

          {/* Add New Capital Call Form */}
          {showAddForm && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h4 className="font-semibold text-neutral-900 mb-4">New Capital Call</h4>
              <form onSubmit={(e) => {
                e.preventDefault();
                createCapitalCall.mutate(formData);
              }} className="space-y-4">
                <Alert className="mb-4 bg-blue-50 border-blue-200">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-700">
                    You can call up to {formatCurrency(remainingCommitment)} 
                    ({allocation.amount > 0 ? ((remainingCommitment / allocation.amount) * 100).toFixed(0) : 0}% of commitment remaining)
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amountType">Amount Type *</Label>
                    <Select
                      value={formData.amountType}
                      onValueChange={(value: 'dollar' | 'percentage') => setFormData({
                        ...formData,
                        amountType: value,
                        callAmount: '' // Reset amount when type changes
                      })}
                    >
                      <SelectTrigger id="amountType">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dollar">Dollar Amount</SelectItem>
                        <SelectItem value="percentage">Percentage of Commitment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="callAmount">
                      {formData.amountType === 'dollar' ? 'Call Amount *' : 'Percentage (%) *'}
                    </Label>
                    <div className="relative">
                      {formData.amountType === 'dollar' ? (
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                      ) : (
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">%</span>
                      )}
                      <Input
                        id="callAmount"
                        type="number"
                        step={formData.amountType === 'dollar' ? "0.01" : "1"}
                        min="0"
                        max={formData.amountType === 'dollar' ? remainingCommitment : 100}
                        className="pl-10"
                        value={formData.callAmount}
                        onChange={(e) => setFormData({
                          ...formData,
                          callAmount: e.target.value
                        })}
                        placeholder={formData.amountType === 'dollar' ? "0.00" : "0"}
                        required
                      />
                    </div>
                    {formData.amountType === 'percentage' && formData.callAmount && (
                      <p className="text-xs text-gray-600">
                        = {formatCurrency((parseFloat(formData.callAmount) / 100) * allocation.amount)}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Initial Status *</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({
                        ...formData,
                        status: value as any
                      })}
                    >
                      <SelectTrigger id="status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="callDate">Call Date *</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                      <Input
                        id="callDate"
                        type="date"
                        className="pl-10"
                        value={formData.callDate}
                        onChange={(e) => setFormData({
                          ...formData,
                          callDate: e.target.value
                        })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Due Date *</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                      <Input
                        id="dueDate"
                        type="date"
                        className="pl-10"
                        value={formData.dueDate}
                        onChange={(e) => setFormData({
                          ...formData,
                          dueDate: e.target.value
                        })}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Input
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({
                      ...formData,
                      notes: e.target.value
                    })}
                    placeholder="Additional details about this capital call"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddForm(false)}
                    className="border-gray-300"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createCapitalCall.isPending || !formData.callAmount || parseFloat(formData.callAmount) <= 0}
                    className="bg-neutral-900 hover:bg-neutral-800 text-white"
                  >
                    {createCapitalCall.isPending ? "Creating..." : "Create Capital Call"}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Capital Calls List */}
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-pulse text-gray-500">Loading capital calls...</div>
            </div>
          ) : capitalCalls.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
              <CreditCard className="h-12 w-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-600 font-medium">No capital calls yet</p>
              <p className="text-sm text-gray-500 mt-1">
                Click "Add Capital Call" to create the first one
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {capitalCalls.map((call) => (
                <div key={call.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <h4 className="font-semibold text-lg text-neutral-900">
                          {formatCurrency(call.callAmount)}
                        </h4>
                        {getStatusBadge(call)}
                        {call.paidAmount && call.paidAmount < call.callAmount && (
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                            Partial: {formatCurrency(call.paidAmount)} paid
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-gray-400" />
                          <span>Call Date: {format(new Date(call.callDate), "MMM d, yyyy")}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-gray-400" />
                          <span>Due Date: {format(new Date(call.dueDate), "MMM d, yyyy")}</span>
                        </div>
                        {call.notes && (
                          <div className="flex items-start gap-2 mt-2">
                            <Info className="h-3.5 w-3.5 text-gray-400 mt-0.5" />
                            <p className="italic text-gray-600">{call.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {call.status !== 'paid' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => markAsPaid.mutate({ 
                          id: call.id, 
                          amount: call.callAmount 
                        })}
                        disabled={markAsPaid.isPending}
                        className="border-green-200 text-green-700 hover:bg-green-50"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Mark as Paid
                      </Button>
                    )}
                  </div>

                  {/* Progress Bar for Partial Payments */}
                  {call.paidAmount && call.paidAmount > 0 && call.paidAmount < call.callAmount && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="flex justify-between text-xs text-gray-600 mb-1.5">
                        <span className="font-medium">Payment Progress</span>
                        <span className="font-medium">{((call.paidAmount / call.callAmount) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-green-600 h-2 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${(call.paidAmount / call.callAmount) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}