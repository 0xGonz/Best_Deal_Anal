import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  InfoIcon,
  DollarSign,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Eye,
  Edit,
  Trash2,
  MoreHorizontal,
  CheckCircle2,
  CreditCard
} from 'lucide-react';
import { EditCapitalCallForm } from '@/components/capitalcalls/EditCapitalCallForm';
import { CapitalCallPaymentHistory } from '@/components/capitalcalls/CapitalCallPaymentHistory';
import { CapitalCallPaymentForm } from '@/components/capitalcalls/CapitalCallPaymentForm';

// UI Components
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CapitalCallsListProps {
  dealId: number;
}

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'scheduled':
      return 'bg-blue-100 text-blue-700 hover:bg-blue-100';
    case 'called':
      return 'bg-amber-100 text-amber-700 hover:bg-amber-100';
    case 'partial':
      return 'bg-indigo-100 text-indigo-700 hover:bg-indigo-100';
    case 'paid':
      return 'bg-green-100 text-green-700 hover:bg-green-100';
    case 'defaulted':
      return 'bg-red-100 text-red-700 hover:bg-red-100';
    default:
      return 'bg-neutral-100 text-neutral-700 hover:bg-neutral-100';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'scheduled':
      return <Calendar className="h-4 w-4 mr-1.5" />;
    case 'called':
      return <AlertCircle className="h-4 w-4 mr-1.5" />;
    case 'partial':
      return <Clock className="h-4 w-4 mr-1.5" />;
    case 'paid':
      return <CheckCircle className="h-4 w-4 mr-1.5" />;
    case 'defaulted':
      return <XCircle className="h-4 w-4 mr-1.5" />;
    default:
      return <InfoIcon className="h-4 w-4 mr-1.5" />;
  }
};

export default function CapitalCallsList({ dealId }: CapitalCallsListProps) {
  const { toast } = useToast();
  const [selectedCall, setSelectedCall] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [selectedCallForPayment, setSelectedCallForPayment] = useState<any>(null);
  
  // Fetch all funds for reference
  const { data: funds = [] } = useQuery<any[]>({
    queryKey: ['/api/funds'],
  });
  
  // Fetch capital calls for this deal
  const { data: capitalCalls = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/capital-calls/deal/${dealId}`],
    enabled: !!dealId
  });
  
  // Fetch allocations for this deal (needed for fund name lookup)
  const { data: allocations = [] } = useQuery<any[]>({
    queryKey: [`/api/allocations/deal/${dealId}`],
    enabled: !!dealId
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (capitalCallId: number) => {
      return apiRequest('DELETE', `/api/capital-calls/${capitalCallId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/capital-calls/deal/${dealId}`] });
      toast({
        title: 'Capital call deleted',
        description: 'The capital call has been successfully deleted.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error deleting capital call',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
    }
  });

  // Mark as paid mutation
  const markAsPaidMutation = useMutation({
    mutationFn: async ({ id, amount }: { id: number, amount: number }) => {
      return apiRequest('PATCH', `/api/capital-calls/${id}/status`, {
        status: 'paid',
        paidAmount: amount
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/capital-calls/deal/${dealId}`] });
      toast({
        title: 'Capital call marked as paid',
        description: 'The capital call status has been updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error updating capital call',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
    }
  });
  
  // Handle payment actions
  const handlePaymentClick = (call: any) => {
    setSelectedCallForPayment(call);
    setIsAddPaymentOpen(true);
  };
  
  const handleViewPayments = (call: any) => {
    setSelectedCallForPayment(call);
    setShowPaymentHistory(true);
  };

  // Function to get fund name from capital call data
  const getFundName = (call: any) => {
    // First try to use direct fund_name property if it exists
    if (call.fund_name) {
      return call.fund_name;
    }
    
    // Next try to use fundName if it exists
    if (call.fundName) {
      return call.fundName;
    }
    
    // Fall back to looking up from allocation data
    const allocation = allocations.find((a: any) => a.id === call.allocationId);
    
    if (allocation) {
      // Try to get the fund from the allocation's fund object
      if (allocation.fund && allocation.fund.name) {
        return allocation.fund.name;
      }
      
      // If that's not available, look up the fund by ID
      const fundId = allocation.fundId;
      const fund = funds.find((f: any) => f.id === fundId);
      if (fund) {
        return fund.name;
      }
    }
    
    return 'Unknown Fund';
  };

  if (isLoading) {
    return (
      <div className="py-8 text-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-8 w-8 bg-neutral-200 rounded-full mb-4"></div>
          <div className="h-4 w-48 bg-neutral-200 rounded mb-3"></div>
          <div className="h-4 w-36 bg-neutral-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!capitalCalls.length) {
    return (
      <div className="text-center py-8 space-y-4">
        <DollarSign className="h-12 w-12 mx-auto text-neutral-300" />
        <div className="space-y-2">
          <p className="text-neutral-500">No capital calls have been created for this deal yet.</p>
          {allocations.length > 0 ? (
            <p className="text-sm text-neutral-400">
              Click the "Create Capital Call" button above to schedule a capital call.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-neutral-400">
                This deal must be allocated to a fund before you can create capital calls.
              </p>
              <div className="flex justify-center mt-2">
                <Button 
                  variant="outline"
                  size="sm"
                  className="text-xs rounded-full px-4 flex items-center gap-1.5 text-primary border-primary/30 hover:bg-primary/5 hover:border-primary/50"
                  onClick={() => {
                    const tabElement = document.querySelector('[data-value="allocations"]');
                    if (tabElement) {
                      (tabElement as HTMLElement).click();
                    }
                  }}
                >
                  <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse"></span>
                  Go to Allocations Tab
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px]">Fund</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Call Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {capitalCalls.map((call: any) => (
              <TableRow key={call.id}>
                <TableCell className="font-medium">
                  {getFundName(call)}
                </TableCell>
                <TableCell>
                  {call.amountType === 'dollar' ? (
                    <span>${call.callAmount.toLocaleString()}</span>
                  ) : (
                    <span>{call.callAmount}%</span>
                  )}
                </TableCell>
                <TableCell>
                  {call.callDate ? format(new Date(call.callDate), 'MMM d, yyyy') : '-'}
                </TableCell>
                <TableCell>
                  {call.dueDate ? format(new Date(call.dueDate), 'MMM d, yyyy') : '-'}
                </TableCell>
                <TableCell>
                  <Badge className={`${getStatusBadgeClass(call.status)} gap-1 whitespace-nowrap`}>
                    {getStatusIcon(call.status)}
                    <span className="capitalize">{call.status}</span>
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {call.status !== 'paid' && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="mr-1 h-8 text-xs"
                      onClick={() => handlePaymentClick(call)}
                    >
                      <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                      Pay
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => {
                          setSelectedCall(call);
                          setIsEditModalOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Capital Call
                      </DropdownMenuItem>
                      {call.status !== 'paid' && (
                        <>
                          <DropdownMenuItem
                            onClick={() => handlePaymentClick(call)}
                          >
                            <CreditCard className="h-4 w-4 mr-2 text-blue-500" />
                            Record Payment
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => markAsPaidMutation.mutate({ 
                              id: call.id, 
                              amount: call.callAmount 
                            })}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                            Mark as Fully Paid
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuItem
                        onClick={() => handleViewPayments(call)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Payment History
                      </DropdownMenuItem>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <Trash2 className="h-4 w-4 mr-2 text-red-500" />
                            Delete Capital Call
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the 
                              capital call from our servers.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              className="bg-red-500 hover:bg-red-600"
                              onClick={() => deleteMutation.mutate(call.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit Modal */}
      {selectedCall && (
        <EditCapitalCallForm
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedCall(null);
          }}
          capitalCall={selectedCall}
          dealId={dealId}
        />
      )}

      {/* Payment Form Modal */}
      {selectedCallForPayment && (
        <CapitalCallPaymentForm
          isOpen={isAddPaymentOpen}
          onClose={() => {
            setIsAddPaymentOpen(false);
            setSelectedCallForPayment(null);
          }}
          capitalCallId={selectedCallForPayment.id}
          callAmount={selectedCallForPayment.callAmount}
          paidAmount={selectedCallForPayment.paidAmount || 0}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: [`/api/capital-calls/deal/${dealId}`] });
          }}
        />
      )}

      {/* Payment History Dialog */}
      {selectedCallForPayment && (
        <Dialog 
          open={showPaymentHistory} 
          onOpenChange={() => {
            setShowPaymentHistory(false);
            setSelectedCallForPayment(null);
          }}
        >
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Payment History</DialogTitle>
              <DialogDescription>
                Payment records for capital call on {
                  selectedCallForPayment.callDate 
                    ? format(new Date(selectedCallForPayment.callDate), 'MMM d, yyyy') 
                    : '-'
                }
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2">
              <CapitalCallPaymentHistory
                capitalCallId={selectedCallForPayment.id}
                callAmount={selectedCallForPayment.callAmount}
                paidAmount={selectedCallForPayment.paidAmount || 0}
                status={selectedCallForPayment.status}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}