import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CreditCard, DollarSign, Calendar } from 'lucide-react';
import { formatCurrency } from '@/lib/services/formatters';
import { format } from 'date-fns';

interface CapitalCallsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  allocationId: number;
  dealName?: string;
  fundName?: string;
}

interface CapitalCall {
  id: number;
  allocationId: number;
  amount: number;
  amountType: string;
  callDate: string;
  dueDate?: string;
  status: 'scheduled' | 'called' | 'partially_paid' | 'paid';
  notes?: string;
  createdAt: string;
  payments?: Payment[];
}

interface Payment {
  id: number;
  capitalCallId: number;
  amount: number;
  paymentDate: string;
  paymentMethod?: string;
  status: string;
  notes?: string;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'paid':
      return 'bg-green-100 text-green-800';
    case 'partially_paid':
      return 'bg-yellow-100 text-yellow-800';
    case 'called':
      return 'bg-blue-100 text-blue-800';
    case 'scheduled':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'paid':
      return <DollarSign className="h-3 w-3" />;
    case 'partially_paid':
      return <AlertCircle className="h-3 w-3" />;
    case 'called':
      return <CreditCard className="h-3 w-3" />;
    case 'scheduled':
      return <Calendar className="h-3 w-3" />;
    default:
      return <CreditCard className="h-3 w-3" />;
  }
};

export function CapitalCallsPopup({
  isOpen,
  onClose,
  allocationId,
  dealName,
  fundName,
}: CapitalCallsPopupProps) {
  // Fetch capital calls for this allocation
  const { data: capitalCallsData, isLoading, error } = useQuery({
    queryKey: [`/api/capital-calls/allocation/${allocationId}`],
    enabled: isOpen && !!allocationId,
  });

  // Extract capital calls from the response
  const capitalCalls = capitalCallsData?.capitalCalls || [];
  
  // Extract payment information from capital calls (only show actual payments, not synthetic data)
  const allPayments = capitalCalls
    .filter((call: any) => call.paidAmount && call.paidAmount > 0)
    .map((call: any) => ({
      id: call.id,
      capitalCallId: call.id,
      amount: call.paidAmount,
      paymentDate: call.paidDate || call.callDate,
      status: 'completed',
      notes: call.notes
    }));

  // Calculate totals
  const totalCalled = capitalCalls.reduce((sum: number, call: any) => sum + (call.callAmount || 0), 0);
  const totalPaid = allPayments.reduce((sum: number, payment: any) => sum + payment.amount, 0);
  const outstanding = totalCalled - totalPaid;

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-blue-600" />
            Capital Calls
            {dealName && <span className="text-muted-foreground">- {dealName}</span>}
          </DialogTitle>
          <DialogDescription>
            {fundName && <span>Fund: {fundName} • </span>}
            View all capital calls and payment details for this allocation
          </DialogDescription>
        </DialogHeader>

        {/* Summary Section */}
        <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-neutral-50 rounded-lg border">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <CreditCard className="h-4 w-4 text-neutral-600" />
              <span className="text-sm font-medium text-neutral-600">Committed</span>
            </div>
            <p className="text-xl font-semibold text-neutral-900">{formatCurrency(capitalCallsData?.committedAmount || 0)}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <CreditCard className="h-4 w-4 text-neutral-600" />
              <span className="text-sm font-medium text-neutral-600">Total Called</span>
            </div>
            <p className="text-xl font-semibold text-neutral-900">{formatCurrency(totalCalled)}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-neutral-600" />
              <span className="text-sm font-medium text-neutral-600">Total Paid</span>
            </div>
            <p className="text-xl font-semibold text-neutral-900">{formatCurrency(totalPaid)}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-neutral-600" />
              <span className="text-sm font-medium text-neutral-600">Uncalled</span>
            </div>
            <p className="text-xl font-semibold text-neutral-900">{formatCurrency((capitalCallsData?.committedAmount || 0) - totalCalled)}</p>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600">Failed to load capital calls</p>
          </div>
        )}

        {/* Capital Calls Table */}
        {!isLoading && !error && capitalCalls.length === 0 ? (
          <div className="text-center py-8">
            <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No capital calls found for this allocation</p>
          </div>
        ) : (
          <div className="space-y-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Call Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payments</TableHead>
                  <TableHead>Outstanding</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {capitalCalls.map((call: any) => {
                  const callPayments = allPayments.filter((p: any) => p.capitalCallId === call.id);
                  const paidAmount = callPayments.reduce((sum: number, p: any) => sum + p.amount, 0);
                  const callOutstanding = (call.callAmount || 0) - paidAmount;

                  return (
                    <TableRow key={call.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          {format(new Date(call.dueDate || call.callDate), 'MMM dd, yyyy')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{formatCurrency(call.callAmount || 0)}</span>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${getStatusColor(call.status)} flex items-center gap-1 w-fit`}>
                          {getStatusIcon(call.status)}
                          {call.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {callPayments.length === 0 ? (
                          <span className="text-gray-500">No payments</span>
                        ) : (
                          <div className="space-y-1">
                            {callPayments.map((payment) => (
                              <div key={payment.id} className="text-sm">
                                <div className="flex items-center gap-2">
                                  <DollarSign className="h-3 w-3 text-green-600" />
                                  <span className="font-medium text-green-600">
                                    {formatCurrency(payment.amount)}
                                  </span>
                                </div>
                              </div>
                            ))}
                            <div className="text-xs text-gray-500 border-t pt-1">
                              Total: {formatCurrency(paidAmount)}
                            </div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {callOutstanding > 0 ? (
                          <span className="font-medium text-red-600">
                            {formatCurrency(callOutstanding)}
                          </span>
                        ) : (
                          <span className="text-green-600">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {call.notes ? (
                          <span className="text-sm text-gray-600">{call.notes}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}