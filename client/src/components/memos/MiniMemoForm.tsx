import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User } from "@shared/schema";

export const DUE_DILIGENCE_CHECKLIST = {
  financialReview: 'Financial Review',
  legalReview: 'Legal Review',
  marketAnalysis: 'Market Analysis',
  teamAssessment: 'Team Assessment', 
  customerInterviews: 'Customer Interviews',
  competitorAnalysis: 'Competitor Analysis',
  technologyReview: 'Technology Review',
  businessModelValidation: 'Business Model Validation',
  regulatoryCompliance: 'Regulatory Compliance',
  esgAssessment: 'Background Check'
};

const miniMemoSchema = z.object({
  dealId: z.number().optional(),
  thesis: z.string().min(1, "Investment thesis is required"),
  risksAndMitigations: z.string().optional(),
  pricingConsideration: z.string().optional(),
  score: z.number().min(1).max(10),
  // New fields for enhanced evaluation
  marketRiskScore: z.number().min(1).max(10).optional(),
  executionRiskScore: z.number().min(1).max(10).optional(),
  teamStrengthScore: z.number().min(1).max(10).optional(),
  productFitScore: z.number().min(1).max(10).optional(),
  valuationScore: z.number().min(1).max(10).optional(),
  competitiveAdvantageScore: z.number().min(1).max(10).optional(),
  dueDiligenceChecklist: z.record(z.boolean()).optional(),
  // GP-LP Alignment tracking
  raiseAmount: z.number().positive().optional(),
  gpCommitment: z.number().positive().optional(),
  gpAlignmentPercentage: z.number().min(0).max(100).optional(),
  alignmentScore: z.number().min(1).max(10).optional(),
});

type MiniMemoFormValues = z.infer<typeof miniMemoSchema>;

interface MiniMemoFormProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  dealId?: number;
  // Button customization
  buttonLabel?: string;
  buttonVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  buttonSize?: "default" | "sm" | "lg" | "icon";
  buttonIcon?: React.ReactNode;
  className?: string;
  // Callback after submission
  onSubmit?: () => void;
  // For editing mode
  initialData?: any;
  isEdit?: boolean;
}

export function MiniMemoForm({ 
  isOpen, 
  onOpenChange, 
  dealId,
  buttonLabel = "Create Mini-Memo",
  buttonVariant = "default",
  buttonSize = "default",
  buttonIcon,
  className,
  onSubmit: onSubmitCallback,
  initialData,
  isEdit = false
}: MiniMemoFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [selectedDealId, setSelectedDealId] = useState<number | null>(dealId || null);
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  // Get current user
  const { data: user } = useAuth();
  const [activeTab, setActiveTab] = useState("thesis");
  
  // Fetch all users for team member selection
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: isOpen
  });

  // Fetch deals if no dealId is provided
  useEffect(() => {
    if (!dealId && isOpen) {
      setLoading(true);
      fetch('/api/deals')
        .then(res => res.json())
        .then(data => {
          setDeals(data);
          setLoading(false);
        })
        .catch(err => {
          console.error("Failed to fetch deals", err);
          setLoading(false);
        });
    }
  }, [dealId, isOpen]);
  
  // Initialize due diligence checklist
  const initialChecklist: Record<string, boolean> = {};
  Object.keys(DUE_DILIGENCE_CHECKLIST).forEach(key => {
    initialChecklist[key] = false;
  });

  // Set initial form values, either from initialData in edit mode or default values in create mode
  const defaultValues = isEdit && initialData ? {
    dealId: dealId || initialData.dealId,
    thesis: initialData.thesis || "",
    risksAndMitigations: initialData.risksAndMitigations || "",
    pricingConsideration: initialData.pricingConsideration || "",
    score: initialData.score || 5,
    marketRiskScore: initialData.marketRiskScore || 5,
    executionRiskScore: initialData.executionRiskScore || 5,
    teamStrengthScore: initialData.teamStrengthScore || 5,
    productFitScore: initialData.productFitScore || 5,
    valuationScore: initialData.valuationScore || 5,
    competitiveAdvantageScore: initialData.competitiveAdvantageScore || 5,
    dueDiligenceChecklist: initialData.dueDiligenceChecklist || initialChecklist,
    // GP-LP Alignment fields
    raiseAmount: initialData.raiseAmount,
    gpCommitment: initialData.gpCommitment,
    gpAlignmentPercentage: initialData.gpAlignmentPercentage,
    alignmentScore: initialData.alignmentScore,
  } : {
    dealId: dealId,
    thesis: "",
    risksAndMitigations: "",
    pricingConsideration: "",
    score: 5,
    marketRiskScore: 5 as number,
    executionRiskScore: 5 as number,
    teamStrengthScore: 5 as number,
    productFitScore: 5 as number,
    valuationScore: 5 as number,
    competitiveAdvantageScore: 5 as number,
    dueDiligenceChecklist: initialChecklist,
    // GP-LP Alignment fields
    raiseAmount: undefined,
    gpCommitment: undefined,
    gpAlignmentPercentage: undefined,
    alignmentScore: undefined,
  };

  // Initialize userId state if we're in edit mode
  useEffect(() => {
    if (isEdit && initialData && initialData.userId) {
      setSelectedUserId(initialData.userId);
    }
  }, [isEdit, initialData]);

  const form = useForm<MiniMemoFormValues>({
    resolver: zodResolver(miniMemoSchema),
    defaultValues,
  });

  const onSubmit = async (values: MiniMemoFormValues) => {
    try {
      const finalDealId = values.dealId || selectedDealId;
      if (!finalDealId) {
        toast({
          title: "Error",
          description: "Please select a deal",
          variant: "destructive"
        });
        return;
      }

      // Find selected team member
      const finalUserId = selectedUserId || user?.id;
      
      // Create payload with all structured fields
      const memoData = {
        // Basic fields
        thesis: values.thesis,
        risksAndMitigations: values.risksAndMitigations || null,
        pricingConsideration: values.pricingConsideration || null,
        score: values.score,
        
        // Assessment fields directly using schema fields
        marketRiskScore: values.marketRiskScore,
        executionRiskScore: values.executionRiskScore,
        teamStrengthScore: values.teamStrengthScore,
        productFitScore: values.productFitScore,
        valuationScore: values.valuationScore,
        competitiveAdvantageScore: values.competitiveAdvantageScore,
        dueDiligenceChecklist: values.dueDiligenceChecklist,
        
        // GP-LP Alignment fields - convert numbers to strings for database
        raiseAmount: values.raiseAmount ? values.raiseAmount.toString() : null,
        gpCommitment: values.gpCommitment ? values.gpCommitment.toString() : null,
        gpAlignmentPercentage: values.gpAlignmentPercentage,
        alignmentScore: values.alignmentScore,
        
        // User details - for edit mode, we'll use the original user ID
        userId: finalUserId
      };
      
      let response;
      
      if (isEdit && initialData?.id) {
        // If we're in edit mode, update the existing memo
        response = await apiRequest('PATCH', `/api/deals/${finalDealId}/memos/${initialData.id}`, memoData);
      } else {
        // Otherwise create a new memo
        response = await apiRequest('POST', `/api/deals/${finalDealId}/memos`, memoData);
      }

      // Invalidate deal queries to refresh data
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${finalDealId}`] });
      
      // Get the selected team member's name
      const selectedTeamMember = users.find(u => u.id === finalUserId) || user;
      const submitterName = selectedTeamMember?.fullName || selectedTeamMember?.username || 'selected team member';
      
      // Show success message
      toast({
        title: "Success",
        description: isEdit 
          ? `Mini memo has been updated by ${submitterName}`
          : `Mini memo has been created by ${submitterName}`,
      });

      // Close form and redirect if needed
      setDialogOpen(false);
      if (onOpenChange) {
        onOpenChange(false);
      }
      if (onSubmitCallback) {
        onSubmitCallback();
      }
      if (!dealId && finalDealId && !isEdit) {
        navigate(`/deals/${finalDealId}?tab=memos`);
      }
    } catch (error) {
      console.error(`Failed to ${isEdit ? 'update' : 'create'} mini memo`, error);
      toast({
        title: "Error",
        description: `Failed to ${isEdit ? 'update' : 'create'} mini memo. ${isEdit ? 'You can only edit memos you created.' : ''}`,
        variant: "destructive"
      });
    }
  };

  // Handle the case where we only want to show a button that triggers the dialog
  const [dialogOpen, setDialogOpen] = useState(isOpen || false);
  
  // If Dialog open state changes externally, update our internal state
  useEffect(() => {
    if (isOpen !== undefined) {
      setDialogOpen(isOpen);
    }
  }, [isOpen]);
  
  // Handle dialog close (triggered internally)
  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open && onOpenChange) {
      onOpenChange(false);
    }
  };

  // Render just the button if we're in button mode
  if (!isOpen && !dialogOpen) {
    return (
      <Button
        onClick={() => setDialogOpen(true)}
        variant={buttonVariant}
        size={buttonSize}
        className={className}
      >
        {buttonIcon}{buttonLabel}
      </Button>
    );
  }
  
  return (
    <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-[725px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit' : 'Create'} Collaborative Mini-Memo</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update' : 'Share'} your investment thesis and detailed evaluation.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {!dealId && (
              <FormField
                control={form.control}
                name="dealId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Deal</FormLabel>
                    <FormControl>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        onChange={(e) => {
                          const id = parseInt(e.target.value, 10);
                          setSelectedDealId(id);
                          field.onChange(id);
                        }}
                        value={field.value || ""}
                        disabled={loading}
                      >
                        <option value="">Select a deal...</option>
                        {deals.map((deal) => (
                          <option key={deal.id} value={deal.id}>
                            {deal.name}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Team member selector */}
            <div className="flex items-center gap-4 bg-neutral-50 p-3 rounded-md">
              <div className="flex-1">
                <FormLabel className="block mb-2">Submitting As Team Member</FormLabel>
                <Select value={selectedUserId?.toString() || (user?.id?.toString() || "")} onValueChange={(value) => setSelectedUserId(Number(value))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select team member" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((teamMember) => (
                      <SelectItem key={teamMember.id} value={teamMember.id.toString()}>
                        {teamMember.fullName || teamMember.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-xs text-muted-foreground mt-1">
                  This memo will be attributed to the selected team member
                </div>
              </div>
              <div className="flex-shrink-0">
                <Avatar className="h-12 w-12 border-2 border-primary-100">
                  <AvatarFallback className="bg-primary-100 text-primary-800">
                    {(() => {
                      const selectedMember = selectedUserId ? users.find(u => u.id === selectedUserId) : user;
                      return selectedMember?.fullName 
                        ? selectedMember.fullName.substring(0, 2).toUpperCase() 
                        : (selectedMember?.username 
                          ? selectedMember.username.substring(0, 2).toUpperCase() 
                          : "U");
                    })()}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>

            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid grid-cols-4 w-full mb-2">
                <TabsTrigger value="thesis">Thesis & Detail</TabsTrigger>
                <TabsTrigger value="assessment">Assessment</TabsTrigger>
                <TabsTrigger value="alignment">Alignment</TabsTrigger>
                <TabsTrigger value="diligence">Due Diligence</TabsTrigger>
              </TabsList>

              <TabsContent value="thesis" className="space-y-4">
                <FormField
                  control={form.control}
                  name="thesis"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Investment Thesis *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Outline your investment thesis for this deal"
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="risksAndMitigations"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Risks & Mitigations</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe key risks and potential mitigations"
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pricingConsideration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pricing Considerations</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Discuss pricing and valuation considerations"
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="assessment" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="marketRiskScore"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Market Risk: {field.value || 5}</FormLabel>
                        <FormDescription className="text-xs">Lower score = higher risk</FormDescription>
                        <FormControl>
                          <Slider
                            min={1}
                            max={10}
                            step={1}
                            defaultValue={[5]}
                            onValueChange={(vals) => field.onChange(vals[0])}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="executionRiskScore"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Execution Risk: {field.value || 5}</FormLabel>
                        <FormDescription className="text-xs">Lower score = higher risk</FormDescription>
                        <FormControl>
                          <Slider
                            min={1}
                            max={10}
                            step={1}
                            defaultValue={[5]}
                            onValueChange={(vals) => field.onChange(vals[0])}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="teamStrengthScore"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Team Strength: {field.value || 5}</FormLabel>
                        <FormDescription className="text-xs">Higher score = stronger team</FormDescription>
                        <FormControl>
                          <Slider
                            min={1}
                            max={10}
                            step={1}
                            defaultValue={[5]}
                            onValueChange={(vals) => field.onChange(vals[0])}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="productFitScore"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product Market Fit: {field.value || 5}</FormLabel>
                        <FormDescription className="text-xs">Higher score = better fit</FormDescription>
                        <FormControl>
                          <Slider
                            min={1}
                            max={10}
                            step={1}
                            defaultValue={[5]}
                            onValueChange={(vals) => field.onChange(vals[0])}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="valuationScore"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valuation: {field.value || 5}</FormLabel>
                        <FormDescription className="text-xs">Higher score = more attractive valuation</FormDescription>
                        <FormControl>
                          <Slider
                            min={1}
                            max={10}
                            step={1}
                            defaultValue={[5]}
                            onValueChange={(vals) => field.onChange(vals[0])}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="competitiveAdvantageScore"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Competitive Advantage: {field.value || 5}</FormLabel>
                        <FormDescription className="text-xs">Higher score = stronger advantage</FormDescription>
                        <FormControl>
                          <Slider
                            min={1}
                            max={10}
                            step={1}
                            defaultValue={[5]}
                            onValueChange={(vals) => field.onChange(vals[0])}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="score"
                  render={({ field }) => (
                    <FormItem className="pt-4 border-t border-gray-200">
                      <FormLabel className="text-base font-medium">Overall Score: {field.value}</FormLabel>
                      <FormDescription>Your overall assessment of the investment opportunity</FormDescription>
                      <FormControl>
                        <Slider
                          min={1}
                          max={10}
                          step={1}
                          defaultValue={[5]}
                          onValueChange={(vals) => field.onChange(vals[0])}
                          className="mt-2"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="alignment" className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg border">
                  <h3 className="font-medium text-blue-900 mb-2">GP-LP Alignment Tracking</h3>
                  <p className="text-sm text-blue-700 mb-4">
                    Track the General Partner's financial commitment relative to the total raise to assess alignment with Limited Partners.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="raiseAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Raise Amount ($)</FormLabel>
                        <FormDescription className="text-xs">The total fundraising target</FormDescription>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="e.g., 50000000"
                            {...field}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || 0;
                              field.onChange(value);
                              // Auto-calculate alignment percentage
                              const gpCommitment = form.getValues('gpCommitment') || 0;
                              if (value > 0 && gpCommitment > 0) {
                                const percentage = (gpCommitment / value) * 100;
                                const alignmentScore = Math.min(Math.max(Math.round(percentage / 10), 1), 10);
                                form.setValue('gpAlignmentPercentage', percentage);
                                form.setValue('alignmentScore', alignmentScore);
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="gpCommitment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>GP Commitment ($)</FormLabel>
                        <FormDescription className="text-xs">General Partner's financial commitment</FormDescription>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="e.g., 2500000"
                            {...field}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || 0;
                              field.onChange(value);
                              // Auto-calculate alignment percentage
                              const raiseAmount = form.getValues('raiseAmount') || 0;
                              if (value > 0 && raiseAmount > 0) {
                                const percentage = (value / raiseAmount) * 100;
                                const alignmentScore = Math.min(Math.max(Math.round(percentage / 10), 1), 10);
                                form.setValue('gpAlignmentPercentage', percentage);
                                form.setValue('alignmentScore', alignmentScore);
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="gpAlignmentPercentage"
                  render={({ field }) => (
                    <FormItem className="pt-4">
                      <FormLabel className="text-base font-medium">
                        Alignment Percentage: {field.value ? `${field.value.toFixed(2)}%` : '0%'}
                      </FormLabel>
                      <FormDescription>
                        Interactive slider to set GP alignment (0-100%). Auto-calculated based on amounts above.
                      </FormDescription>
                      <FormControl>
                        <Slider
                          min={0}
                          max={100}
                          step={0.5}
                          value={[field.value || 0]}
                          onValueChange={(vals) => {
                            const percentage = vals[0];
                            field.onChange(percentage);
                            // Calculate alignment score from percentage
                            const alignmentScore = Math.min(Math.max(Math.round(percentage / 10), 1), 10);
                            form.setValue('alignmentScore', alignmentScore);
                          }}
                          className="mt-2"
                        />
                      </FormControl>
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>0%</span>
                        <span>25%</span>
                        <span>50%</span>
                        <span>75%</span>
                        <span>100%</span>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="alignmentScore"
                  render={({ field }) => (
                    <FormItem className="pt-4 border-t border-gray-200">
                      <FormLabel className="text-base font-medium">Alignment Score: {field.value || 1}</FormLabel>
                      <FormDescription>
                        1-10 score derived from alignment percentage (auto-calculated)
                      </FormDescription>
                      <FormControl>
                        <div className="mt-2 p-3 bg-gray-50 rounded-md">
                          <div className="text-sm font-medium text-gray-700">
                            Alignment Level: {
                              (field.value || 0) >= 8 ? 'Excellent' :
                              (field.value || 0) >= 6 ? 'Good' :
                              (field.value || 0) >= 4 ? 'Moderate' :
                              (field.value || 0) >= 2 ? 'Low' : 'Very Low'
                            }
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            Score: {field.value || 1}/10
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="diligence" className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-base font-medium">Due Diligence Checklist</Label>
                  <p className="text-xs text-gray-500 mb-3">Check items that have been completed</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(DUE_DILIGENCE_CHECKLIST).map(([key, label]) => (
                      <div key={key} className="flex items-center space-x-2">
                        <Checkbox 
                          id={key} 
                          checked={form.watch(`dueDiligenceChecklist.${key}`)} 
                          onCheckedChange={(checked) => {
                            form.setValue(`dueDiligenceChecklist.${key}`, checked as boolean);
                          }}
                        />
                        <Label htmlFor={key} className="text-sm font-normal">{label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => onOpenChange ? onOpenChange(false) : null}>
                Cancel
              </Button>
              <Button type="submit">
                {(() => {
                  const teamMember = selectedUserId 
                    ? users.find(u => u.id === selectedUserId) 
                    : user;
                  
                  const action = isEdit ? 'Update' : 'Create';
                  
                  return teamMember 
                    ? `${action} as ${teamMember.fullName || teamMember.username}` 
                    : `${action} Mini-Memo`;
                })()}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
