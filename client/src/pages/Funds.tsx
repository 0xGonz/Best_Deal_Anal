import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import AppLayout from "@/components/layout/AppLayout";
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent, 
  CardFooter 
} from "@/components/ui/card";
import { 
  Table, 
  TableHeader, 
  TableRow, 
  TableHead, 
  TableBody, 
  TableCell 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { Plus, ArrowUpRight, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";
import { formatDistanceToNow, format } from "date-fns";
import { Fund } from "@/lib/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
// Import our new modular fund hooks
import { 
  useFunds, 
  useCreateFund, 
  useUpdateFund, 
  useDeleteFund,
  FundWithAllocations,
  CreateFundInput,
  UpdateFundInput
} from "@/hooks/api/useFunds";

export default function Funds() {
  const [isNewFundDialogOpen, setIsNewFundDialogOpen] = useState(false);
  const [isEditFundDialogOpen, setIsEditFundDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [currentFund, setCurrentFund] = useState<Fund | null>(null);
  const [newFundData, setNewFundData] = useState({
    name: "",
    vintage: new Date().getFullYear(),
    description: ""
  });
  const [editFundData, setEditFundData] = useState({
    name: "",
    vintage: new Date().getFullYear(),
    description: ""
  });
  
  const { toast } = useToast();
  const { canEdit, canDelete } = usePermissions();
  
  const { data: funds = [], isLoading } = useQuery<Fund[]>({
    queryKey: ['/api/funds'],
  });
  
  // Fetch all allocations
  const { data: allAllocations = [], isLoading: isAllocationsLoading } = useQuery({
    queryKey: ['/api/production/allocations'],
  });
  
  // Process allocations to get the most recent ones
  const recentAllocations = useMemo(() => {
    return (allAllocations as any[])
      .sort((a, b) => new Date(b.allocationDate).getTime() - new Date(a.allocationDate).getTime())
      .slice(0, 5); // Get the 5 most recent allocations
  }, [allAllocations]);
  
  // Update fund mutation
  const updateFundMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: Partial<Fund> }) => {
      const response = await apiRequest("PATCH", `/api/funds/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Fund updated successfully",
      });
      setIsEditFundDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update fund",
        variant: "destructive",
      });
      console.error("Update error:", error);
    },
  });
  
  // Delete fund mutation
  const deleteFundMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/funds/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Fund deleted successfully",
      });
      setIsDeleteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete fund. There might be allocations linked to this fund.",
        variant: "destructive",
      });
      console.error("Delete error:", error);
    },
  });

  const handleCreateFund = async () => {
    try {
      if (!newFundData.name) {
        toast({
          title: "Error",
          description: "Fund name is required",
          variant: "destructive"
        });
        return;
      }

      if (!newFundData.vintage || newFundData.vintage < 1980 || newFundData.vintage > new Date().getFullYear() + 1) {
        toast({
          title: "Error",
          description: "Please enter a valid vintage year",
          variant: "destructive"
        });
        return;
      }
      
      await apiRequest("POST", "/api/funds", newFundData);
      
      toast({
        title: "Success",
        description: "Fund created successfully",
      });
      
      // Reset form and close dialog
      setNewFundData({
        name: "",
        vintage: new Date().getFullYear(),
        description: ""
      });
      setIsNewFundDialogOpen(false);
      
      // Invalidate funds query to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/funds'] });
      
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create fund",
        variant: "destructive"
      });
    }
  };

  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto p-6 pb-20">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-neutral-800">Funds</h1>
          
          <Dialog open={isNewFundDialogOpen} onOpenChange={setIsNewFundDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-primary hover:bg-primary-dark text-white"
              >
                <Plus className="h-5 w-5 mr-2" />
                New Fund
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Fund</DialogTitle>
                <DialogDescription>
                  Add details for the new investment fund.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Fund Name *</Label>
                  <Input 
                    id="name" 
                    value={newFundData.name}
                    onChange={(e) => setNewFundData({...newFundData, name: e.target.value})}
                    placeholder="e.g. Doliver Fund IV"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea 
                    id="description" 
                    value={newFundData.description}
                    onChange={(e) => setNewFundData({...newFundData, description: e.target.value})}
                    placeholder="Fund description, strategy, etc."
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="vintage">Vintage Year *</Label>
                  <Input 
                    id="vintage"
                    type="number"
                    value={newFundData.vintage}
                    onChange={(e) => setNewFundData({...newFundData, vintage: parseInt(e.target.value)})}
                    placeholder="e.g. 2025"
                    min={1980}
                    max={new Date().getFullYear() + 1}
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsNewFundDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateFund}>
                  Create Fund
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        
        {/* Funds Overview */}
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
          {isLoading ? (
            <div className="col-span-full py-8 sm:py-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-sm sm:text-base text-neutral-500">Loading funds...</p>
            </div>
          ) : funds?.length === 0 ? (
            <div className="col-span-full py-8 sm:py-12 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto text-neutral-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm sm:text-base text-neutral-500">No funds created yet. Create your first fund with the "New Fund" button.</p>
            </div>
          ) : (
            funds?.map(fund => (
              <Link href={`/funds/${fund.id}`} className="block" key={fund.id}>
                <Card className="overflow-hidden hover:shadow-md transition-shadow duration-200 flex flex-col h-full cursor-pointer">
                  <CardHeader className="bg-primary/10 pb-2 sm:pb-3 flex justify-between items-start">
                    <CardTitle className="text-base sm:text-lg font-semibold truncate pr-2">{fund.name}</CardTitle>
                    {canEdit('fund') && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0" aria-label="Fund options">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setCurrentFund(fund);
                                setEditFundData({
                                  name: fund.name,
                                  vintage: fund.vintage || new Date().getFullYear(),
                                  description: fund.description || "",
                                });
                                setIsEditFundDialogOpen(true);
                              }}
                            >
                              <Pencil className="mr-2 h-4 w-4" /> Edit Fund
                            </DropdownMenuItem>
                            {canDelete('fund') && (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => {
                                  setCurrentFund(fund);
                                  setIsDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete Fund
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="pt-3 sm:pt-4 flex-grow">
                    <div className="flex flex-col mb-3 sm:mb-4 space-y-3">
                      <div>
                        <p className="text-xs sm:text-sm text-neutral-600 mb-0.5">Called Capital</p>
                        <p className="text-xl font-semibold flex items-center">
                          {formatCurrency(fund.aum)}
                        </p>
                      </div>
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-xs text-neutral-600 mb-0.5">Vintage</p>
                          <p className="text-lg font-medium">
                            {fund.vintage || "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-neutral-600 mb-0.5">Status</p>
                          <Badge variant="outline" className="font-normal">
                            {fund.vintage && fund.vintage >= new Date().getFullYear() ? "Active" : "Legacy"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    <div className="min-h-[2.5rem] mb-3 sm:mb-4">
                      {fund.description ? (
                        <p className="text-xs sm:text-sm text-neutral-600 line-clamp-2">{fund.description}</p>
                      ) : (
                        <p className="text-xs sm:text-sm text-neutral-400 italic">No description</p>
                      )}
                    </div>
                    
                    <div className="text-[10px] sm:text-xs text-neutral-500">
                      Created {formatDistanceToNow(new Date(fund.createdAt), { addSuffix: true })}
                    </div>
                  </CardContent>
                  <CardFooter className="bg-neutral-50 border-t p-2 sm:p-3 mt-auto">
                    <div className="ml-auto flex items-center text-xs sm:text-sm text-primary">
                      View Details
                      <ArrowUpRight className="ml-1 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </div>
                  </CardFooter>
                </Card>
              </Link>
            ))
          )}
        </div>
        
        {/* Recent Allocations */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Recent Fund Allocations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="rounded-md border bg-white w-full overflow-hidden">
              <div className="overflow-x-auto w-full scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b bg-neutral-50 hover:bg-neutral-100">
                      <TableHead className="py-2 px-2 sm:px-4 font-semibold text-2xs xs:text-xs sm:text-sm text-neutral-600">Deal</TableHead>
                      <TableHead className="py-2 px-2 sm:px-4 font-semibold text-2xs xs:text-xs sm:text-sm text-neutral-600">Fund</TableHead>
                      <TableHead className="py-2 px-2 sm:px-4 font-semibold text-2xs xs:text-xs sm:text-sm text-neutral-600 text-right">Amount</TableHead>
                      <TableHead className="py-2 px-2 sm:px-4 font-semibold text-2xs xs:text-xs sm:text-sm text-neutral-600 hidden sm:table-cell">Sector</TableHead>
                      <TableHead className="py-2 px-2 sm:px-4 font-semibold text-2xs xs:text-xs sm:text-sm text-neutral-600">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {isAllocationsLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 sm:py-12 text-neutral-500">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                        <p className="text-sm">Loading recent allocations...</p>
                      </TableCell>
                    </TableRow>
                  ) : recentAllocations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 sm:py-14 text-neutral-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-neutral-300 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <p className="text-sm font-medium">No recent allocations</p>
                          <p className="text-xs text-neutral-400">Any new allocations will appear here</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentAllocations.map((allocation) => (
                      <TableRow 
                        key={allocation.id} 
                        className="group hover:bg-blue-50 hover:shadow-sm transition-all cursor-pointer"
                        onClick={() => window.location.href = `/deals/${allocation.dealId}`}
                      >
                        <TableCell className="py-1.5 sm:py-2.5 px-2 sm:px-4">
                          <div className="font-medium text-xs sm:text-sm md:text-base text-neutral-900 truncate group-hover:text-blue-700 transition-colors">
                            {allocation.dealName}
                          </div>
                        </TableCell>
                        <TableCell className="py-1.5 sm:py-2.5 px-2 sm:px-4">
                          <span className="text-2xs xs:text-xs sm:text-sm" onClick={(e) => {
                            e.stopPropagation();
                            window.location.href = `/funds/${allocation.fundId}`;
                          }}>
                            {allocation.fundName}
                          </span>
                        </TableCell>
                        <TableCell className="py-1.5 sm:py-2.5 px-2 sm:px-4 text-right">
                          <span className="text-2xs xs:text-xs sm:text-sm">
                            {formatCurrency(allocation.amount)}
                          </span>
                        </TableCell>
                        <TableCell className="py-1.5 sm:py-2.5 px-2 sm:px-4 hidden sm:table-cell">
                          <span className="text-2xs xs:text-xs sm:text-sm">
                            {allocation.dealSector || "N/A"}
                          </span>
                        </TableCell>
                        <TableCell className="py-1.5 sm:py-2.5 px-2 sm:px-4">
                          <span className="text-2xs xs:text-xs sm:text-sm">
                            {format(new Date(allocation.allocationDate), "MMM d, yyyy")}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Edit Fund Dialog */}
        <Dialog open={isEditFundDialogOpen} onOpenChange={setIsEditFundDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Fund</DialogTitle>
              <DialogDescription>
                Update the details for this investment fund.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Fund Name *</Label>
                <Input 
                  id="edit-name" 
                  value={editFundData.name}
                  onChange={(e) => setEditFundData({...editFundData, name: e.target.value})}
                  placeholder="e.g. Doliver Fund IV"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea 
                  id="edit-description" 
                  value={editFundData.description}
                  onChange={(e) => setEditFundData({...editFundData, description: e.target.value})}
                  placeholder="Fund description, strategy, etc."
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-vintage">Vintage Year *</Label>
                <Input 
                  id="edit-vintage"
                  type="number"
                  value={editFundData.vintage}
                  onChange={(e) => setEditFundData({...editFundData, vintage: parseInt(e.target.value)})}
                  placeholder="e.g. 2025"
                  min={1980}
                  max={new Date().getFullYear() + 1}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditFundDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (currentFund) {
                    if (!editFundData.name) {
                      toast({
                        title: "Error",
                        description: "Fund name is required",
                        variant: "destructive"
                      });
                      return;
                    }
                    
                    if (!editFundData.vintage || editFundData.vintage < 1980 || editFundData.vintage > new Date().getFullYear() + 1) {
                      toast({
                        title: "Error",
                        description: "Please enter a valid vintage year",
                        variant: "destructive"
                      });
                      return;
                    }
                    
                    updateFundMutation.mutate({
                      id: currentFund.id,
                      data: editFundData
                    });
                  }
                }}
                disabled={updateFundMutation.isPending}
              >
                {updateFundMutation.isPending ? "Updating..." : "Update Fund"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Delete Fund Alert Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure you want to delete this fund?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the fund {currentFund?.name}. This action cannot be undone.
                <br />
                <span className="font-medium text-destructive">Warning:</span> If this fund has allocations, they will need to be reassigned before deletion.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => currentFund && deleteFundMutation.mutate(currentFund.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteFundMutation.isPending}
              >
                {deleteFundMutation.isPending ? "Deleting..." : "Delete Fund"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
