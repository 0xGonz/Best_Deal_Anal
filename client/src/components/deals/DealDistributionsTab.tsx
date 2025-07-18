import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit, Trash2, TrendingUp, DollarSign, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface DealDistribution {
  id: number;
  allocationId: number;
  distributionDate: string;
  amount: string;
  distributionType: "dividend" | "capital_return" | "interest" | "fee" | "other";
  notes?: string;
  createdAt: string;
  fundName: string;
  fundId: number;
  allocationAmount: string;
}

interface DealDistributionsTabProps {
  dealId: number;
}

const distributionFormSchema = z.object({
  allocationId: z.number(),
  distributionDate: z.string().min(1, "Distribution date is required"),
  amount: z.number().positive("Amount must be positive"),
  distributionType: z.enum(["dividend", "capital_return", "interest", "fee", "other"]),
  notes: z.string().optional(),
});

type DistributionFormData = z.infer<typeof distributionFormSchema>;

export const DealDistributionsTab: React.FC<DealDistributionsTabProps> = ({ dealId }) => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingDistribution, setEditingDistribution] = useState<DealDistribution | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch distributions for this deal
  const { data: distributions = [], isLoading, refetch } = useQuery<DealDistribution[]>({
    queryKey: [`/api/distributions/deal/${dealId}`],
    enabled: !!dealId,
  });

  // Fetch allocations for this deal to populate dropdown
  const { data: allocations = [] } = useQuery<any[]>({
    queryKey: [`/api/allocations/deal/${dealId}`],
    enabled: !!dealId,
  });

  const form = useForm<DistributionFormData>({
    resolver: zodResolver(distributionFormSchema),
    defaultValues: {
      distributionDate: new Date().toISOString().split('T')[0],
      distributionType: "dividend",
      notes: "",
    },
  });

  // Add distribution mutation
  const addDistributionMutation = useMutation({
    mutationFn: (data: DistributionFormData) => {
      return apiRequest("POST", "/api/distributions", data);
    },
    onSuccess: () => {
      toast({
        title: "Distribution added",
        description: "The distribution has been recorded successfully.",
      });
      refetch();
      queryClient.invalidateQueries({ queryKey: [`/api/allocations/deal/${dealId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/distributions`] });
      setIsAddDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Error adding distribution",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  // Update distribution mutation
  const updateDistributionMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<DistributionFormData> }) => {
      return apiRequest("PUT", `/api/distributions/${id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Distribution updated",
        description: "The distribution has been updated successfully.",
      });
      refetch();
      queryClient.invalidateQueries({ queryKey: [`/api/allocations/deal/${dealId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/distributions`] });
      setIsEditDialogOpen(false);
      setEditingDistribution(null);
    },
    onError: (error) => {
      toast({
        title: "Error updating distribution",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  // Delete distribution mutation
  const deleteDistributionMutation = useMutation({
    mutationFn: (id: number) => {
      return apiRequest("DELETE", `/api/distributions/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Distribution deleted",
        description: "The distribution has been deleted successfully.",
      });
      refetch();
      queryClient.invalidateQueries({ queryKey: [`/api/allocations/deal/${dealId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/distributions`] });
    },
    onError: (error) => {
      toast({
        title: "Error deleting distribution",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(num));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDistributionTypeLabel = (type: string) => {
    const labels = {
      dividend: "Dividend",
      capital_return: "Capital Return",
      interest: "Interest",
      fee: "Fee",
      other: "Other",
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getDistributionTypeBadge = (type: string) => {
    const classes = {
      dividend: "bg-green-100 text-green-800",
      capital_return: "bg-blue-100 text-blue-800",
      interest: "bg-purple-100 text-purple-800",
      fee: "bg-red-100 text-red-800",
      other: "bg-gray-100 text-gray-800",
    };
    return classes[type as keyof typeof classes] || "bg-gray-100 text-gray-800";
  };

  const handleEditDistribution = (distribution: DealDistribution) => {
    setEditingDistribution(distribution);
    form.reset({
      allocationId: distribution.allocationId,
      distributionDate: distribution.distributionDate.split('T')[0],
      amount: parseFloat(distribution.amount),
      distributionType: distribution.distributionType,
      notes: distribution.notes || "",
    });
    setIsEditDialogOpen(true);
  };

  const onSubmit = (data: DistributionFormData) => {
    if (editingDistribution) {
      updateDistributionMutation.mutate({ id: editingDistribution.id, data });
    } else {
      addDistributionMutation.mutate(data);
    }
  };

  const totalDistributions = distributions.reduce((sum: number, dist: any) => sum + parseFloat(dist.amount || '0'), 0);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="text-muted-foreground">Loading distributions...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Deal Distributions
            </CardTitle>
            <CardDescription>
              All distributions across fund allocations for this deal
            </CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Distribution
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Distribution</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="allocationId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fund Allocation</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(parseInt(value))}
                          value={field.value?.toString()}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select an allocation" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {allocations.map((allocation: any) => (
                              <SelectItem key={allocation.id} value={allocation.id.toString()}>
                                {allocation.fundName} - {formatCurrency(allocation.amount)}
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
                      <FormItem>
                        <FormLabel>Distribution Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
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
                            min="0"
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
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="dividend">Dividend</SelectItem>
                            <SelectItem value="capital_return">Capital Return</SelectItem>
                            <SelectItem value="interest">Interest</SelectItem>
                            <SelectItem value="fee">Fee</SelectItem>
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
                          <Textarea
                            placeholder="Additional notes about this distribution..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsAddDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={addDistributionMutation.isPending}>
                      {addDistributionMutation.isPending ? "Adding..." : "Add Distribution"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-blue-600 font-medium">Total Distributions</p>
                <p className="text-lg font-bold text-blue-800">{formatCurrency(totalDistributions)}</p>
              </div>
            </div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-green-600 font-medium">Distribution Count</p>
                <p className="text-lg font-bold text-green-800">{distributions.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm text-purple-600 font-medium">Avg Distribution</p>
                <p className="text-lg font-bold text-purple-800">
                  {distributions.length > 0 ? formatCurrency(totalDistributions / distributions.length) : '$0'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Distributions List */}
        {distributions.length === 0 ? (
          <div className="text-center py-8">
            <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">No distributions recorded for this deal yet.</p>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Distribution
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>
        ) : (
          <div className="space-y-3">
            {distributions.map((distribution) => (
              <div
                key={distribution.id}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={getDistributionTypeBadge(distribution.distributionType)}>
                        {getDistributionTypeLabel(distribution.distributionType)}
                      </Badge>
                      <span className="text-sm text-gray-500">•</span>
                      <span className="text-sm text-gray-600">{distribution.fundName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-lg">{formatCurrency(distribution.amount)}</p>
                        <p className="text-sm text-gray-500">
                          {formatDate(distribution.distributionDate)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditDistribution(distribution)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this distribution?")) {
                              deleteDistributionMutation.mutate(distribution.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {distribution.notes && (
                      <p className="text-sm text-gray-600 mt-2">{distribution.notes}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Edit Distribution Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Distribution</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="allocationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fund Allocation</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an allocation" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {allocations.map((allocation: any) => (
                          <SelectItem key={allocation.id} value={allocation.id.toString()}>
                            {allocation.fundName} - {formatCurrency(allocation.amount)}
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
                  <FormItem>
                    <FormLabel>Distribution Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
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
                        min="0"
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="dividend">Dividend</SelectItem>
                        <SelectItem value="capital_return">Capital Return</SelectItem>
                        <SelectItem value="interest">Interest</SelectItem>
                        <SelectItem value="fee">Fee</SelectItem>
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
                      <Textarea
                        placeholder="Additional notes about this distribution..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingDistribution(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateDistributionMutation.isPending}>
                  {updateDistributionMutation.isPending ? "Updating..." : "Update Distribution"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Card>
  );
};