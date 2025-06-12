import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { formatDisplayDate } from "@shared/utils/dateUtils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  FilePenLine, 
  DollarSign, 
  TrendingUp, 
  Percent,
  Building2,
  AlertCircle
} from "lucide-react";

interface FundAllocation {
  id: number;
  fundId: number;
  dealId: number;
  amount: number;
  status: "committed" | "funded" | "unfunded" | "partially_paid";
  portfolioWeight: number;
  distributionPaid: number;
  marketValue: number;
  moic: number;
  irr: number;
  notes?: string;
  allocationDate: string;
  fundName?: string;
}

interface InvestmentTrackingTabProps {
  dealId: number;
}

export default function InvestmentTrackingTab({ dealId }: InvestmentTrackingTabProps) {
  const { toast } = useToast();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<FundAllocation | null>(null);

  // Fetch allocations for this deal
  const { data: allocations, isLoading } = useQuery<FundAllocation[]>({
    queryKey: [`/api/allocations/deal/${dealId}`],
    enabled: !!dealId
  });

  // Update allocation mutation
  const updateAllocation = useMutation({
    mutationFn: async () => {
      if (!editingAllocation) {
        throw new Error("No allocation selected for editing.");
      }
      
      const res = await apiRequest("PUT", `/api/allocations/${editingAllocation.id}`, editingAllocation);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Investment updated",
        description: "The investment tracking data has been updated successfully.",
      });
      
      // Close dialog and refresh data
      setIsEditDialogOpen(false);
      setEditingAllocation(null);
      queryClient.invalidateQueries({ queryKey: [`/api/allocations/deal/${dealId}`] });
    },
    onError: (error) => {
      toast({
        title: "Error updating investment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEditAllocation = (allocation: FundAllocation) => {
    setEditingAllocation({ ...allocation });
    setIsEditDialogOpen(true);
  };

  const handleSaveAllocation = () => {
    updateAllocation.mutate();
  };

  if (isLoading) {
    return (
      <div className="p-6 text-center text-gray-500">
        Loading investment tracking data...
      </div>
    );
  }

  if (!allocations || allocations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Investment Tracking
          </CardTitle>
          <CardDescription>
            Track investment performance metrics for this deal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium mb-2">No Fund Allocations</p>
            <p className="text-sm">
              This deal has not been allocated to any funds yet. 
              Once allocated, you can track investment performance here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Investment Tracking
          </CardTitle>
          <CardDescription>
            Track distributions, valuations, MOIC, and IRR for fund allocations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fund</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Committed</TableHead>
                  <TableHead className="text-right">Distributions</TableHead>
                  <TableHead className="text-right">Current Value</TableHead>
                  <TableHead className="text-right">MOIC</TableHead>
                  <TableHead className="text-right">IRR</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allocations.map((allocation) => {
                  // Only display MOIC if it exists in database
                  const moic = allocation.moic;

                  return (
                    <TableRow key={allocation.id} className="hover:bg-gray-50">
                      <TableCell>
                        <div>
                          <div className="font-medium">{allocation.fundName || `Fund ${allocation.fundId}`}</div>
                          <div className="text-sm text-gray-500">
                            {formatDisplayDate(allocation.allocationDate)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          className={`
                            ${allocation.status === "funded" ? "bg-emerald-100 text-emerald-800" : ""}
                            ${allocation.status === "committed" ? "bg-blue-100 text-blue-800" : ""}
                            ${allocation.status === "unfunded" ? "bg-amber-100 text-amber-800" : ""}
                            ${allocation.status === "partially_paid" ? "bg-purple-100 text-purple-800" : ""}
                          `}
                        >
                          {allocation.status === "partially_paid" 
                            ? "Partially Funded" 
                            : allocation.status.charAt(0).toUpperCase() + allocation.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        <div className="space-y-1">
                          <div>{formatCurrency(allocation.amount)}</div>
                          {allocation.status === "partially_paid" && (
                            <div className="text-xs text-gray-500">
                              Funded: {formatCurrency(400000)} (40%)
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <DollarSign className="h-3 w-3 text-green-600" />
                          {allocation.distributionPaid ? formatCurrency(allocation.distributionPaid) : 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <TrendingUp className="h-3 w-3 text-blue-600" />
                          {allocation.marketValue ? formatCurrency(allocation.marketValue) : 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        <div className="flex items-center justify-end gap-1">
                          <span className={moic >= 1 ? "text-green-600" : "text-red-600"}>
                            {moic.toFixed(2)}x
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Percent className="h-3 w-3 text-purple-600" />
                          <span className={allocation.irr && allocation.irr > 0 ? "text-green-600" : "text-gray-500"}>
                            {allocation.irr ? `${allocation.irr.toFixed(1)}%` : "0.0%"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditAllocation(allocation)}
                          className="h-8 w-8 p-0"
                          title="Edit investment metrics"
                        >
                          <FilePenLine className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Investment Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Investment Performance</DialogTitle>
            <DialogDescription>
              Update distributions, current value, and IRR for this investment
            </DialogDescription>
          </DialogHeader>
          
          {editingAllocation && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label htmlFor="edit-distributions" className="text-sm font-medium">
                  Distributions Received
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <Input 
                    id="edit-distributions"
                    type="number"
                    step="0.01"
                    className="pl-10"
                    value={editingAllocation.distributionPaid || 0}
                    onChange={(e) => setEditingAllocation({
                      ...editingAllocation, 
                      distributionPaid: parseFloat(e.target.value) || 0
                    })}
                    placeholder="0.00"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label htmlFor="edit-market-value" className="text-sm font-medium">
                  Current Market Value
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <Input 
                    id="edit-market-value"
                    type="number"
                    step="0.01"
                    className="pl-10"
                    value={editingAllocation.marketValue || 0}
                    onChange={(e) => setEditingAllocation({
                      ...editingAllocation, 
                      marketValue: parseFloat(e.target.value) || 0
                    })}
                    placeholder="0.00"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label htmlFor="edit-irr" className="text-sm font-medium">
                  IRR (%)
                </label>
                <Input 
                  id="edit-irr"
                  type="number"
                  step="0.1"
                  value={editingAllocation.irr || 0}
                  onChange={(e) => setEditingAllocation({
                    ...editingAllocation, 
                    irr: parseFloat(e.target.value) || 0
                  })}
                  placeholder="0.0"
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="edit-notes" className="text-sm font-medium">
                  Notes
                </label>
                <Textarea 
                  id="edit-notes" 
                  value={editingAllocation.notes || ""}
                  onChange={(e) => setEditingAllocation({
                    ...editingAllocation, 
                    notes: e.target.value
                  })}
                  placeholder="Investment performance notes..."
                  rows={3}
                />
              </div>
              
              {/* MOIC Preview */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm font-medium text-gray-700 mb-1">
                  Calculated MOIC
                </div>
                <div className="text-lg font-semibold">
                  {editingAllocation.amount > 0 
                    ? (((editingAllocation.distributionPaid || 0) + (editingAllocation.marketValue || 0)) / editingAllocation.amount).toFixed(2)
                    : "0.00"
                  }x
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveAllocation}
              disabled={updateAllocation.isPending}
            >
              {updateAllocation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}