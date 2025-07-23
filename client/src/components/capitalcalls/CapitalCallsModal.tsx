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
  allocationId: number;
  callAmount: number;
  callDate: string;
  dueDate: string;
  status: 'scheduled' | 'sent' | 'paid' | 'overdue';
  paidAmount: number | null;
  notes: string | null;
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
    callAmount: 0,
    callDate: format(new Date(), "yyyy-MM-dd"),
    dueDate: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"), // 30 days from now
    status: 'scheduled' as const,
    notes: ''
  });

  // Fetch capital calls for this allocation
  const { data: capitalCalls = [], isLoading } = useQuery<CapitalCall[]>({
    queryKey: [`/api/capital-calls/allocation/${allocation.id}`],
    enabled: isOpen && !!allocation.id
  });

  // Calculate totals
  const totalCalled = capitalCalls.reduce((sum, call) => sum + call.callAmount, 0);
  const totalPaid = capitalCalls.reduce((sum, call) => sum + (call.paidAmount || 0), 0);
  const remainingCommitment = allocation.amount - totalCalled;
  const outstandingAmount = totalCalled - totalPaid;

  // Create capital call mutation
  const createCapitalCall = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest('POST', '/api/capital-calls', {
        allocationId: allocation.id,
        ...data,
        callAmount: parseFloat(data.callAmount.toString())
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: [`/api/capital-calls/allocation/${allocation.id}`] 
      });
      toast({
        title: "Capital call created",
        description: "The capital call has been scheduled successfully.",
        variant: "success"
      });
      setShowAddForm(false);
      setFormData({
        callAmount: 0,
        callDate: format(new Date(), "yyyy-MM-dd"),
        dueDate: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
        status: 'scheduled',
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
      scheduled: { label: "Scheduled", className: "bg-gray-100 text-gray-700" },
      sent: { label: "Sent", className: "bg-blue-100 text-blue-700" },
      paid: { label: "Paid", className: "bg-green-100 text-green-700" },
      overdue: { label: "Overdue", className: "bg-red-100 text-red-700" }
    };
    
    const config = statusConfig[call.status];
    return <Badge className={config.className}>{config.label}</Badge>;
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
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Committed</p>
            <p className="text-xl font-semibold text-blue-700">
              {formatCurrency(allocation.amount)}
            </p>
          </div>
          <div className="bg-amber-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Called</p>
            <p className="text-xl font-semibold text-amber-700">
              {formatCurrency(totalCalled)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {((totalCalled / allocation.amount) * 100).toFixed(0)}% of commitment
            </p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Paid</p>
            <p className="text-xl font-semibold text-green-700">
              {formatCurrency(totalPaid)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {totalCalled > 0 ? ((totalPaid / totalCalled) * 100).toFixed(0) : 0}% of called
            </p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Remaining</p>
            <p className="text-xl font-semibold text-purple-700">
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
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Capital Call
              </Button>
            )}
          </div>

          {/* Add New Capital Call Form */}
          {showAddForm && (
            <div className="border rounded-lg p-4 bg-gray-50">
              <h4 className="font-medium mb-4">New Capital Call</h4>
              <form onSubmit={(e) => {
                e.preventDefault();
                createCapitalCall.mutate(formData);
              }} className="space-y-4">
                <Alert className="mb-4">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    You can call up to {formatCurrency(remainingCommitment)} 
                    ({((remainingCommitment / allocation.amount) * 100).toFixed(0)}% of commitment remaining)
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="callAmount">Call Amount *</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                      <Input
                        id="callAmount"
                        type="number"
                        step="0.01"
                        min="0"
                        max={remainingCommitment}
                        className="pl-10"
                        value={formData.callAmount}
                        onChange={(e) => setFormData({
                          ...formData,
                          callAmount: parseFloat(e.target.value) || 0
                        })}
                        required
                      />
                    </div>
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

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createCapitalCall.isPending || formData.callAmount <= 0}
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
              <div className="animate-pulse">Loading capital calls...</div>
            </div>
          ) : capitalCalls.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <CreditCard className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No capital calls yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Click "Add Capital Call" to create the first one
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {capitalCalls.map((call) => (
                <div key={call.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <h4 className="font-medium text-lg">
                          {formatCurrency(call.callAmount)}
                        </h4>
                        {getStatusBadge(call)}
                        {call.paidAmount && call.paidAmount < call.callAmount && (
                          <Badge className="bg-purple-100 text-purple-700">
                            Partial: {formatCurrency(call.paidAmount)} paid
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>Call Date: {format(new Date(call.callDate), "MMM d, yyyy")}</p>
                        <p>Due Date: {format(new Date(call.dueDate), "MMM d, yyyy")}</p>
                        {call.notes && <p className="italic">Note: {call.notes}</p>}
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
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Mark as Paid
                      </Button>
                    )}
                  </div>

                  {/* Progress Bar for Partial Payments */}
                  {call.paidAmount && call.paidAmount > 0 && call.paidAmount < call.callAmount && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Payment Progress</span>
                        <span>{((call.paidAmount / call.callAmount) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full transition-all duration-300"
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