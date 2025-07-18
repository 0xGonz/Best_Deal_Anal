import React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { generateDealNotification } from "@/lib/utils/notification-utils";
import { DEAL_SECTORS } from "@/lib/constants/sectors";
import { DEAL_STAGES, DealStage, DealStageLabels } from "@/lib/constants/deal-stages";
import { COMPANY_STAGES, CompanyStage } from "@/lib/constants/company-stages";

// Form schema with validation rules
const dealFormSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  description: z.string().min(1, "Description is required"),
  sector: z.string().optional().default(""),  // Make sector optional for edits
  contactEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
  notes: z.string().optional(),
  targetReturn: z.string().optional().or(z.literal("")),
  // Removed projectedIrr - using targetReturn instead
  projectedMultiple: z.string().optional().or(z.literal("")),
  stage: z.enum(DEAL_STAGES),
  companyStage: z.enum(Object.keys(COMPANY_STAGES) as [string, ...string[]]).optional(),
  rejectionReason: z.string().optional(),
  tags: z.array(z.string()).optional()
});

type DealFormValues = z.infer<typeof dealFormSchema>;

interface EditDealModalProps {
  isOpen: boolean;
  onClose: () => void;
  dealId: number;
}

export default function EditDealModal({ isOpen, onClose, dealId }: EditDealModalProps) {
  const { toast } = useToast();

  // Fetch the deal data
  const { data: deal, isLoading } = useQuery<any>({
    queryKey: [`/api/deals/${dealId}`],
    enabled: isOpen && dealId > 0,
  });

  // Initialize form with default values
  const form = useForm<DealFormValues>({
    resolver: zodResolver(dealFormSchema),
    defaultValues: {
      name: "",
      description: "",
      sector: "",
      contactEmail: "",
      notes: "",
      targetReturn: "",
      projectedMultiple: "",
      stage: "initial_review",
      companyStage: undefined,
      tags: []
    },
    values: deal ? {
      name: deal.name,
      description: deal.description,
      sector: deal.sector || "",
      contactEmail: deal.contactEmail || "",
      notes: deal.notes || "",
      targetReturn: deal.targetReturn || "",
      projectedMultiple: deal.projectedMultiple || "",
      stage: deal.stage,
      companyStage: deal.companyStage as CompanyStage | undefined,
      tags: deal.tags || []
    } : undefined
  });

  // Reset form values when deal data changes
  React.useEffect(() => {
    if (deal) {
      form.reset({
        name: deal.name,
        description: deal.description,
        sector: deal.sector || "",
        contactEmail: deal.contactEmail || "",
        notes: deal.notes || "",
        targetReturn: deal.targetReturn || "",
        projectedMultiple: deal.projectedMultiple || "",
        stage: deal.stage,
        tags: deal.tags || []
      });
    }
  }, [deal, form]);

  const updateDealMutation = useMutation({
    mutationFn: async (values: DealFormValues) => {
      return apiRequest("PATCH", `/api/deals/${dealId}`, values);
    },
    onSuccess: async (data: any) => {
      // Show success toast
      toast({
        title: "Deal updated",
        description: "Deal has been successfully updated."
      });
      
      // Create notification for deal update
      try {
        // Check if stage was changed
        const stageChanged = deal?.stage !== form.getValues().stage;
        
        // Generate notification for all users (using admin user ID 1 for now)
        if (stageChanged) {
          // Pass the new stage to the notification function
          await generateDealNotification(1, data.name, 'moved', dealId, form.getValues().stage);
        } else {
          await generateDealNotification(1, data.name, 'updated', dealId);
        }
        
        // Refresh notifications in the UI
        queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
        queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
      } catch (err) {
        console.error('Failed to create notification:', err);
      }
      
      // Refresh deals data
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      
      // Close modal
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update deal. Please try again.",
        variant: "destructive"
      });
    }
  });

  const isSubmitting = updateDealMutation.isPending;
  
  const onSubmit = (values: DealFormValues) => {
    updateDealMutation.mutate(values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>Edit Deal</DialogTitle>
          <DialogDescription>
            Update the details for this investment opportunity.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter company name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sector"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sector *</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select sector" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[300px]">
                          {DEAL_SECTORS.map((sector) => (
                            <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description *</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Brief description of company" 
                        rows={3} 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />



              <FormField
                control={form.control}
                name="contactEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Email</FormLabel>
                    <FormControl>
                      <Input 
                        type="email" 
                        placeholder="contact@company.com" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="targetReturn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Return (%)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., 20" 
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="projectedMultiple"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Projected Multiple (x)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., 2.5" 
                          {...field} 
                        />
                      </FormControl>
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
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Any additional notes" 
                        rows={2} 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="stage"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel>Deal Stage</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={(value) => {
                          field.onChange(value);
                          // If moving away from rejected, clear rejection reason
                          if (value !== "rejected" && form.getValues().rejectionReason) {
                            form.setValue("rejectionReason", "");
                          }
                        }}
                        defaultValue={field.value}
                        value={field.value}
                        className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4"
                      >
                        {Object.entries(DealStageLabels).map(([value, label]) => (
                          <div key={value} className="flex items-center space-x-2">
                            <RadioGroupItem value={value} id={`stage-${value}`} />
                            <Label htmlFor={`stage-${value}`}>{label}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="companyStage"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel>Company Stage</FormLabel>
                    <Select 
                      value={field.value || ""} 
                      onValueChange={field.onChange}
                      disabled={updateDealMutation.isPending}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select company stage" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(COMPANY_STAGES).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      The company's funding/growth stage (Seed, Series A, etc.)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {form.watch("stage") === "rejected" && (
                <FormField
                  control={form.control}
                  name="rejectionReason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rejection Reason</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Please provide a reason for rejecting this deal" 
                          rows={3} 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <DialogFooter>
                <Button variant="outline" type="button" onClick={onClose}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateDealMutation.isPending}
                >
                  {updateDealMutation.isPending ? "Updating..." : "Update Deal"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}