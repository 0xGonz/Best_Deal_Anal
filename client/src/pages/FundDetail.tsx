import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import AppLayout from "@/components/layout/AppLayout";
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent,
  CardDescription 
} from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

import { 
  Table, 
  TableHeader, 
  TableRow, 
  TableHead, 
  TableBody, 
  TableCell 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
// Using HTML label directly instead of Label component to avoid FormContext issues
// import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  DollarSign, 
  TrendingUp, 
  ChevronLeft, 
  FilePenLine, 
  Trash2, 
  CreditCard,
  FileText,
  Calendar,
  AlertCircle,
  Eye,
  CheckCircle
} from "lucide-react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/services/formatters";
import FundSectorDistribution from "@/components/funds/FundSectorDistribution";
import CalledCapitalRatio from "@/components/funds/CalledCapitalRatio";
import ModularTable from "@/components/ui/ModularTable";
import { 
  calculateAllocationCapitalMetrics, 
  calculateFundCapitalMetrics, 
  getDisplayAmount, 
  getCapitalViewColorClass,
  calculateDynamicWeight 
} from "@/lib/services/capitalCalculations";
import { TABLE_CONFIGS } from "@/lib/services/tableConfig";
// Import local types instead of schema types to ensure consistency
import { Fund, FundAllocation, Deal } from "@/lib/types";

export default function FundDetail() {
  const [, params] = useRoute("/funds/:id");
  const fundId = params?.id ? parseInt(params.id) : null;
  const { toast } = useToast();

  // Dialog state
  const [isNewAllocationDialogOpen, setIsNewAllocationDialogOpen] = useState(false);
  const [isEditAllocationDialogOpen, setIsEditAllocationDialogOpen] = useState(false);
  const [isDeleteAllocationDialogOpen, setIsDeleteAllocationDialogOpen] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  
  // Define types for editing allocation with dealName added
  type EditingAllocation = FundAllocation & { dealName?: string };
  
  // State for allocation being edited
  const [editingAllocation, setEditingAllocation] = useState<EditingAllocation | null>(null);
  
  // State for capital metrics toggle
  const [capitalView, setCapitalView] = useState<'total' | 'called' | 'uncalled'>('total');
  
  // Type for new allocation form data
  interface NewAllocationData {
    fundId: number | null;
    dealId: number | null;
    amount: number;
    amountType?: "percentage" | "dollar";
    securityType: string;
    dealSector?: string;
    allocationDate: string;
    notes: string;
    status: "committed" | "funded" | "unfunded" | "partially_paid";
    portfolioWeight: number;
    interestPaid: number;
    distributionPaid: number;
    marketValue: number;
    moic: number;
    irr: number;
  }
  
  // Form state for new allocation
  const [newAllocationData, setNewAllocationData] = useState<NewAllocationData>({
    fundId: fundId,
    dealId: null,
    amount: 0,
    securityType: "", // Will be populated from the deal's sector
    allocationDate: format(new Date(), "yyyy-MM-dd"),
    notes: "",
    status: "committed",
    portfolioWeight: 0,
    interestPaid: 0,
    distributionPaid: 0,
    marketValue: 0,
    moic: 0,
    irr: 0
  });

  // Fetch fund details
  const { data: fund, isLoading: isFundLoading } = useQuery<Fund>({
    queryKey: [`/api/funds/${fundId}`],
    enabled: !!fundId,
  });

  // Fetch all allocations for this fund
  const { data: allocations, isLoading: isAllocationsLoading } = useQuery<FundAllocation[]>({
    queryKey: [`/api/allocations/fund/${fundId}`],
    enabled: !!fundId,
    // Transform the data to ensure proper type compatibility while preserving deal information
    select: (data) => (data || []).map(allocation => ({
      ...allocation,
      // Ensure all potential undefined values are converted to null
      notes: allocation.notes || null,
      status: allocation.status || "committed", // Default status if not provided
      portfolioWeight: allocation.portfolioWeight || 0,
      // Make sure the right property names are used
      totalReturned: allocation.totalReturned || 0,
      // Preserve deal information from API response
      dealName: allocation.dealName || undefined,
      dealSector: allocation.dealSector || undefined
    }))
  });

  // Fetch invalid allocations (ones with missing deals)
  const { data: invalidAllocations, isLoading: isInvalidAllocationsLoading, refetch: refetchInvalidAllocations } = useQuery<FundAllocation[]>({
    queryKey: [`/api/allocations/fund/${fundId}/invalid`],
    enabled: !!fundId,
    // Transform the data to ensure proper type compatibility while preserving deal information
    select: (data) => (data || []).map(allocation => ({
      ...allocation,
      // Ensure all potential undefined values are converted to null
      notes: allocation.notes || null,
      status: allocation.status || "committed", // Default status if not provided
      portfolioWeight: allocation.portfolioWeight || 0,
      // Make sure the right property names are used
      totalReturned: allocation.totalReturned || 0,
      // Preserve deal information from API response
      dealName: allocation.dealName || undefined,
      dealSector: allocation.dealSector || undefined
    }))
  });

  // Get invested deals only (for allocation creation and reference)
  const { data: deals } = useQuery({
    queryKey: ["/api/deals"],
    // Avoid null or undefined deals which could cause type errors
    select: (data: Deal[] | undefined) => (data || [])
      .filter(deal => deal.stage === 'invested') // Only show invested deals
      .map(deal => ({
        ...deal,
        // Ensure potentially undefined fields are set to null to match component expectations
        notes: deal.notes || null,
        description: deal.description || null,
        sector: deal.sector || null
      })) as Deal[]
  });

  // Create allocation mutation
  const createAllocation = useMutation({
    mutationFn: async () => {
      // Basic validation
      if (!newAllocationData.dealId) {
        throw new Error("Please select a deal.");
      }
      if (!newAllocationData.amount || newAllocationData.amount <= 0) {
        throw new Error("Please enter a valid amount.");
      }
      if (!newAllocationData.securityType) {
        throw new Error("Please select a security type.");
      }

      const res = await apiRequest("POST", "/api/allocations", newAllocationData);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Allocation created",
        description: "The allocation has been created successfully.",
      });
      // Reset the form and close the dialog
      setNewAllocationData({
        fundId: fundId,
        dealId: null,
        amount: 0,
        securityType: "",
        allocationDate: format(new Date(), "yyyy-MM-dd"),
        notes: "",
        status: "committed",
        portfolioWeight: 0,
        interestPaid: 0,
        distributionPaid: 0,
        marketValue: 0,
        moic: 0,
        irr: 0
      });
      setIsNewAllocationDialogOpen(false);
      // Invalidate allocations query to refresh the data
      queryClient.invalidateQueries({ queryKey: [`/api/allocations/fund/${fundId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/funds/${fundId}`] });
      refetchInvalidAllocations(); // Explicitly refetch invalid allocations
    },
    onError: (error) => {
      toast({
        title: "Error creating allocation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handler for creating a new allocation
  const handleCreateAllocation = () => {
    createAllocation.mutate();
  };

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
        title: "Allocation updated",
        description: "The allocation has been updated successfully.",
      });
      
      // Close the dialog and reset state
      setIsEditAllocationDialogOpen(false);
      setEditingAllocation(null);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: [`/api/allocations/fund/${fundId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/funds/${fundId}`] });
    },
    onError: (error) => {
      toast({
        title: "Error updating allocation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handler for opening edit dialog
  const handleEditAllocation = (allocation: FundAllocation) => {
    // Get the deal name for the editing dialog
    if (deals) {
      const deal = deals.find((d: Deal) => d.id === allocation.dealId);
      // Clone the allocation to avoid directly mutating the query data
      setEditingAllocation({
        ...allocation,
        dealName: deal?.name || 'Unknown Deal'
      });
      setIsEditAllocationDialogOpen(true);
    }
  };

  // Handler for saving edited allocation
  const handleSaveAllocation = () => {
    updateAllocation.mutate();
  };

  // Delete allocation mutation
  const deleteAllocation = useMutation({
    mutationFn: async () => {
      if (!editingAllocation) {
        throw new Error("No allocation selected for deletion.");
      }
      
      const res = await apiRequest("DELETE", `/api/allocations/${editingAllocation.id}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to delete allocation");
      }
      return true;
    },
    onSuccess: () => {
      toast({
        title: "Allocation deleted",
        description: "The allocation has been deleted successfully.",
      });
      
      // Close the dialog and reset state
      setIsDeleteAllocationDialogOpen(false);
      setEditingAllocation(null);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: [`/api/allocations/fund/${fundId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/funds/${fundId}`] });
    },
    onError: (error) => {
      toast({
        title: "Error deleting allocation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handler for confirming deletion
  const handleDeleteAllocation = () => {
    deleteAllocation.mutate();
  };
  
  // Handler for opening delete dialog
  const handleOpenDeleteDialog = (allocation: FundAllocation) => {
    // Get the deal name for the delete confirmation dialog
    if (deals) {
      const deal = deals.find((d: Deal) => d.id === allocation.dealId);
      // Clone the allocation to avoid directly mutating the query data
      setEditingAllocation({
        ...allocation,
        dealName: deal?.name || 'Unknown Deal'
      });
      setIsDeleteAllocationDialogOpen(true);
    }
  };
  
  // Mark allocation status mutation
  const updateAllocationStatusMutation = useMutation({
    mutationFn: async ({ allocationId, status }: { allocationId: number; status: "funded" | "unfunded" | "committed" | "partially_paid" }) => {
      return apiRequest("PATCH", `/api/allocations/${allocationId}`, {
        status
      });
    },
    onSuccess: (_, variables) => {
      // Create a mapping of status to display string
      const statusDisplayMap = {
        "funded": "funded",
        "unfunded": "unfunded", 
        "committed": "committed",
        "partially_paid": "partially paid"
      };
      
      // Get a user-friendly display version using the map
      const displayStatus = statusDisplayMap[variables.status] || variables.status;
        
      toast({
        title: `Allocation marked as ${displayStatus}`,
        description: "The allocation status has been updated successfully.",
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: [`/api/allocations/fund/${fundId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/funds/${fundId}`] });
    },
    onError: (error) => {
      toast({
        title: "Error updating allocation",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });
  
  // Handler for marking allocation as funded
  const handleMarkAsFunded = (allocation: FundAllocation) => {
    updateAllocationStatusMutation.mutate({ allocationId: allocation.id, status: "funded" });
  };
  
  // Handler for marking allocation as partially paid
  const handleMarkAsPartiallyPaid = (allocation: FundAllocation) => {
    updateAllocationStatusMutation.mutate({ allocationId: allocation.id, status: "partially_paid" });
  };
  
  // Handler for marking allocation as unfunded
  const handleMarkAsUnfunded = (allocation: FundAllocation) => {
    updateAllocationStatusMutation.mutate({ allocationId: allocation.id, status: "unfunded" });
  };

  // We don't need to warn about invalid allocations anymore
  // All data is dynamically loaded from API without hardcoded values
  
  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto pb-20 p-4 md:p-6">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="flex items-center">
            <Button variant="ghost" className="mr-2 sm:mr-3 h-9 w-9 sm:p-2 p-1.5" asChild>
              <a href="/funds">
                <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </a>
            </Button>
            <h1 className="text-xl sm:text-2xl font-semibold text-neutral-800 truncate">
              {isFundLoading ? "Loading..." : fund?.name}
            </h1>
          </div>
          
          <div className="flex gap-2">
            <Dialog open={isNewAllocationDialogOpen} onOpenChange={setIsNewAllocationDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary-dark text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  New Allocation
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Allocation</DialogTitle>
                  <DialogDescription>
                    Allocate capital from {fund?.name} to a deal
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label htmlFor="deal" className="text-sm font-medium">Investment (Deal) *</label>
                    <Select 
                      onValueChange={(value) => {
                        // Find the selected deal
                        const selectedDeal = deals?.find((d: Deal) => d.id === parseInt(value));
                        
                        // Update form with deal ID - keep security type as "equity", preserve deal's sector separately
                        setNewAllocationData({
                          ...newAllocationData, 
                          dealId: parseInt(value),
                          securityType: "equity", // Security type for investment classification
                          dealSector: selectedDeal?.sector || "" // Preserve deal's actual sector
                        });
                      }}
                    >
                      <SelectTrigger id="deal">
                        <SelectValue placeholder="Select a deal" />
                      </SelectTrigger>
                      <SelectContent>
                        {deals?.map((deal: Deal) => (
                          <SelectItem key={deal.id} value={deal.id.toString()}>
                            {deal.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="dealSector" className="text-sm font-medium">Sector (from Deal)</label>
                    <Input 
                      id="dealSector"
                      value={newAllocationData.dealSector || "Select a deal first"}
                      readOnly
                      className="bg-neutral-50 cursor-not-allowed"
                    />
                    <p className="text-xs text-neutral-500">Sector is automatically populated from the selected deal</p>
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="allocationDate" className="text-sm font-medium">Date *</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-500" />
                      <Input 
                        id="allocationDate"
                        type="date"
                        className="pl-10"
                        value={newAllocationData.allocationDate}
                        onChange={(e) => setNewAllocationData({
                          ...newAllocationData, 
                          allocationDate: e.target.value
                        })}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="status" className="text-sm font-medium">Status *</label>
                    <Select 
                      onValueChange={(value: "committed" | "funded" | "unfunded") => setNewAllocationData({
                        ...newAllocationData, 
                        status: value
                      })}
                      defaultValue="committed"
                    >
                      <SelectTrigger id="status">
                        <SelectValue placeholder="Select investment status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="committed">Committed</SelectItem>
                        <SelectItem value="funded">Funded</SelectItem>
                        <SelectItem value="partially_paid">Partially Paid</SelectItem>
                        <SelectItem value="unfunded">Unfunded</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="portfolioWeight" className="text-sm font-medium">Weight (%)</label>
                    <Input 
                      id="portfolioWeight"
                      type="number"
                      step="0.01"
                      value={newAllocationData.portfolioWeight || 0}
                      onChange={(e) => setNewAllocationData({
                        ...newAllocationData, 
                        portfolioWeight: parseFloat(e.target.value)
                      })}
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="amount" className="text-sm font-medium">Committed Amount *</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-500" />
                      <Input 
                        id="amount"
                        type="number"
                        className="pl-10"
                        value={newAllocationData.amount}
                        onChange={(e) => setNewAllocationData({
                          ...newAllocationData, 
                          amount: parseFloat(e.target.value)
                        })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="distributionPaid" className="text-sm font-medium">Distributions</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-500" />
                      <Input 
                        id="distributionPaid"
                        type="number"
                        className="pl-10"
                        value={newAllocationData.distributionPaid || 0}
                        onChange={(e) => setNewAllocationData({
                          ...newAllocationData, 
                          distributionPaid: parseFloat(e.target.value)
                        })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="marketValue" className="text-sm font-medium">Current Value</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-500" />
                      <Input 
                        id="marketValue"
                        type="number"
                        className="pl-10"
                        value={newAllocationData.marketValue || 0}
                        onChange={(e) => setNewAllocationData({
                          ...newAllocationData, 
                          marketValue: parseFloat(e.target.value)
                        })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="irr" className="text-sm font-medium">IRR (%)</label>
                    <Input 
                      id="irr"
                      type="number"
                      step="0.01"
                      value={newAllocationData.irr || 0}
                      onChange={(e) => setNewAllocationData({
                        ...newAllocationData, 
                        irr: parseFloat(e.target.value)
                      })}
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="notes" className="text-sm font-medium">Notes</label>
                    <Textarea 
                      id="notes" 
                      value={newAllocationData.notes}
                      onChange={(e) => setNewAllocationData({
                        ...newAllocationData, 
                        notes: e.target.value
                      })}
                      placeholder="Additional details about this allocation"
                    />
                  </div>
                </div>
                
                <DialogFooter>
                  <Button 
                    variant="outline"
                    onClick={() => setIsNewAllocationDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateAllocation}
                    disabled={createAllocation.isPending}
                  >
                    {createAllocation.isPending ? "Creating..." : "Create Allocation"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            {/* Edit Allocation Dialog */}
            <Dialog open={isEditAllocationDialogOpen} onOpenChange={setIsEditAllocationDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Allocation</DialogTitle>
                  <DialogDescription>
                    Update allocation details for {editingAllocation?.dealName || "this investment"}
                  </DialogDescription>
                </DialogHeader>
                
                {editingAllocation && (
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label htmlFor="edit-status" className="text-sm font-medium">Status</label>
                      <Select 
                        onValueChange={(value: "committed" | "funded" | "unfunded") => setEditingAllocation({
                          ...editingAllocation, 
                          status: value
                        })}
                        defaultValue={editingAllocation.status}
                      >
                        <SelectTrigger id="edit-status">
                          <SelectValue placeholder="Select investment status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="committed">Committed</SelectItem>
                          <SelectItem value="funded">Funded</SelectItem>
                          <SelectItem value="unfunded">Unfunded</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <label htmlFor="edit-amount" className="text-sm font-medium">Committed Amount</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <Input 
                          id="edit-amount"
                          type="number"
                          className="pl-10"
                          value={editingAllocation.amount}
                          onChange={(e) => setEditingAllocation({
                            ...editingAllocation, 
                            amount: parseFloat(e.target.value)
                          })}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label htmlFor="edit-distributionPaid" className="text-sm font-medium">Distributions</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <Input 
                          id="edit-distributionPaid"
                          type="number"
                          className="pl-10"
                          value={editingAllocation.distributionPaid || 0}
                          onChange={(e) => setEditingAllocation({
                            ...editingAllocation, 
                            distributionPaid: parseFloat(e.target.value)
                          })}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label htmlFor="edit-marketValue" className="text-sm font-medium">Current Value</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <Input 
                          id="edit-marketValue"
                          type="number"
                          className="pl-10"
                          value={editingAllocation.marketValue || 0}
                          onChange={(e) => setEditingAllocation({
                            ...editingAllocation, 
                            marketValue: parseFloat(e.target.value)
                          })}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label htmlFor="edit-irr" className="text-sm font-medium">IRR (%)</label>
                      <Input 
                        id="edit-irr"
                        type="number"
                        step="0.01"
                        value={editingAllocation.irr || 0}
                        onChange={(e) => setEditingAllocation({
                          ...editingAllocation, 
                          irr: parseFloat(e.target.value)
                        })}
                        placeholder="0.00"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label htmlFor="edit-notes" className="text-sm font-medium">Notes</label>
                      <Textarea 
                        id="edit-notes" 
                        value={editingAllocation.notes || ""}
                        onChange={(e) => setEditingAllocation({
                          ...editingAllocation, 
                          notes: e.target.value
                        })}
                        placeholder="Additional details about this allocation"
                      />
                    </div>
                  </div>
                )}
                
                <DialogFooter>
                  <Button 
                    variant="outline"
                    onClick={() => setIsEditAllocationDialogOpen(false)}
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

            {/* Report Dialog */}
            <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Report
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Generate Fund Report</DialogTitle>
                  <DialogDescription>
                    Create a report of this fund's performance metrics and investments
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Report Format</label>
                    <Select defaultValue="pdf">
                      <SelectTrigger>
                        <SelectValue placeholder="Select format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pdf">PDF Document</SelectItem>
                        <SelectItem value="excel">Excel Spreadsheet</SelectItem>
                        <SelectItem value="csv">CSV File</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Report Contents</label>
                    <div className="grid gap-2">
                      <div className="flex items-center space-x-2">
                        <input type="checkbox" id="includePerformance" defaultChecked className="rounded" />
                        <label htmlFor="includePerformance">Performance Metrics</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input type="checkbox" id="includeAllocations" defaultChecked className="rounded" />
                        <label htmlFor="includeAllocations">Investment Allocations</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input type="checkbox" id="includeSector" defaultChecked className="rounded" />
                        <label htmlFor="includeSector">Sector Distribution</label>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Date Range</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <Input type="date" className="pl-10" />
                      </div>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <Input type="date" className="pl-10" defaultValue={format(new Date(), "yyyy-MM-dd")} />
                      </div>
                    </div>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button 
                    variant="outline"
                    onClick={() => setIsReportDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      toast({
                        title: "Report Generated",
                        description: "Your report has been generated and is ready to download.",
                      });
                      setIsReportDialogOpen(false);
                    }}
                  >
                    Generate Report
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        
        {isFundLoading ? (
          <div className="text-center py-12">Loading fund details...</div>
        ) : (
          <>
            {/* Fund Overview & Key Metrics - Top Section */}
            <div className="mb-8">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Fund Overview</CardTitle>
                  {fund?.description && (
                    <CardDescription>{fund.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                    <div className="bg-primary/5 p-3 sm:p-4 rounded-lg">
                      <p className="text-xs sm:text-sm text-neutral-600 mb-1">Assets Under Management</p>
                      <p className="text-lg sm:text-xl font-semibold flex items-center">
                        {formatCurrency(fund?.aum)}
                        <TrendingUp className="ml-2 h-3 w-3 sm:h-4 sm:w-4 text-success" />
                      </p>
                    </div>
                    
                    <div className="bg-primary/5 p-3 sm:p-4 rounded-lg">
                      <p className="text-xs sm:text-sm text-neutral-600 mb-1">Vintage</p>
                      <p className="text-lg sm:text-xl font-semibold">
                        {fund?.vintage || "N/A"}
                      </p>
                    </div>
                    
                    <div className="bg-primary/5 p-3 sm:p-4 rounded-lg">
                      <p className="text-xs sm:text-sm text-neutral-600 mb-1">Total Investments</p>
                      <p className="text-lg sm:text-xl font-semibold">
                        {allocations?.length || 0}
                      </p>
                    </div>
                    
                    <div className="bg-primary/5 p-3 sm:p-4 rounded-lg">
                      <p className="text-xs sm:text-sm text-neutral-600 mb-1">Created Date</p>
                      <p className="text-base sm:text-lg font-medium">
                        {fund?.createdAt ? format(new Date(fund.createdAt), "PPP") : "Unknown"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Visualizations Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Sector Distribution */}
              <FundSectorDistribution 
                allocations={allocations || []} 
                deals={deals || []} 
              />
              
              {/* Called Capital Ratio */}
              <CalledCapitalRatio 
                allocations={allocations || []} 
                totalFundSize={fund?.aum || 0}
                calledCapital={fund?.calledCapital}
                uncalledCapital={fund?.uncalledCapital}
              />
            </div>
            
            {/* Actions Section removed - buttons moved to the top of the page */}
            
            {/* Investment Allocations Section */}
            <div className="mb-8">
              <Card>
                <CardHeader className="border-b">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>Investment Allocations</CardTitle>
                      <CardDescription>
                        All capital allocations made from this fund
                      </CardDescription>
                    </div>
                    
                    {/* Capital Metrics Toggle */}
                    <Tabs value={capitalView} onValueChange={(value) => setCapitalView(value as 'total' | 'called' | 'uncalled')}>
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="total" className="text-xs">Total Committed</TabsTrigger>
                        <TabsTrigger value="called" className="text-xs">Called Capital</TabsTrigger>
                        <TabsTrigger value="uncalled" className="text-xs">Uncalled Capital</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {isAllocationsLoading ? (
                    <div className="p-4 text-center text-gray-500">Loading allocations...</div>
                  ) : allocations?.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <p className="mb-2">No allocations have been made from this fund yet.</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setIsNewAllocationDialogOpen(true)}
                        className="mt-2"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Allocation
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-md border bg-white w-full overflow-hidden">
                      <div className="overflow-x-auto w-full scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-white border-b">
                              <TableHead className="font-semibold text-[10px] xs:text-xs sm:text-sm">Investment</TableHead>
                              <TableHead className="font-semibold text-[10px] xs:text-xs sm:text-sm">Sector</TableHead>
                              <TableHead className="font-semibold text-[10px] xs:text-xs sm:text-sm">Date</TableHead>
                              <TableHead className="font-semibold text-[10px] xs:text-xs sm:text-sm">Status</TableHead>
                              <TableHead className="font-semibold text-[10px] xs:text-xs sm:text-sm text-right">Weight</TableHead>
                              <TableHead className="font-semibold text-[10px] xs:text-xs sm:text-sm text-right">
                                {capitalView === 'total' && 'Committed'}
                                {capitalView === 'called' && 'Called'}
                                {capitalView === 'uncalled' && 'Remaining'}
                              </TableHead>
                              <TableHead className="font-semibold text-[10px] xs:text-xs sm:text-sm text-right">Distributions</TableHead>
                              <TableHead className="font-semibold text-[10px] xs:text-xs sm:text-sm text-right">Value</TableHead>
                              <TableHead className="font-semibold text-[10px] xs:text-xs sm:text-sm text-right">MOIC</TableHead>
                              <TableHead className="font-semibold text-[10px] xs:text-xs sm:text-sm text-right">IRR</TableHead>
                              <TableHead className="font-semibold text-[10px] xs:text-xs sm:text-sm text-center">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                        {allocations?.map(allocation => {
                          const deal = deals?.find((d: Deal) => d.id === allocation.dealId);
                          
                          // Use modular capital calculation service
                          const capitalMetrics = calculateAllocationCapitalMetrics(allocation);
                          const displayAmount = getDisplayAmount(capitalMetrics, capitalView);
                          
                          // Calculate MOIC
                          let moic = 0;
                          if (allocation.amount > 0) {
                            moic = (allocation.distributionPaid + (allocation.marketValue || 0)) / allocation.amount;
                          }
                          
                          return (
                            <TableRow 
                              key={allocation.id} 
                              className="group hover:bg-blue-50 hover:shadow-sm transition-all cursor-pointer"
                              onClick={() => window.location.href = `/deals/${allocation.dealId}`}
                            >
                              <TableCell className="py-1.5 sm:py-2.5 px-2 sm:px-4">
                                <div className="font-medium text-xs sm:text-sm md:text-base text-neutral-900 truncate group-hover:text-blue-700 transition-colors">
                                  {allocation.dealName || "Unknown Deal"}
                                </div>
                              </TableCell>
                              <TableCell className="py-1.5 sm:py-2.5 px-2 sm:px-4">
                                <span className="text-2xs xs:text-xs sm:text-sm">{allocation.dealSector || "N/A"}</span>
                              </TableCell>
                              <TableCell className="py-1.5 sm:py-2.5 px-2 sm:px-4">
                                <span className="text-2xs xs:text-xs sm:text-sm">
                                  {allocation.allocationDate 
                                    ? format(new Date(allocation.allocationDate), "MM/dd/yyyy")
                                    : "N/A"}
                                </span>
                              </TableCell>
                              <TableCell className="py-1 sm:py-2 px-2 sm:px-4">
                                {allocation.status && (
                                  <Badge 
                                    className={`
                                      text-[9px] xs:text-xs sm:text-sm px-1.5 py-0.5
                                      ${allocation.status === "funded" ? "bg-emerald-100 text-emerald-800" : ""}
                                      ${allocation.status === "committed" ? "bg-blue-100 text-blue-800" : ""}
                                      ${allocation.status === "unfunded" ? "bg-amber-100 text-amber-800" : ""}
                                      ${allocation.status === "partially_paid" ? "bg-purple-100 text-purple-800" : ""}
                                    `}
                                  >
                                    {allocation.status === "partially_paid" 
                                      ? "Partially Paid" 
                                      : allocation.status.charAt(0).toUpperCase() + allocation.status.slice(1)}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="py-1.5 sm:py-2.5 px-2 sm:px-4 text-right">
                                <span className={`text-2xs xs:text-xs sm:text-sm ${getCapitalViewColorClass(capitalView)}`}>
                                  {allocation.portfolioWeight ? `${allocation.portfolioWeight.toFixed(1)}%` : '0.0%'}
                                </span>
                              </TableCell>
                              <TableCell className="py-1.5 sm:py-2.5 px-2 sm:px-4 text-right">
                                <span className={`text-2xs xs:text-xs sm:text-sm ${getCapitalViewColorClass(capitalView)}`}>
                                  {formatCurrency(displayAmount)}
                                </span>
                              </TableCell>
                              <TableCell className="py-1.5 sm:py-2.5 px-2 sm:px-4 text-right">
                                <span className="text-2xs xs:text-xs sm:text-sm">
                                  {formatCurrency(allocation.distributionPaid || 0)}
                                </span>
                              </TableCell>
                              <TableCell className="py-1.5 sm:py-2.5 px-2 sm:px-4 text-right">
                                <span className="text-2xs xs:text-xs sm:text-sm">
                                  {formatCurrency(allocation.marketValue || 0)}
                                </span>
                              </TableCell>
                              <TableCell className="py-1.5 sm:py-2.5 px-2 sm:px-4 text-right">
                                <span className="text-2xs xs:text-xs sm:text-sm">
                                  {moic.toFixed(2)}x
                                </span>
                              </TableCell>
                              <TableCell className="py-1.5 sm:py-2.5 px-2 sm:px-4 text-right">
                                <span className="text-2xs xs:text-xs sm:text-sm">
                                  {allocation.irr ? `${allocation.irr.toFixed(2)}%` : "0.00%"}
                                </span>
                              </TableCell>
                              <TableCell className="py-1 sm:py-2 px-2 sm:px-4 text-center">
                                <div className="flex justify-center gap-1 md:gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => { e.stopPropagation(); handleEditAllocation(allocation); }}
                                    className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 p-0"
                                    title="Edit allocation"
                                  >
                                    <FilePenLine className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 text-neutral-600" />
                                  </Button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 p-0"
                                        title="Capital calls"
                                      >
                                        <CreditCard className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 text-neutral-600" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuLabel>Capital Calls</DropdownMenuLabel>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem asChild>
                                        <a href={`/capital-calls/allocation/${allocation.id}`} className="cursor-pointer flex items-center text-xs sm:text-sm" onClick={(e) => e.stopPropagation()}>
                                          <Eye className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-2" />
                                          View Capital Calls
                                        </a>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem asChild>
                                        <a href={`/deals/${allocation.dealId}?tab=capitalcalls&createFor=${allocation.id}`} className="cursor-pointer flex items-center text-xs sm:text-sm" onClick={(e) => e.stopPropagation()}>
                                          <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-2" />
                                          Create Capital Call
                                        </a>
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem 
                                        disabled={allocation.status === 'funded'}
                                        className={`text-xs sm:text-sm ${allocation.status === 'funded' ? "text-gray-400" : "text-green-600"}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          allocation.status !== 'funded' && handleMarkAsFunded(allocation);
                                        }}
                                      >
                                        <CheckCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-2" />
                                        {allocation.status === 'funded' ? 'Already Funded' : 'Mark as Funded'}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        disabled={allocation.status === 'partially_paid'}
                                        className={`text-xs sm:text-sm ${allocation.status === 'partially_paid' ? "text-gray-400" : "text-purple-600"}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          allocation.status !== 'partially_paid' && 
                                          handleMarkAsPartiallyPaid(allocation);
                                        }}
                                      >
                                        <CreditCard className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-2" />
                                        {allocation.status === 'partially_paid' ? 'Already Partially Paid' : 'Mark as Partially Paid'}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        disabled={allocation.status === 'unfunded'}
                                        className={`text-xs sm:text-sm ${allocation.status === 'unfunded' ? "text-gray-400" : "text-amber-600"}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          allocation.status !== 'unfunded' && handleMarkAsUnfunded(allocation);
                                        }}
                                      >
                                        <AlertCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-2" />
                                        {allocation.status === 'unfunded' ? 'Already Unfunded' : 'Mark as Unfunded'}
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                  <Button 
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => { e.stopPropagation(); handleOpenDeleteDialog(allocation); }}
                                    className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 p-0"
                                    title="Delete allocation"
                                  >
                                    <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 text-red-600" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                        
                        {/* Dynamic Total Row */}
                        {allocations && allocations.length > 0 && (() => {
                          // Calculate totals from actual allocation data
                          const totalWeight = allocations.reduce((sum, allocation) => sum + (allocation.portfolioWeight || 0), 0);
                          const totalCommitted = allocations.reduce((sum, allocation) => sum + (allocation.amount || 0), 0);
                          const totalPaid = allocations.reduce((sum, allocation) => sum + (allocation.paidAmount || 0), 0);
                          const totalCalled = allocations.reduce((sum, allocation) => {
                            // Calculate called amount based on status
                            if (allocation.status === 'funded') return sum + (allocation.amount || 0);
                            if (allocation.status === 'partially_paid') return sum + (allocation.paidAmount || 0);
                            return sum;
                          }, 0);
                          const totalUncalled = totalCommitted - totalCalled;
                          const totalDistributions = allocations.reduce((sum, allocation) => sum + (allocation.distributionPaid || 0), 0);
                          const totalMarketValue = allocations.reduce((sum, allocation) => sum + (allocation.marketValue || 0), 0);
                          
                          // Calculate display amount based on capital view
                          let displayTotalAmount = totalCommitted;
                          if (capitalView === 'called') displayTotalAmount = totalCalled;
                          if (capitalView === 'uncalled') displayTotalAmount = totalUncalled;
                          
                          // Calculate weighted average MOIC
                          const totalMoic = allocations.reduce((sum, allocation) => {
                            const moic = allocation.marketValue && allocation.amount 
                              ? allocation.marketValue / allocation.amount 
                              : 1;
                            return sum + (moic * (allocation.amount || 0));
                          }, 0);
                          const weightedAvgMoic = totalCommitted > 0 ? totalMoic / totalCommitted : 1;
                          
                          // Calculate weighted average IRR
                          const totalIrr = allocations.reduce((sum, allocation) => {
                            return sum + ((allocation.irr || 0) * (allocation.amount || 0));
                          }, 0);
                          const weightedAvgIrr = totalCommitted > 0 ? totalIrr / totalCommitted : 0;
                          
                          return (
                            <TableRow className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                              <TableCell className="py-3 px-2 sm:px-4 font-bold text-gray-800">TOTAL</TableCell>
                              <TableCell className="py-3 px-2 sm:px-4"></TableCell>
                              <TableCell className="py-3 px-2 sm:px-4"></TableCell>
                              <TableCell className="py-3 px-2 sm:px-4"></TableCell>
                              <TableCell className="py-3 px-2 sm:px-4 text-right font-bold text-gray-800">
                                {totalWeight.toFixed(1)}%
                              </TableCell>
                              <TableCell className="py-3 px-2 sm:px-4 text-right font-bold">
                                <span className={getCapitalViewColorClass(capitalView)}>
                                  {formatCurrency(displayTotalAmount)}
                                </span>
                              </TableCell>
                              <TableCell className="py-3 px-2 sm:px-4 text-right font-bold text-gray-800">
                                {formatCurrency(totalDistributions)}
                              </TableCell>
                              <TableCell className="py-3 px-2 sm:px-4 text-right font-bold text-gray-800">
                                {formatCurrency(totalMarketValue)}
                              </TableCell>
                              <TableCell className="py-3 px-2 sm:px-4 text-right font-bold text-gray-800">
                                {weightedAvgMoic.toFixed(2)}x
                              </TableCell>
                              <TableCell className="py-3 px-2 sm:px-4 text-right font-bold text-gray-800">
                                {weightedAvgIrr.toFixed(2)}%
                              </TableCell>
                              <TableCell className="py-3 px-2 sm:px-4"></TableCell>
                            </TableRow>
                          );
                        })()}
                      </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            
            {/* Fund Performance Metrics Section Removed - Redundant with Overview */}
            
            {/* Delete Allocation Confirmation Dialog */}
            <Dialog open={isDeleteAllocationDialogOpen} onOpenChange={setIsDeleteAllocationDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="text-red-600">Delete Allocation</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete this allocation? This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="py-4">
                  {editingAllocation && (
                    <div className="space-y-3">
                      <div className="p-3 bg-red-50 rounded-md border border-red-100">
                        <p className="text-sm font-medium">Allocation Details:</p>
                        <ul className="mt-2 text-sm space-y-1">
                          <li><span className="font-medium">Deal:</span> {editingAllocation.dealName}</li>
                          <li><span className="font-medium">Amount:</span> {formatCurrency(editingAllocation.amount)}</li>
                          <li><span className="font-medium">Status:</span> {editingAllocation.status}</li>
                          <li><span className="font-medium">Date:</span> {editingAllocation.allocationDate 
                            ? format(new Date(editingAllocation.allocationDate), "MM/dd/yyyy")
                            : "N/A"}</li>
                        </ul>
                      </div>
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Warning</AlertTitle>
                        <AlertDescription>
                          This will permanently delete this allocation record and remove the deal from this fund. 
                          Any associated capital calls will need to be managed separately.
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                </div>
                
                <DialogFooter>
                  <Button 
                    variant="outline"
                    onClick={() => setIsDeleteAllocationDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="destructive"
                    onClick={handleDeleteAllocation}
                  >
                    {deleteAllocation.isPending ? (
                      <>Deleting...</>
                    ) : (
                      <>Delete Allocation</>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    </AppLayout>
  );
}