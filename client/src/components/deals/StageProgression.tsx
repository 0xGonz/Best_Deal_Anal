import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { generateDealNotification } from "@/lib/utils/notification-utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { DealStageLabels } from "@shared/schema";
import { DealRejectionDialog } from "./DealRejectionDialog";
import { type RejectionCategory, type RejectionReason } from "@/lib/constants/rejection-reasons";

// Define the stage order for progression
const stageOrder = [
  "initial_review",
  "screening", 
  "diligence",
  "ic_review",
  "closing",
  "closed",
];

// The "passed" and "rejected" stages are special and not part of the normal progression

interface StageProgressionProps {
  deal: any;
  onStageUpdated?: () => void;
}

export default function StageProgression({ deal, onStageUpdated }: StageProgressionProps) {
  const { toast } = useToast();
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);
  
  // Get current user for rejection tracking
  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/me"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  // Calculate the current stage index
  const currentStageIndex = stageOrder.indexOf(deal.stage);
  const isRejected = deal.stage === "rejected";
  const isPassed = deal.stage === "passed";
  
  // Determine if we can move forward or backward
  const canMoveForward = currentStageIndex < stageOrder.length - 1 && !isRejected && !isPassed;
  const canMoveBackward = currentStageIndex > 0 && !isRejected && !isPassed;
  
  // Update deal mutation
  const updateDealMutation = useMutation({
    mutationFn: async (stageData: { 
      stage: string; 
      rejectionReason?: string;
      rejectionCategory?: string;
      rejectionData?: any;
    }) => {
      return apiRequest("PATCH", `/api/deals/${deal.id}`, stageData);
    },
    onSuccess: async (data: any) => {
      // Refresh deal data
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${deal.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      
      // Show success toast
      toast({
        title: "Stage Updated",
        description: `${deal.name} moved to ${DealStageLabels[data.stage as keyof typeof DealStageLabels]}`
      });
      
      // Create notification with specific stage info
      try {
        await generateDealNotification(1, deal.name, 'moved', deal.id, data.stage);
        
        // Refresh notifications in the UI
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
        queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      } catch (err) {
        console.error('Failed to create notification:', err);
      }
      
      // Call onStageUpdated callback if provided
      if (onStageUpdated) {
        onStageUpdated();
      }
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update the deal stage. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  // Handle stage progression
  const moveToNextStage = () => {
    if (canMoveForward) {
      const nextStage = stageOrder[currentStageIndex + 1];
      updateDealMutation.mutate({ stage: nextStage });
    }
  };
  
  // Handle stage regression
  const moveToPreviousStage = () => {
    if (canMoveBackward) {
      const previousStage = stageOrder[currentStageIndex - 1];
      updateDealMutation.mutate({ stage: previousStage });
    }
  };
  
  // Handle structured rejection
  const handleRejection = (rejectionData: {
    category: RejectionCategory;
    reason: RejectionReason;
    additionalNotes?: string;
  }) => {
    if (!currentUser) {
      toast({
        title: "Authentication Error",
        description: "Please log in to reject deals.",
        variant: "destructive"
      });
      return;
    }

    const fullRejectionData = {
      category: rejectionData.category,
      reason: rejectionData.reason,
      additionalNotes: rejectionData.additionalNotes,
      rejectedBy: (currentUser as any).id,
      rejectedAt: new Date().toISOString(),
    };

    // Create combined rejection reason for display
    const displayReason = rejectionData.additionalNotes
      ? `${rejectionData.reason} - ${rejectionData.additionalNotes}`
      : rejectionData.reason;

    updateDealMutation.mutate({ 
      stage: "rejected", 
      rejectionReason: displayReason,
      rejectionCategory: rejectionData.category,
      rejectionData: fullRejectionData
    });
    
    setShowRejectionDialog(false);
  };
  
  // Handle passing on a deal
  const passDeal = () => {
    updateDealMutation.mutate({ stage: "passed" });
  };
  
  // Handle returning a rejected or passed deal to the pipeline
  const returnToPipeline = () => {
    // Return to initial review by default
    updateDealMutation.mutate({ stage: "initial_review" });
  };
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-card p-4 rounded-lg border">
        <div className="space-y-1">
          <h3 className="text-lg font-medium">Current Stage</h3>
          <p className="text-sm text-muted-foreground">
            {isRejected ? (
              <span className="text-destructive font-medium">Rejected: {deal.rejectionReason}</span>
            ) : isPassed ? (
              <span className="text-amber-500 font-medium">Passed</span>
            ) : (
              <span>{DealStageLabels[deal.stage as keyof typeof DealStageLabels]}</span>
            )}
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          {isRejected || isPassed ? (
            <Button 
              variant="outline" 
              onClick={returnToPipeline}
              disabled={updateDealMutation.isPending}
            >
              Return to Pipeline
            </Button>
          ) : (
            <>
              <Button 
                variant="outline" 
                onClick={moveToPreviousStage}
                disabled={!canMoveBackward || updateDealMutation.isPending}
              >
                Previous Stage
              </Button>
              
              <Button 
                variant="default" 
                onClick={moveToNextStage}
                disabled={!canMoveForward || updateDealMutation.isPending}
              >
                Next Stage
              </Button>
            </>
          )}
        </div>
      </div>
      
      {!isRejected && !isPassed && (
        <div className="flex justify-end space-x-2">
          <Button 
            variant="outline" 
            className="text-destructive hover:bg-destructive/10"
            onClick={() => setShowRejectionDialog(true)}
            disabled={updateDealMutation.isPending}
          >
            Reject Deal
          </Button>
          
          <Button 
            variant="outline" 
            onClick={passDeal}
            disabled={updateDealMutation.isPending}
          >
            Pass on Deal
          </Button>
        </div>
      )}

      {/* Structured Rejection Dialog */}
      <DealRejectionDialog
        isOpen={showRejectionDialog}
        onClose={() => setShowRejectionDialog(false)}
        onConfirm={handleRejection}
        dealName={deal.name}
        isLoading={updateDealMutation.isPending}
      />
    </div>
  );
}
