import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Search, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { User } from "@/lib/types";
import { UserAvatar } from "@/components/common/UserAvatar";

interface AssignUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  dealId: number;
}

type UserRole = "admin" | "partner" | "analyst" | "observer" | "intern";

const roleOrder: UserRole[] = ["admin", "partner", "analyst", "observer", "intern"];

const roleLabels: Record<UserRole, string> = {
  admin: "Administrators",
  partner: "Partners",
  analyst: "Analysts",
  observer: "Observers",
  intern: "Interns"
};

const roleBadgeColors: Record<UserRole, string> = {
  admin: "bg-red-100 text-red-800",
  partner: "bg-blue-100 text-blue-800",
  analyst: "bg-green-100 text-green-800",
  observer: "bg-purple-100 text-purple-800",
  intern: "bg-green-100 text-green-800"
};

export default function AssignUserModal({ isOpen, onClose, dealId }: AssignUserModalProps) {
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch all users
  const { data: users = [], isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: isOpen,
  });
  
  // Fetch current assignments
  const { data: dealData } = useQuery<{
    id: number;
    assignedUsers?: Array<{ id: number }>;
  }>({
    queryKey: [`/api/deals/${dealId}`],
    enabled: isOpen && !!dealId,
  });
  
  // Pre-select currently assigned users
  useEffect(() => {
    if (dealData?.assignedUsers) {
      setSelectedUsers(dealData.assignedUsers.map(user => user.id));
    }
  }, [dealData]);
  
  // Assign user mutation
  const assignUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      return apiRequest("POST", `/api/deals/${dealId}/assignments`, { userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}`] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to assign user. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  // Unassign user mutation
  const unassignUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      return apiRequest("DELETE", `/api/deals/${dealId}/assignments/${userId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}`] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to unassign user. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  const toggleUserSelection = (userId: number) => {
    if (selectedUsers.includes(userId)) {
      // Remove user from selection and unassign if already assigned
      const currentAssignedIds = dealData?.assignedUsers?.map((u: any) => u.id) || [];
      if (currentAssignedIds.includes(userId)) {
        unassignUserMutation.mutate(userId);
      }
      setSelectedUsers(prev => prev.filter(id => id !== userId));
    } else {
      // Add user to selection and assign if not already assigned
      const currentAssignedIds = dealData?.assignedUsers?.map((u: any) => u.id) || [];
      if (!currentAssignedIds.includes(userId)) {
        assignUserMutation.mutate(userId);
      }
      setSelectedUsers(prev => [...prev, userId]);
    }
  };
  
  const handleSave = () => {
    // Everything is already saved in real-time
    toast({
      title: "Success",
      description: "User assignments updated successfully.",
      variant: "success"
    });
    onClose();
  };
  
  // Filter users by search term
  const filteredUsers = users.filter(user => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      user.fullName.toLowerCase().includes(searchLower) ||
      user.username.toLowerCase().includes(searchLower) ||
      user.role.toLowerCase().includes(searchLower)
    );
  });
  
  // Group users by role
  const usersByRole = roleOrder.reduce<Record<string, User[]>>((acc, role) => {
    acc[role] = filteredUsers.filter(user => user.role === role);
    return acc;
  }, {});
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Users to Deal</DialogTitle>
          <DialogDescription>
            Select team members to assign to this deal.
          </DialogDescription>
        </DialogHeader>
        
        {/* Search input */}
        <div className="relative mb-4">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-neutral-400" />
          </div>
          <input
            type="text"
            placeholder="Search users..."
            className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="space-y-6 my-4 max-h-[350px] overflow-y-auto pr-2">
          {isLoadingUsers ? (
            <div className="py-4 text-center text-neutral-500">Loading users...</div>
          ) : (
            roleOrder.map(role => {
              const usersInRole = usersByRole[role] || [];
              if (usersInRole.length === 0) return null;
              
              return (
                <div key={role} className="space-y-2">
                  <div className="flex items-center">
                    <h3 className="text-sm font-medium text-neutral-700">{roleLabels[role]}</h3>
                    <Badge variant="outline" className={`ml-2 ${roleBadgeColors[role]}`}>
                      {usersInRole.length}
                    </Badge>
                  </div>
                  
                  <div className="space-y-1 ml-2">
                    {usersInRole.map(user => (
                      <div key={user.id} className="flex items-center space-x-3 p-2 hover:bg-neutral-100 rounded-md">
                        <Checkbox
                          id={`user-${user.id}`}
                          checked={selectedUsers.includes(user.id)}
                          onCheckedChange={() => toggleUserSelection(user.id)}
                        />
                        <div className="flex items-center space-x-3 flex-1">
                          <UserAvatar 
                            user={user}
                            size="sm"
                          />
                          <div>
                            <p className="text-sm font-medium">{user.fullName}</p>
                            <p className="text-xs text-neutral-500">{user.username}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
          
          {filteredUsers.length === 0 && (
            <div className="py-8 text-center text-neutral-500">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
              {searchTerm ? (
                <p>No users found matching "{searchTerm}"</p>
              ) : (
                <p>No users found</p>
              )}
            </div>
          )}
        </div>
        
        <DialogFooter className="flex justify-between sm:justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}