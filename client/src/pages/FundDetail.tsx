import { useState, useMemo } from "react";
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
  CheckCircle,
  TrendingDown
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
import { 
  generateStatusBadgeProps,
  findStatusInconsistencies,
  getInconsistencySummary 
} from "@/lib/services/allocationStatusService";
import { 
  validateDataIntegration, 
  validateSectorDataCompleteness, 
  validateFinancialDataIntegrity 
} from '@/lib/services/dataIntegration';
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
  
  // Distributions management state
  const [isDistributionsDialogOpen, setIsDistributionsDialogOpen] = useState(false);
  const [currentAllocationId, setCurrentAllocationId] = useState<number | null>(null);
  
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
    queryKey: [`/api/production/allocations/fund/${fundId}`],
    enabled: !!fundId,
    // Transform the data to ensure proper type compatibility
    select: (data: any) => {
      console.log('Allocations API response:', data);
      // The API now returns allocations directly as an array
      if (Array.isArray(data)) {
        return data.map((allocation: any) => ({
          ...allocation,
          // Convert string amounts to numbers for proper validation
          amount: parseFloat(allocation.amount) || 0,
          paidAmount: allocation.paidAmount ? parseFloat(allocation.paidAmount) : null,
          marketValue: allocation.marketValue ? parseFloat(allocation.marketValue) : null,
          calledAmount: allocation.calledAmount ? parseFloat(allocation.calledAmount) : null,
          portfolioWeight: parseFloat(allocation.portfolioWeight) || 0,
          interestPaid: parseFloat(allocation.interestPaid) || 0,
          distributionPaid: parseFloat(allocation.distributionPaid) || 0,
          totalReturned: parseFloat(allocation.totalReturned) || 0,
          moic: parseFloat(allocation.moic) || 0,
          irr: parseFloat(allocation.irr) || 0,
          // Handle string fields properly
          notes: allocation.notes || null,
          status: allocation.status || "committed",
          dealName: allocation.dealName || undefined,
          dealSector: allocation.dealSector || undefined
        }));
      }
      return [];
    }
  });

  // Remove invalid allocations query - not needed with production service
  const invalidAllocations: FundAllocation[] = [];
  const isInvalidAllocationsLoading = false;
  const refetchInvalidAllocations = () => {};

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

  // Comprehensive Data Integration Validation
  const dataIntegrityReport = useMemo(() => {
    if (!allocations || !deals) return null;
    
    // Validate complete data integration
    const integrationReport = validateDataIntegration(allocations, deals);
    
    // Validate sector data completeness
    const sectorReport = validateSectorDataCompleteness(allocations);
    
    // Validate financial data integrity
    const financialReport = validateFinancialDataIntegrity(allocations);
    
    return {
      integration: integrationReport,
      sectors: sectorReport,
      financial: financialReport,
      overallValid: integrationReport.isValid && sectorReport.complete && financialReport.valid
    };
  }, [allocations, deals]);

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

      const res = await apiRequest("POST", "/api/production/allocations", newAllocationData);
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
      queryClient.invalidateQueries({ queryKey: [`/api/production/allocations/fund/${fundId}`] });
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
      
      const res = await apiRequest("PUT", `/api/production/allocations/${editingAllocation.id}`, editingAllocation);
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
      queryClient.invalidateQueries({ queryKey: [`/api/production/allocations/fund/${fundId}`] });
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
      
      const res = await apiRequest("DELETE", `/api/production/allocations/${editingAllocation.id}`);
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
      queryClient.invalidateQueries({ queryKey: [`/api/production/allocations/fund/${fundId}`] });
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
      return apiRequest("PATCH", `/api/production/allocations/${allocationId}`, {
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
      queryClient.invalidateQueries({ queryKey: [`/api/production/allocations/fund/${fundId}`] });
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

  // Distributions query for the selected allocation
  const { data: distributions, refetch: refetchDistributions } = useQuery({
    queryKey: [`/api/distributions/allocation/${currentAllocationId}`],
    enabled: !!currentAllocationId,
  });

  // Create distribution mutation
  const createDistribution = useMutation({
    mutationFn: async (distributionData: {
      allocationId: number;
      distributionDate: string;
      amount: number;
      distributionType: string;
      description?: string;
    }) => {
      return apiRequest("POST", `/api/distributions`, distributionData);
    },
    onSuccess: () => {
      toast({
        title: "Distribution added",
        description: "The distribution has been recorded successfully.",
      });
      refetchDistributions();
      queryClient.invalidateQueries({ queryKey: [`/api/production/allocations/fund/${fundId}`] });
    },
    onError: (error) => {
      toast({
        title: "Error adding distribution",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  // Delete distribution mutation
  const deleteDistribution = useMutation({
    mutationFn: async (distributionId: number) => {
      return apiRequest("DELETE", `/api/distributions/${distributionId}`);
    },
    onSuccess: () => {
      toast({
        title: "Distribution deleted",
        description: "The distribution has been removed successfully.",
      });
      refetchDistributions();
      queryClient.invalidateQueries({ queryKey: [`/api/production/allocations/fund/${fundId}`] });
    },
    onError: (error) => {
      toast({
        title: "Error deleting distribution",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  // Handler for opening distributions dialog
  const handleManageDistributions = (allocation: FundAllocation) => {
    setCurrentAllocationId(allocation.id);
    setIsDistributionsDialogOpen(true);
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
            {/* Data Integration Status Alert */}
            {dataIntegrityReport && !dataIntegrityReport.overallValid && (
              <div className="mb-6">
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-800">Data Integration Issues Detected</AlertTitle>
                  <AlertDescription className="text-amber-700">
                    <div className="mt-2 space-y-1">
                      <p className="font-medium">{dataIntegrityReport.integration.summary}</p>
                      {!dataIntegrityReport.sectors.complete && (
                        <p>• {dataIntegrityReport.sectors.missingSectorCount} allocations missing sector data</p>
                      )}
                      {!dataIntegrityReport.financial.valid && (
                        <div>
                          <p>• {dataIntegrityReport.financial.issues.length} financial data inconsistencies found:</p>
                          <div className="ml-4 mt-1 text-sm">
                            {dataIntegrityReport.financial.issues.slice(0, 3).map((issue, index) => (
                              <p key={index}>- Allocation {issue.allocationId}: {issue.issue}</p>
                            ))}
                            {dataIntegrityReport.financial.issues.length > 3 && (
                              <p>- ...and {dataIntegrityReport.financial.issues.length - 3} more issues</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              </div>
            )}

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
                      <p className="text-xs sm:text-sm text-neutral-600 mb-1">Data Integration</p>
                      <div className="flex items-center gap-2">
                        {dataIntegrityReport?.overallValid ? (
                          <>
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="text-base font-medium text-green-700">Complete</span>
                          </>
                        ) : dataIntegrityReport ? (
                          <>
                            <AlertCircle className="h-4 w-4 text-amber-600" />
                            <span className="text-base font-medium text-amber-700">Issues Found</span>
                          </>
                        ) : (
                          <span className="text-base font-medium text-gray-500">Checking...</span>
                        )}
                      </div>
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
                capitalView={capitalView}
              />
              
              {/* Called Capital Ratio */}
              <CalledCapitalRatio 
                allocations={allocations || []} 
                totalFundSize={fund?.aum || 0}
                calledCapital={fund?.calledCapital}
                uncalledCapital={fund?.uncalledCapital}
                capitalView={capitalView}
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
                          
                          // Calculate dynamic weight based on capital view with NaN protection
                          const weight = calculateDynamicWeight(allocation, allocations, capitalView);
                          const dynamicWeight = isNaN(weight) ? 0 : weight;
                          

                          
                          // Use modular status service for scalable status management
                          const statusBadgeProps = generateStatusBadgeProps(allocation);
                          
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
                                <div className="flex items-center gap-1">
                                  <Badge 
                                    className={`
                                      text-[9px] xs:text-xs sm:text-sm px-1.5 py-0.5
                                      ${statusBadgeProps.colorClass}
                                      ${statusBadgeProps.hasError ? "border-2 border-red-500" : ""}
                                    `}
                                    title={statusBadgeProps.errorTooltip}
                                  >
                                    {statusBadgeProps.label}
                                  </Badge>
                                  {statusBadgeProps.hasError && (
                                    <span className="text-red-500 text-xs" title="Status inconsistency detected">⚠️</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="py-1.5 sm:py-2.5 px-2 sm:px-4 text-right">
                                <span className={`text-2xs xs:text-xs sm:text-sm ${getCapitalViewColorClass(capitalView)}`}>
                                  {`${dynamicWeight.toFixed(1)}%`}
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
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => { e.stopPropagation(); handleManageDistributions(allocation); }}
                                    className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 p-0"
                                    title="Manage distributions"
                                  >
                                    <TrendingDown className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 text-blue-600" />
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
                                      <DropdownMenuItem 
                                        className="cursor-pointer flex items-center text-xs sm:text-sm text-blue-600"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleManageDistributions(allocation);
                                        }}
                                      >
                                        <TrendingDown className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-2" />
                                        Add Distributions
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
                          // Use modular capital calculation service for consistency
                          const fundMetrics = calculateFundCapitalMetrics(allocations);
                          const displayTotalAmount = getDisplayAmount(fundMetrics, capitalView);
                          
                          // Calculate other totals
                          const totalDistributions = allocations.reduce((sum, allocation) => sum + (allocation.distributionPaid || 0), 0);
                          const totalMarketValue = allocations.reduce((sum, allocation) => sum + (allocation.marketValue || 0), 0);
                          
                          // Calculate weighted average MOIC
                          const totalMoic = allocations.reduce((sum, allocation) => {
                            const moic = allocation.marketValue && allocation.amount 
                              ? allocation.marketValue / allocation.amount 
                              : 1;
                            return sum + (moic * (allocation.amount || 0));
                          }, 0);
                          const weightedAvgMoic = fundMetrics.committedAmount > 0 ? totalMoic / fundMetrics.committedAmount : 1;
                          
                          // Calculate weighted average IRR
                          const totalIrr = allocations.reduce((sum, allocation) => {
                            return sum + ((allocation.irr || 0) * (allocation.amount || 0));
                          }, 0);
                          const weightedAvgIrr = fundMetrics.committedAmount > 0 ? totalIrr / fundMetrics.committedAmount : 0;
                          
                          return (
                            <TableRow className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                              <TableCell className="py-3 px-2 sm:px-4 font-bold text-gray-800">TOTAL</TableCell>
                              <TableCell className="py-3 px-2 sm:px-4"></TableCell>
                              <TableCell className="py-3 px-2 sm:px-4"></TableCell>
                              <TableCell className="py-3 px-2 sm:px-4"></TableCell>
                              <TableCell className="py-3 px-2 sm:px-4 text-right font-bold text-gray-800">
                                100.0%
                              </TableCell>
                              <TableCell className="py-3 px-2 sm:px-4 text-right font-bold">
                                <span className="text-[#000000] font-bold">
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

            {/* Distributions Management Dialog */}
            <Dialog open={isDistributionsDialogOpen} onOpenChange={setIsDistributionsDialogOpen}>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Manage Distributions</DialogTitle>
                  <DialogDescription>
                    Add and track distributions for this allocation
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-6">
                  {/* Add New Distribution Form */}
                  <Card>
                    <CardHeader className="pb-4">
                      <CardTitle className="text-lg">Add New Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form 
                        onSubmit={(e) => {
                          e.preventDefault();
                          const formData = new FormData(e.target as HTMLFormElement);
                          if (!currentAllocationId) return;
                          
                          createDistribution.mutate({
                            allocationId: currentAllocationId,
                            distributionDate: formData.get('distributionDate') as string,
                            amount: parseFloat(formData.get('amount') as string),
                            distributionType: formData.get('distributionType') as string,
                            notes: formData.get('notes') as string || undefined,
                          });
                          
                          // Reset form
                          (e.target as HTMLFormElement).reset();
                        }}
                        className="space-y-4"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label htmlFor="distributionDate" className="text-sm font-medium">
                              Distribution Date *
                            </label>
                            <Input 
                              id="distributionDate"
                              name="distributionDate"
                              type="date"
                              required
                              defaultValue={format(new Date(), "yyyy-MM-dd")}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <label htmlFor="amount" className="text-sm font-medium">
                              Amount *
                            </label>
                            <div className="relative">
                              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-500" />
                              <Input 
                                id="amount"
                                name="amount"
                                type="number"
                                step="0.01"
                                required
                                className="pl-10"
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <label htmlFor="distributionType" className="text-sm font-medium">
                            Distribution Type *
                          </label>
                          <Select name="distributionType" defaultValue="dividend" required>
                            <SelectTrigger>
                              <SelectValue placeholder="Select distribution type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="dividend">Dividend</SelectItem>
                              <SelectItem value="capital_gain">Capital Gain</SelectItem>
                              <SelectItem value="return_of_capital">Return of Capital</SelectItem>
                              <SelectItem value="liquidation">Liquidation</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <label htmlFor="description" className="text-sm font-medium">
                            Description
                          </label>
                          <Textarea 
                            id="description"
                            name="description"
                            placeholder="Optional notes about this distribution"
                            rows={2}
                          />
                        </div>
                        
                        <Button 
                          type="submit" 
                          disabled={createDistribution.isPending}
                          className="w-full"
                        >
                          {createDistribution.isPending ? "Adding..." : "Add Distribution"}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>

                  {/* Existing Distributions List */}
                  <Card>
                    <CardHeader className="pb-4">
                      <CardTitle className="text-lg">Distribution History</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {distributions && Array.isArray(distributions) && distributions.length > 0 ? (
                        <div className="space-y-3">
                          {distributions.map((distribution: any) => (
                            <div 
                              key={distribution.id}
                              className="flex items-center justify-between p-3 border rounded-lg bg-gray-50"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-4">
                                  <div>
                                    <p className="font-medium">
                                      {formatCurrency(parseFloat(distribution.amount))}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      {format(new Date(distribution.distributionDate), "MMM dd, yyyy")}
                                    </p>
                                  </div>
                                  <div>
                                    <Badge variant="outline" className="text-xs">
                                      {distribution.distributionType.replace('_', ' ').toUpperCase()}
                                    </Badge>
                                  </div>
                                  {distribution.description && (
                                    <div className="flex-1">
                                      <p className="text-sm text-gray-600">
                                        {distribution.description}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteDistribution.mutate(distribution.id)}
                                disabled={deleteDistribution.isPending}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          
                          {/* Total Distributions */}
                          <div className="pt-3 border-t">
                            <div className="flex justify-between items-center font-semibold">
                              <span>Total Distributions:</span>
                              <span>
                                {formatCurrency(
                                  distributions.reduce((sum: number, d: any) => 
                                    sum + parseFloat(d.amount), 0
                                  )
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <TrendingDown className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                          <p>No distributions recorded yet</p>
                          <p className="text-sm">Add your first distribution above</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
                
                <DialogFooter>
                  <Button 
                    variant="outline"
                    onClick={() => setIsDistributionsDialogOpen(false)}
                  >
                    Close
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