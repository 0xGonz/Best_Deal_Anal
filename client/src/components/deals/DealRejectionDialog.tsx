import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle, X } from "lucide-react";
import { REJECTION_CATEGORIES, type RejectionCategory, type RejectionReason } from "@/lib/constants/rejection-reasons";

interface DealRejectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (rejectionData: {
    category: RejectionCategory;
    reason: RejectionReason;
    additionalNotes?: string;
  }) => void;
  dealName: string;
  isLoading?: boolean;
}

export function DealRejectionDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  dealName,
  isLoading = false 
}: DealRejectionDialogProps) {
  const [selectedCategory, setSelectedCategory] = useState<RejectionCategory | "">("");
  const [selectedReason, setSelectedReason] = useState<RejectionReason>("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [errors, setErrors] = useState<{ category?: string; reason?: string }>({});

  const handleCategoryChange = (category: RejectionCategory) => {
    setSelectedCategory(category);
    setSelectedReason(""); // Reset reason when category changes
    setErrors(prev => ({ ...prev, category: undefined }));
  };

  const handleReasonChange = (reason: RejectionReason) => {
    setSelectedReason(reason);
    setErrors(prev => ({ ...prev, reason: undefined }));
  };

  const validateForm = () => {
    const newErrors: { category?: string; reason?: string } = {};
    
    if (!selectedCategory) {
      newErrors.category = "Please select a rejection category";
    }
    
    if (!selectedReason) {
      newErrors.reason = "Please select a specific reason";
    }
    
    // If "Other" is selected, require additional notes
    if (selectedCategory === "OTHER" && selectedReason === "Other (specify below)" && !additionalNotes.trim()) {
      newErrors.reason = "Please provide details when selecting 'Other'";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleConfirm = () => {
    if (!validateForm()) return;

    onConfirm({
      category: selectedCategory as RejectionCategory,
      reason: selectedReason,
      additionalNotes: additionalNotes.trim() || undefined,
    });
  };

  const handleClose = () => {
    setSelectedCategory("");
    setSelectedReason("");
    setAdditionalNotes("");
    setErrors({});
    onClose();
  };

  const availableReasons = selectedCategory ? REJECTION_CATEGORIES[selectedCategory].reasons : [];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Reject Deal: {dealName}
          </DialogTitle>
          <DialogDescription>
            Please provide structured feedback on why this deal is being rejected. 
            This data helps improve our investment process and decision-making.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Category Selection */}
          <div className="space-y-2">
            <Label htmlFor="category">Rejection Category *</Label>
            <Select
              value={selectedCategory}
              onValueChange={handleCategoryChange}
              disabled={isLoading}
            >
              <SelectTrigger className={errors.category ? "border-red-500" : ""}>
                <SelectValue placeholder="Select primary reason category" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(REJECTION_CATEGORIES).map(([key, category]) => (
                  <SelectItem key={key} value={key}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && (
              <p className="text-sm text-red-500">{errors.category}</p>
            )}
          </div>

          {/* Specific Reason Selection */}
          {selectedCategory && (
            <div className="space-y-2">
              <Label htmlFor="reason">Specific Reason *</Label>
              <Select
                value={selectedReason}
                onValueChange={handleReasonChange}
                disabled={isLoading}
              >
                <SelectTrigger className={errors.reason ? "border-red-500" : ""}>
                  <SelectValue placeholder="Select specific reason" />
                </SelectTrigger>
                <SelectContent>
                  {availableReasons.map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {reason}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.reason && (
                <p className="text-sm text-red-500">{errors.reason}</p>
              )}
            </div>
          )}

          {/* Additional Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">
              Additional Notes 
              {selectedCategory === "OTHER" && selectedReason === "Other (specify below)" && 
                <span className="text-red-500">*</span>
              }
            </Label>
            <Textarea
              id="notes"
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder={
                selectedCategory === "OTHER" && selectedReason === "Other (specify below)"
                  ? "Please provide specific details about the rejection reason..."
                  : "Optional: Provide additional context or details..."
              }
              rows={4}
              disabled={isLoading}
              className="resize-none"
            />
            <p className="text-xs text-gray-500">
              This information helps the team learn from decisions and improve future deal evaluation.
            </p>
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading || !selectedCategory || !selectedReason}
          >
            {isLoading ? "Rejecting..." : "Reject Deal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}