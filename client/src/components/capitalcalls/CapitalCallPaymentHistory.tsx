import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CapitalCallPaymentForm } from './CapitalCallPaymentForm';
import { Plus, Receipt, DollarSign, CreditCard, AlertCircle, CheckCircle } from 'lucide-react';

interface CapitalCallPaymentHistoryProps {
  capitalCallId: number;
  callAmount: number;
  paidAmount: number;
  status: string;
}

// Helper functions to format payment type
const getPaymentTypeIcon = (type: string) => {
  switch (type) {
    case 'wire':
      return <CreditCard className="h-4 w-4 mr-1.5 text-purple-500" />;
    case 'check':
      return <Receipt className="h-4 w-4 mr-1.5 text-blue-500" />;
    case 'ach':
      return <DollarSign className="h-4 w-4 mr-1.5 text-green-500" />;
    default:
      return <DollarSign className="h-4 w-4 mr-1.5 text-gray-500" />;
  }
};

const formatPaymentType = (type: string) => {
  switch (type) {
    case 'wire':
      return 'Wire Transfer';
    case 'check':
      return 'Check';
    case 'ach':
      return 'ACH Transfer';
    default:
      return 'Other';
  }
};

export function CapitalCallPaymentHistory({ 
  capitalCallId, 
  callAmount,
  paidAmount = 0,
  status
}: CapitalCallPaymentHistoryProps) {
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  
  // Fetch payments for this capital call
  const { data: payments = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: [`/api/capital-calls/${capitalCallId}/payments`],
    enabled: !!capitalCallId
  });
  
  // Calculate payment progress
  const paymentPercentage = callAmount > 0 ? Math.min(100, Math.round((paidAmount / callAmount) * 100)) : 0;
  const outstandingAmount = Math.max(0, callAmount - paidAmount);

  if (isLoading) {
    return (
      <div className="py-4 text-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-4 w-48 bg-neutral-200 rounded mb-2"></div>
          <div className="h-4 w-36 bg-neutral-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Payment Summary Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Payment Summary</CardTitle>
          <CardDescription>
            Track progress of payments for this capital call
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-2">
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <div>
                <span className="text-muted-foreground">Total Amount:</span>
                <span className="ml-2 font-semibold">${callAmount.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Paid Amount:</span>
                <span className="ml-2 font-semibold text-green-600">
                  ${paidAmount.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Outstanding:</span>
                <span className="ml-2 font-semibold text-orange-600">
                  ${outstandingAmount.toLocaleString()}
                </span>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between mb-1 text-xs">
                <span>Payment Progress</span>
                <span>{paymentPercentage}%</span>
              </div>
              <Progress value={paymentPercentage} className="h-2" />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                {status === 'paid' ? (
                  <div className="flex items-center text-green-600 text-sm font-medium">
                    <CheckCircle className="h-4 w-4 mr-1.5" />
                    Fully Paid
                  </div>
                ) : status === 'partial' ? (
                  <div className="flex items-center text-orange-600 text-sm font-medium">
                    <AlertCircle className="h-4 w-4 mr-1.5" />
                    Partially Paid
                  </div>
                ) : (
                  <div className="flex items-center text-muted-foreground text-sm">
                    <AlertCircle className="h-4 w-4 mr-1.5" />
                    Payment Due
                  </div>
                )}
              </div>
              
              {status !== 'paid' && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-xs"
                  onClick={() => setIsAddPaymentOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Record Payment
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Payment History Table */}
      {payments.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment Type</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        {format(new Date(payment.paymentDate), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="font-medium">
                        ${payment.paymentAmount.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          {getPaymentTypeIcon(payment.paymentType)}
                          {formatPaymentType(payment.paymentType)}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {payment.notes || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-4 text-muted-foreground">
          <p>No payment records yet.</p>
        </div>
      )}
      
      {/* Payment Form Dialog */}
      <CapitalCallPaymentForm
        isOpen={isAddPaymentOpen}
        onClose={() => setIsAddPaymentOpen(false)}
        capitalCallId={capitalCallId}
        callAmount={callAmount}
        paidAmount={paidAmount}
        onSuccess={() => refetch()}
      />
    </div>
  );
}