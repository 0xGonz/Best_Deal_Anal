import React, { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import UsersListAdmin from "@/components/users/UsersListAdmin";
import AddUserDialog from "@/components/users/AddUserDialog";
import EditUserDialog from "@/components/users/EditUserDialog";
import DeleteUserAlert from "@/components/users/DeleteUserAlert";
import { PADDING, MARGIN, GAP } from "@/lib/constants/spacing-constants";

// Define User type
interface User {
  id: number;
  fullName: string;
  username: string;
  email: string;
  role: "admin" | "partner" | "analyst" | "observer" | "intern";
  initials: string;
  avatarColor?: string;
  lastActive?: string;
}

export default function UsersPage() {
  // State for modals
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // Fetch users
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"]
  });
  
  // Handle edit user button click
  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setIsEditUserOpen(true);
  };
  
  // Handle delete user button click
  const handleDeleteUser = (user: User) => {
    setSelectedUser(user);
    setIsDeleteAlertOpen(true);
  };
  
  return (
    <AppLayout>
      <div className={`${PADDING.LAYOUT.PAGE} pb-20 w-full overflow-hidden`}>
        <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center ${MARGIN.LAYOUT.SECTION}`}>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Users</h1>
            <p className="text-muted-foreground">Manage users and permissions</p>
          </div>
          <div className="mt-4 sm:mt-0">
            <Button 
              onClick={() => setIsAddUserOpen(true)} 
              className="flex items-center gap-2"
            >
              <UserPlus className="h-4 w-4" />
              <span>Add User</span>
            </Button>
          </div>
        </div>

        {/* Users List with Admin functionality */}
        <div className={`${MARGIN.LAYOUT.COMPONENT}`}>
          <UsersListAdmin 
            users={users} 
            isLoading={isLoading} 
            onEditUser={handleEditUser} 
            onDeleteUser={handleDeleteUser} 
          />
        </div>
        
        {/* Add User Dialog */}
        <AddUserDialog 
          isOpen={isAddUserOpen} 
          onClose={() => setIsAddUserOpen(false)} 
        />
        
        {/* Edit User Dialog */}
        <EditUserDialog 
          isOpen={isEditUserOpen} 
          onClose={() => setIsEditUserOpen(false)} 
          user={selectedUser} 
        />
        
        {/* Delete User Confirmation */}
        <DeleteUserAlert 
          isOpen={isDeleteAlertOpen} 
          onClose={() => setIsDeleteAlertOpen(false)} 
          user={selectedUser} 
        />
      </div>
    </AppLayout>
  );
}