/**
 * Comprehensive Distributions Management Hub
 * 
 * A modular, scalable system for tracking and managing distributions across:
 * - Fund-level overview and bulk actions
 * - Allocation-level distributions management
 * - Deal-specific distributions tracking
 * - Historical distributions entry and management
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { CalendarIcon, Plus, TrendingUp, DollarSign, Target, History, Eye, Trash2, Edit } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';

// Robust currency formatting utility for distributions
const formatDistributionCurrency = (value: any): string => {
  if (value === null || value === undefined) return '$0';
  
  let numValue: number;
  if (typeof value === 'string') {
    numValue = parseFloat(value);
  } else if (typeof value === 'number') {
    numValue = value;
  } else {
    return '$0';
  }
  
  if (isNaN(numValue)) return '$0';
  
  return formatCurrency(numValue, { showCents: false });
};

interface DistributionsManagementHubProps {
  fundId?: number;
  allocationId?: number;
  dealId?: number;
  mode: 'fund' | 'allocation' | 'deal';
}

const distributionFormSchema = z.object({
  allocationId: z.number(),
  distributionDate: z.date(),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  distributionType: z.enum(['dividend', 'return_of_capital', 'realized_gain', 'interest', 'other']),
  notes: z.string().optional(),
  isHistorical: z.boolean().default(false),
});

type DistributionFormData = z.infer<typeof distributionFormSchema>;

interface DistributionSummary {
  totalDistributions: number;
  distributionCount: number;
  averageDistribution: number;
  lastDistributionDate?: string;
  distributionYield: number;
  monthlyDistributions: { month: string; amount: number }[];
}

export function DistributionsManagementHub({ 
  fundId, 
  allocationId, 
  dealId, 
  mode 
}: DistributionsManagementHubProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingDistribution, setEditingDistribution] = useState<any>(null);
  const queryClient = useQueryClient();

  // Query for distributions based on mode
  const { data: distributions = [], isLoading: distributionsLoading, error: distributionsError } = useQuery({
    queryKey: mode === 'fund' 
      ? [`/api/distributions/fund/${fundId}`]
      : mode === 'allocation'
      ? [`/api/distributions/allocation/${allocationId}`]
      : [`/api/distributions/deal/${dealId}`],
    enabled: !!(fundId || allocationId || dealId),
  });



  // Query for allocations (for dropdown when adding distributions)
  const { data: allocations = [] } = useQuery({
    queryKey: fundId ? [`/api/allocations/fund/${fundId}`] : ['/api/allocations'],
    enabled: mode === 'fund' || mode === 'deal',
  });

  const form = useForm<DistributionFormData>({
    resolver: zodResolver(distributionFormSchema),
    defaultValues: {
      allocationId: allocationId || 0,
      distributionDate: new Date(),
      amount: 0,
      distributionType: 'dividend',
      notes: '',
      isHistorical: false,
    },
  });

  // Create distribution mutation
  const createDistributionMutation = useMutation({
    mutationFn: (data: DistributionFormData) => apiRequest('/api/distributions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/distributions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/allocations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fund-overview'] });
      setIsAddDialogOpen(false);
      form.reset();
    },
  });

  // Update distribution mutation
  const updateDistributionMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<DistributionFormData> }) => 
      apiRequest('PUT', `/api/distributions/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/distributions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/allocations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fund-overview'] });
      setIsEditDialogOpen(false);
      setEditingDistribution(null);
      toast({
        title: "Distribution updated",
        description: "The distribution has been updated successfully.",
      });
    },
  });

  // Delete distribution mutation
  const deleteDistributionMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/distributions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/distributions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/allocations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fund-overview'] });
      toast({
        title: "Distribution deleted",
        description: "The distribution has been removed successfully.",
      });
    },
  });

  const onSubmit = (data: DistributionFormData) => {
    createDistributionMutation.mutate(data);
  };

  const handleEditDistribution = (distribution: any) => {
    setEditingDistribution(distribution);
    setIsEditDialogOpen(true);
  };

  const handleDeleteDistribution = (id: number) => {
    if (confirm('Are you sure you want to delete this distribution?')) {
      deleteDistributionMutation.mutate(id);
    }
  };

  // Safe number conversion utility
  const safeNumber = (value: any): number => {
    if (typeof value === 'number') return isNaN(value) ? 0 : value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  // Calculate summary from distributions with proper type safety
  const summary: DistributionSummary = {
    totalDistributions: distributions.reduce((sum: number, dist: any) => {
      return sum + safeNumber(dist.amount);
    }, 0),
    distributionCount: distributions.length,
    averageDistribution: distributions.length > 0 
      ? distributions.reduce((sum: number, dist: any) => sum + safeNumber(dist.amount), 0) / distributions.length 
      : 0,
    lastDistributionDate: distributions.length > 0 
      ? distributions.sort((a: any, b: any) => new Date(b.distributionDate).getTime() - new Date(a.distributionDate).getTime())[0]?.distributionDate
      : undefined,
    distributionYield: distributions.length > 0 && allocations.length > 0
      ? (distributions.reduce((sum: number, dist: any) => sum + safeNumber(dist.amount), 0) / 
         allocations.reduce((sum: number, alloc: any) => sum + safeNumber(alloc.amount), 1)) * 100
      : 0,
    monthlyDistributions: [],
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Distributions Management</h2>
          <p className="text-muted-foreground">
            Track and manage distributions across your {mode}
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Distribution
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add Distribution</DialogTitle>
              <DialogDescription>
                Add a new distribution. Mark as historical if backdating.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {(mode === 'fund' || mode === 'deal') && (
                  <FormField
                    control={form.control}
                    name="allocationId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Allocation</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select allocation" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {allocations.map((allocation: any) => (
                              <SelectItem key={allocation.id} value={allocation.id.toString()}>
                                {allocation.dealName} - {formatDistributionCurrency(allocation.amount)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="distributionDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Distribution Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className="w-full pl-3 text-left font-normal"
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date > new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="distributionType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Distribution Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="dividend">Dividend</SelectItem>
                          <SelectItem value="return_of_capital">Return of Capital</SelectItem>
                          <SelectItem value="realized_gain">Realized Gain</SelectItem>
                          <SelectItem value="interest">Interest</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Additional notes..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isHistorical"
                    {...form.register('isHistorical')}
                  />
                  <label htmlFor="isHistorical" className="text-sm">
                    Mark as historical distribution
                  </label>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createDistributionMutation.isPending}>
                    {createDistributionMutation.isPending ? 'Adding...' : 'Add Distribution'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Distributions</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDistributionCurrency(summary.totalDistributions)}</div>
            <p className="text-xs text-muted-foreground">
              {summary.distributionCount} distributions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Distribution</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDistributionCurrency(summary.averageDistribution)}</div>
            <p className="text-xs text-muted-foreground">
              per distribution
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Distribution Yield</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.distributionYield.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              annualized yield
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Distribution</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.lastDistributionDate ? format(new Date(summary.lastDistributionDate), 'MMM d') : 'None'}
            </div>
            <p className="text-xs text-muted-foreground">
              most recent
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="historical">Historical</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Distributions</CardTitle>
              <CardDescription>
                All distributions for this {mode}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {distributionsLoading ? (
                <div className="flex items-center space-x-2 py-6">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                  <span>Loading distributions...</span>
                </div>
              ) : distributionsError ? (
                <div className="text-red-600 py-6">
                  <h4 className="font-semibold">Error Loading Distributions</h4>
                  <p className="text-sm mt-1">
                    Failed to load distributions data. Please try again.
                  </p>
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer">Technical Details</summary>
                    <pre className="mt-1 bg-gray-100 p-2 rounded overflow-auto">
                      {JSON.stringify(distributionsError, null, 2)}
                    </pre>
                  </details>
                </div>
              ) : distributions.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  No distributions found
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Type</TableHead>
                      {mode !== 'allocation' && <TableHead>Allocation</TableHead>}
                      <TableHead>Notes</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {distributions.map((distribution: any) => (
                      <TableRow key={distribution.id}>
                        <TableCell>
                          {format(new Date(distribution.distributionDate), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatDistributionCurrency(distribution.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {distribution.distributionType.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        {mode !== 'allocation' && (
                          <TableCell>{distribution.dealName || 'Unknown'}</TableCell>
                        )}
                        <TableCell className="max-w-xs truncate">
                          {distribution.notes || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteDistribution(distribution.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historical" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Historical Distributions</CardTitle>
              <CardDescription>
                All distributions for this {mode} sorted by date
              </CardDescription>
            </CardHeader>
            <CardContent>
              {distributionsLoading ? (
                <div className="flex items-center space-x-2 py-6">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                  <span>Loading distributions...</span>
                </div>
              ) : distributionsError ? (
                <div className="text-red-600 py-6">
                  <h4 className="font-semibold">Error Loading Distributions</h4>
                  <p className="text-sm mt-1">
                    Failed to load distributions data. Please try again.
                  </p>
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer">Technical Details</summary>
                    <pre className="mt-1 bg-gray-100 p-2 rounded overflow-auto">
                      {JSON.stringify(distributionsError, null, 2)}
                    </pre>
                  </details>
                </div>
              ) : distributions.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <History className="mx-auto h-12 w-12 mb-4" />
                  <h3 className="text-sm font-semibold">No Historical Distributions</h3>
                  <p className="text-sm mt-1">
                    Use the "Add Distribution" button to record historical distributions.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Type</TableHead>
                      {mode !== 'allocation' && <TableHead>Allocation</TableHead>}
                      <TableHead>Notes</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {distributions
                      .sort((a, b) => new Date(b.distributionDate).getTime() - new Date(a.distributionDate).getTime())
                      .map((distribution: any) => (
                      <TableRow key={distribution.id}>
                        <TableCell>
                          {format(new Date(distribution.distributionDate), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(distribution.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {distribution.distributionType.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        {mode !== 'allocation' && (
                          <TableCell>{distribution.dealName || 'Unknown'}</TableCell>
                        )}
                        <TableCell className="max-w-xs truncate">
                          {distribution.notes || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteDistribution(distribution.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Distribution Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                {distributions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No distributions to analyze</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(
                      distributions.reduce((acc: any, dist: any) => {
                        const type = dist.distributionType.replace('_', ' ');
                        acc[type] = (acc[type] || 0) + parseFloat(dist.amount);
                        return acc;
                      }, {})
                    ).map(([type, amount]) => (
                      <div key={type} className="flex justify-between">
                        <span className="text-sm capitalize">{type}</span>
                        <span className="text-sm font-medium">{formatCurrency(amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Monthly Trends</CardTitle>
              </CardHeader>
              <CardContent>
                {distributions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data for trends</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(
                      distributions.reduce((acc: any, dist: any) => {
                        const month = format(new Date(dist.distributionDate), 'MMM yyyy');
                        acc[month] = (acc[month] || 0) + parseFloat(dist.amount);
                        return acc;
                      }, {})
                    )
                    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
                    .map(([month, amount]) => (
                      <div key={month} className="flex justify-between">
                        <span className="text-sm">{month}</span>
                        <span className="text-sm font-medium">{formatCurrency(amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>All Distributions</CardTitle>
              <CardDescription>
                Detailed view with analytics insights
              </CardDescription>
            </CardHeader>
            <CardContent>
              {distributionsLoading ? (
                <div className="flex items-center space-x-2 py-6">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                  <span>Loading distributions...</span>
                </div>
              ) : distributionsError ? (
                <div className="text-red-600 py-6">
                  <h4 className="font-semibold">Error Loading Distributions</h4>
                  <p className="text-sm mt-1">
                    Failed to load distributions data. Please try again.
                  </p>
                </div>
              ) : distributions.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <TrendingUp className="mx-auto h-12 w-12 mb-4" />
                  <h3 className="text-sm font-semibold">No Analytics Data</h3>
                  <p className="text-sm mt-1">
                    Add distributions to see analytics insights.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Type</TableHead>
                      {mode !== 'allocation' && <TableHead>Allocation</TableHead>}
                      <TableHead>% of Total</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {distributions
                      .sort((a, b) => new Date(b.distributionDate).getTime() - new Date(a.distributionDate).getTime())
                      .map((distribution: any) => {
                        const totalDistributions = distributions.reduce((sum: number, d: any) => 
                          sum + parseFloat(d.amount), 0
                        );
                        const percentage = ((parseFloat(distribution.amount) / totalDistributions) * 100).toFixed(1);
                        
                        return (
                          <TableRow key={distribution.id}>
                            <TableCell>
                              {format(new Date(distribution.distributionDate), 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(distribution.amount)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {distribution.distributionType.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            {mode !== 'allocation' && (
                              <TableCell>{distribution.dealName || 'Unknown'}</TableCell>
                            )}
                            <TableCell>
                              <span className="text-sm font-medium">{percentage}%</span>
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {distribution.notes || '-'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Distribution Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Distribution</DialogTitle>
          </DialogHeader>
          {editingDistribution && (
            <EditDistributionForm
              distribution={editingDistribution}
              allocations={allocations}
              onSubmit={(data) => {
                updateDistributionMutation.mutate({
                  id: editingDistribution.id,
                  data
                });
              }}
              onCancel={() => {
                setIsEditDialogOpen(false);
                setEditingDistribution(null);
              }}
              isLoading={updateDistributionMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Edit Distribution Form Component
function EditDistributionForm({
  distribution,
  allocations,
  onSubmit,
  onCancel,
  isLoading
}: {
  distribution: any;
  allocations: any[];
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const form = useForm({
    resolver: zodResolver(distributionFormSchema),
    defaultValues: {
      allocationId: distribution.allocationId,
      distributionDate: new Date(distribution.distributionDate),
      amount: parseFloat(distribution.amount),
      distributionType: distribution.distributionType,
      notes: distribution.notes || '',
      isHistorical: false,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="allocationId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Allocation</FormLabel>
              <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select allocation" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {allocations.map((allocation) => (
                    <SelectItem key={allocation.id} value={allocation.id.toString()}>
                      {allocation.dealName} - {formatCurrency(allocation.amount)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="distributionDate"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Distribution Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? (
                        format(field.value, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) =>
                      date > new Date() || date < new Date("1900-01-01")
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="distributionType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Distribution Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="dividend">Dividend</SelectItem>
                  <SelectItem value="return_of_capital">Return of Capital</SelectItem>
                  <SelectItem value="realized_gain">Realized Gain</SelectItem>
                  <SelectItem value="interest">Interest</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea placeholder="Optional notes" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Updating...' : 'Update Distribution'}
          </Button>
        </div>
      </form>
    </Form>
  );
}