import React, { useState } from 'react';
import { useParams } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { DATE_FORMATS } from '@/lib/constants/time-constants';
import { formatCurrency, formatDate } from '@/lib/utils/formatters';
import { formatAmountByType } from '@/lib/utils/format';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { 
  CAPITAL_CALL_STATUS, 
  CAPITAL_CALL_STATUS_COLORS, 
  CAPITAL_CALL_STATUS_LABELS,
  type CapitalCallStatus
} from '@/lib/constants/capital-call-constants';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { 
  Loader2, 
  ChevronLeft, 
  PlusCircle, 
  AlertTriangle,
  Calendar as CalendarIcon,
  CreditCard
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import AppLayout from '@/components/layout/AppLayout';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DatePicker } from '@/components/ui/date-picker';

// Types for the component
interface CapitalCall {
  id: number;
  allocationId: number;
  callAmount: number;
  amountType: 'percentage' | 'dollar';
  callDate: string;
  dueDate: string;
  paidAmount: number;
  paidDate: string | null;
  status: CapitalCallStatus;
  notes: string | null;
}

interface Allocation {
  id: number;
  fundId: number;
  dealId: number;
  amount: number;
  amountType: 'percentage' | 'dollar';
  securityType: string;
  allocationDate: string;
  notes: string | null;
  status: string;
  portfolioWeight: number;
  deal?: {
    id: number;
    name: string;
  };
  fund?: {
    id: number;
    name: string;
  };
}

// Form schema for creating a new capital call
const createCapitalCallSchema = z.object({
  callAmount: z.coerce.number().positive({ message: "Amount must be greater than 0" }),
  amountType: z.enum(["percentage", "dollar"], {
    required_error: "Please select an amount type",
  }),
  callDate: z.date({
    required_error: "Call date is required",
  }),
  dueDate: z.date({
    required_error: "Due date is required",
  }),
  notes: z.string().optional(),
});

type CreateCapitalCallFormValues = z.infer<typeof createCapitalCallSchema>;

const CapitalCallsByAllocation = () => {
  const { id } = useParams();
  const allocationId = id ? parseInt(id) : 0;
  const { toast } = useToast();
  const [isNewCallDialogOpen, setIsNewCallDialogOpen] = useState(false);
  
  // Fetch allocation details
  const { data: allocation, isLoading: isLoadingAllocation } = useQuery<Allocation>({
    queryKey: [`/api/production/allocations/${allocationId}`],
    enabled: !!allocationId,
  });

  // Fetch capital calls for this allocation
  const { data: capitalCalls = [], isLoading: isLoadingCalls } = useQuery<CapitalCall[]>({
    queryKey: ['/api/capital-calls/allocation', allocationId],
    enabled: !!allocationId,
  });
  
  const isLoading = isLoadingAllocation || isLoadingCalls;

  // Calculate total called and total paid amounts
  // Only display authentic database data - no synthetic calculations
  const totalCalledAmount = allocation?.calledAmount || null;
  
  // Only display authentic database data - no synthetic calculations
  const totalPaidAmount = allocation?.paidAmount || null;

  // Sort capital calls by dueDate (most recent first)
  const sortedCapitalCalls = React.useMemo(() => {
    return [...capitalCalls].sort((a, b) => {
      return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
    });
  }, [capitalCalls]);

  // Create a new capital call
  const form = useForm<CreateCapitalCallFormValues>({
    resolver: zodResolver(createCapitalCallSchema),
    defaultValues: {
      callAmount: 0,
      amountType: "dollar",
      notes: "",
    },
  });

  const createCapitalCallMutation = useMutation({
    mutationFn: async (formData: CreateCapitalCallFormValues) => {
      const data = {
        ...formData,
        allocationId,
        callDate: formData.callDate.toISOString(),
        dueDate: formData.dueDate.toISOString(),
        status: CAPITAL_CALL_STATUS.SCHEDULED,
      };
      
      const response = await apiRequest('POST', '/api/capital-calls', data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Capital call created successfully",
      });
      setIsNewCallDialogOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: [`/api/production/allocations/${allocationId}/capital-calls`] });
      queryClient.invalidateQueries({ queryKey: [`/api/production/allocations/${allocationId}`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to create capital call: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateCapitalCallFormValues) => {
    createCapitalCallMutation.mutate(data);
  };

  // Update capital call status
  const updateCapitalCallStatus = useMutation({
    mutationFn: async ({ id, status, paidAmount }: { id: number, status: CapitalCallStatus, paidAmount?: number }) => {
      const data = {
        status,
        paidAmount: status === CAPITAL_CALL_STATUS.PARTIALLY_PAID ? paidAmount : undefined,
        paidDate: (status === CAPITAL_CALL_STATUS.PAID || status === CAPITAL_CALL_STATUS.PARTIALLY_PAID) ? new Date().toISOString() : undefined,
      };
      
      const response = await apiRequest('PATCH', `/api/capital-calls/${id}/status`, data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Capital call status updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/production/allocations/${allocationId}/capital-calls`] });
      queryClient.invalidateQueries({ queryKey: [`/api/production/allocations/${allocationId}`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to update capital call status: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto pb-20 p-4 md:p-6">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="flex items-center">
            <Button variant="ghost" className="mr-2 sm:mr-3 h-9 w-9 sm:p-2 p-1.5" asChild>
              <a href={`/funds/${allocation?.fundId}`}>
                <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </a>
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-neutral-800 truncate">
                {isLoadingAllocation ? "Loading..." : `Capital Calls for ${allocation?.deal?.name}`}
              </h1>
              {allocation && (
                <p className="text-sm text-neutral-500">
                  {allocation.fund?.name} • Allocation amount: {formatAmountByType(allocation.amount, allocation.amountType)}
                </p>
              )}
            </div>
          </div>
          
          <Dialog open={isNewCallDialogOpen} onOpenChange={setIsNewCallDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary-dark text-white">
                <PlusCircle className="h-4 w-4 mr-2" />
                New Capital Call
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Capital Call</DialogTitle>
                <DialogDescription>
                  Schedule a new capital call for this allocation
                </DialogDescription>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="callAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Call Amount</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="amountType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select amount type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="dollar">Dollar Amount</SelectItem>
                              <SelectItem value="percentage">Percentage</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="callDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Call Date</FormLabel>
                          <DatePicker date={field.value} setDate={field.onChange} />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="dueDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Due Date</FormLabel>
                          <DatePicker date={field.value} setDate={field.onChange} />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes (Optional)</FormLabel>
                        <FormControl>
                          <Textarea {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <DialogFooter>
                    <Button 
                      type="submit" 
                      disabled={createCapitalCallMutation.isPending}
                      className="bg-primary hover:bg-primary-dark text-white"
                    >
                      {createCapitalCallMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create Capital Call
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
        
        {/* Progress Summary Card */}
        {allocation && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <h3 className="text-base font-medium text-neutral-500 mb-1">Total Allocation</h3>
                  <p className="text-2xl font-semibold">{formatAmountByType(allocation.amount, allocation.amountType)}</p>
                </div>
                <div>
                  <h3 className="text-base font-medium text-neutral-500 mb-1">Total Called</h3>
                  <p className="text-2xl font-semibold">{formatCurrency(totalCalledAmount)}</p>
                  <p className="text-sm text-neutral-500">
                    {allocation.amount > 0 ? `${((totalCalledAmount / allocation.amount) * 100).toFixed(1)}% of allocation` : '0% of allocation'}
                  </p>
                </div>
                <div>
                  <h3 className="text-base font-medium text-neutral-500 mb-1">Total Paid</h3>
                  <p className="text-2xl font-semibold">{formatCurrency(totalPaidAmount)}</p>
                  <p className="text-sm text-neutral-500">
                    {totalCalledAmount > 0 ? `${((totalPaidAmount / totalCalledAmount) * 100).toFixed(1)}% of called capital` : '0% of called capital'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Capital Calls Table */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle>Capital Calls</CardTitle>
            <CardDescription>
              Scheduled and historical capital calls for this allocation
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
              </div>
            ) : sortedCapitalCalls.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CreditCard className="h-12 w-12 text-neutral-300 mb-3" />
                <h3 className="text-lg font-medium text-neutral-600 mb-1">No capital calls found</h3>
                <p className="text-neutral-500 max-w-md mb-4">
                  There are no capital calls scheduled for this allocation yet. Click "New Capital Call" to create one.
                </p>
                <Button onClick={() => setIsNewCallDialogOpen(true)} className="bg-primary hover:bg-primary-dark text-white">
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Create First Capital Call
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Call Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedCapitalCalls.map((call) => (
                    <TableRow key={call.id}>
                      <TableCell>{formatDate(call.callDate)}</TableCell>
                      <TableCell>{formatDate(call.dueDate)}</TableCell>
                      <TableCell>{formatAmountByType(call.callAmount, call.amountType)}</TableCell>
                      <TableCell>
                        <Badge className={CAPITAL_CALL_STATUS_COLORS[call.status]}>
                          {CAPITAL_CALL_STATUS_LABELS[call.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {call.status === CAPITAL_CALL_STATUS.SCHEDULED && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => updateCapitalCallStatus.mutate({ id: call.id, status: CAPITAL_CALL_STATUS.CALLED })}
                            >
                              Mark Called
                            </Button>
                          )}
                          {(call.status === CAPITAL_CALL_STATUS.SCHEDULED || 
                            call.status === CAPITAL_CALL_STATUS.CALLED || 
                            call.status === CAPITAL_CALL_STATUS.PARTIALLY_PAID) && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 border-emerald-300"
                              onClick={() => updateCapitalCallStatus.mutate({ id: call.id, status: CAPITAL_CALL_STATUS.PAID })}
                            >
                              Mark Paid
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default CapitalCallsByAllocation;