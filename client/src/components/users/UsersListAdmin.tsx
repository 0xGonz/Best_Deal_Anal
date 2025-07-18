import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import UserCard from "./UserCard";
import { Skeleton } from "@/components/ui/skeleton";

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

interface UsersListAdminProps {
  users: User[];
  isLoading: boolean;
  onEditUser: (user: User) => void;
  onDeleteUser: (user: User) => void;
}

export default function UsersListAdmin({ users, isLoading, onEditUser, onDeleteUser }: UsersListAdminProps) {
  const [searchQuery, setSearchQuery] = useState("");
  
  // Filter users based on search query
  const filteredUsers = users.filter(user => 
    user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  if (isLoading) {
    return (
      <Card className="mb-8">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle>User Management</CardTitle>
            <div className="relative w-64">
              <Skeleton className="h-10 w-64" />
            </div>
          </div>
          <CardDescription>
            View and manage user accounts and permissions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <div className="grid grid-cols-12 gap-4 p-4 text-sm font-medium text-neutral-500 bg-neutral-50 border-b">
              <div className="col-span-5">User</div>
              <div className="col-span-3">Role</div>
              <div className="col-span-3">Last Active</div>
              <div className="col-span-1">Actions</div>
            </div>
            <div className="divide-y">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="grid grid-cols-12 gap-4 p-4 items-center">
                  <div className="col-span-5 flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div>
                      <Skeleton className="h-5 w-32 mb-1" />
                      <Skeleton className="h-4 w-48" />
                    </div>
                  </div>
                  <div className="col-span-3">
                    <Skeleton className="h-6 w-16" />
                  </div>
                  <div className="col-span-3">
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <div className="col-span-1 flex">
                    <Skeleton className="h-8 w-8 rounded-md mr-1" />
                    <Skeleton className="h-8 w-8 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="mb-8">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle>User Management</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <CardDescription>
          View and manage user accounts and permissions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <div className="grid grid-cols-12 gap-4 p-4 text-sm font-medium text-neutral-500 bg-neutral-50 border-b">
            <div className="col-span-5">User</div>
            <div className="col-span-3">Role</div>
            <div className="col-span-3">Last Active</div>
            <div className="col-span-1">Actions</div>
          </div>
          <div className="divide-y">
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <UserCard 
                  key={user.id} 
                  user={user} 
                  onEdit={onEditUser} 
                  onDelete={onDeleteUser} 
                  listView={true}
                />
              ))
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                {searchQuery ? (
                  <p>No users found matching "{searchQuery}"</p>
                ) : (
                  <p>No users available</p>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}