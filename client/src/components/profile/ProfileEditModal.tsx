import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { FORM_CONSTRAINTS, TOAST_DURATION, USER_ROLE_DESCRIPTIONS, AVATAR_COLORS } from "@/lib/constants/ui-constants";
import { UserAvatar } from "@/components/common/UserAvatar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  currentRole: string;
}

export default function ProfileEditModal({ 
  isOpen, 
  onClose,
  currentName,
  currentRole
}: ProfileEditModalProps) {
  const [name, setName] = useState(currentName);
  const [role, setRole] = useState(currentRole);
  const [avatarColor, setAvatarColor] = useState<string | null>(null);
  
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  
  interface User {
    id: number;
    username: string;
    fullName: string;
    initials: string;
    role: string;
    avatarColor?: string | null;
  }

  // Get current user to determine ID for update
  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/auth/me"],
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Sync props with state when they change
  useEffect(() => {
    setName(currentName);
    setRole(currentRole);
    
    if (currentUser?.avatarColor) {
      setAvatarColor(currentUser.avatarColor);
    } else {
      setAvatarColor(AVATAR_COLORS.DEFAULT);
    }
  }, [currentName, currentRole, currentUser]);
  
  // Debug logs to track state changes
  useEffect(() => {
    console.log('Avatar color changed to:', avatarColor);
  }, [avatarColor]);

  const handleSubmit = async () => {
    if (!name?.trim() || name.length < FORM_CONSTRAINTS.USERNAME.MIN_LENGTH) {
      toast({
        title: "Error", 
        description: FORM_CONSTRAINTS.USERNAME.ERROR_MESSAGE,
        variant: "destructive",
        duration: TOAST_DURATION.MEDIUM
      });
      return;
    }
    
    setIsUpdating(true);
    try {
      // Determine the user ID to update
      // If authenticated, use the current user's ID, otherwise default to 1
      const userId = (currentUser && 'id' in currentUser) ? currentUser.id : 1;
      
      // Create update payload - only include fields that actually changed
      const updatePayload: any = {
        fullName: name
      };
      
      // Only include avatarColor if it changed
      if (avatarColor !== currentUser?.avatarColor) {
        updatePayload.avatarColor = avatarColor;
      }
      
      // Only include role if it changed AND the current user is an admin
      // Don't include role at all for non-admin users to avoid permission errors
      if (role !== currentRole && currentUser?.role === 'admin') {
        updatePayload.role = role;
      }
      
      console.log('Updating profile with payload:', updatePayload);
      
      // Update the user
      await apiRequest("PATCH", `/api/users/${userId}`, updatePayload);
      
      // Refresh user data and timeline events
      // Force a refetch to ensure the avatar in the sidebar updates
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/users"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/activity"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/deals"] }),
        // Invalidate all timeline data for all deals
        queryClient.invalidateQueries({ queryKey: ["/api/deals"] }),
      ]);
      
      // Force immediate refetch of user data
      await queryClient.refetchQueries({ queryKey: ["/api/auth/me"] });
      await queryClient.refetchQueries({ queryKey: ["/api/users"] });
      
      toast({
        title: "Success",
        description: "Profile updated successfully",
        duration: TOAST_DURATION.SHORT
      });
      
      // Close the modal
      onClose();
    } catch (error) {
      console.error("Error updating profile:", error);
      
      // Provide more detailed error message based on response
      let errorMessage = "Failed to update profile";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      // Check if it's a role permission issue
      if (typeof error === 'object' && error && 'status' in error && error.status === 403) {
        if ('data' in error && typeof error.data === 'object' && error.data && 'message' in error.data) {
          errorMessage = String(error.data.message);
          
          // Special case for role permission issues
          if (errorMessage.includes("administrators") && errorMessage.includes("roles")) {
            errorMessage = "Only admin users can change roles. Your avatar color and name have been updated.";
          }
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
        duration: TOAST_DURATION.LONG
      });
    } finally {
      setIsUpdating(false);
    }
  };
  
  const handleClose = () => {
    // Refresh data when closing
    queryClient.refetchQueries({ queryKey: ["/api/auth/me"] });
    queryClient.refetchQueries({ queryKey: ["/api/users"] });
    onClose();
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>
        
        {/* Avatar Preview */}
        <div className="flex justify-center mb-4">
          {currentUser && (
            <div className="flex flex-col items-center">
              <div 
                className="rounded-full flex items-center justify-center text-white font-semibold"
                style={{ 
                  backgroundColor: avatarColor || AVATAR_COLORS.DEFAULT,
                  width: "5rem",
                  height: "5rem",
                  fontSize: "1.5rem"
                }}
              >
                {currentUser.initials}
              </div>
              <span className="text-sm text-muted-foreground mt-2">Avatar Preview</span>
            </div>
          )}
        </div>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
              maxLength={FORM_CONSTRAINTS.USERNAME.MAX_LENGTH}
              placeholder={FORM_CONSTRAINTS.PLACEHOLDERS.ENTER_NAME}
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="role" className="text-right">
              Role
            </Label>
            <div className="col-span-3">
              {currentUser?.role === 'admin' ? (
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue placeholder={FORM_CONSTRAINTS.PLACEHOLDERS.SELECT_ROLE} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="partner">Partner</SelectItem>
                    <SelectItem value="analyst">Analyst</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                    <SelectItem value="observer">Observer</SelectItem>
                    <SelectItem value="intern">Intern</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center space-x-2">
                  <span className="border rounded-md px-3 py-2 bg-muted/50 text-muted-foreground text-sm capitalize">{role}</span>
                  <span className="text-xs text-muted-foreground">(Only admins can change roles)</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right pt-2">
              Avatar Color
            </Label>
            <div className="col-span-3">
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(AVATAR_COLORS).map(([colorName, colorValue]) => (
                  // Skip DEFAULT as it's not a real color option
                  colorName !== 'DEFAULT' && (
                    <div 
                      key={colorName}
                      className={`cursor-pointer flex flex-col items-center`}
                      onClick={() => {
                        console.log(`Setting color to ${colorName}: ${colorValue}`);
                        setAvatarColor(colorValue);
                      }}
                    >
                      <div 
                        className={`w-8 h-8 rounded-full border-2 ${avatarColor === colorValue ? 'border-primary ring-2 ring-primary/30' : 'border-gray-200'}`}
                        style={{ backgroundColor: colorValue }}
                      />
                      <span className="text-xs mt-1 capitalize">{colorName.toLowerCase()}</span>
                    </div>
                  )
                ))}
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="permissions" className="text-right">
              Permissions
            </Label>
            <div className="col-span-3 text-sm text-neutral-600">
              {role === 'admin' && USER_ROLE_DESCRIPTIONS.ADMIN}
              {role === 'partner' && USER_ROLE_DESCRIPTIONS.PARTNER}
              {role === 'analyst' && USER_ROLE_DESCRIPTIONS.ANALYST}
              {role === 'observer' && USER_ROLE_DESCRIPTIONS.OBSERVER}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isUpdating}>Cancel</Button>
          <Button onClick={handleSubmit} className="bg-primary hover:bg-primary-dark text-white" disabled={isUpdating}>
            {isUpdating ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
