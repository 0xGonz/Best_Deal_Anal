import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AVATAR_COLORS } from "@/lib/constants/ui-constants";

// User type
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

// Validation schema for editing a user
const editUserSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  role: z.enum(["admin", "partner", "analyst", "observer", "intern"]),
  avatarColor: z.string().optional(),
  newPassword: z.string().optional()
    .refine(val => !val || val.length >= 6, {
      message: "Password must be at least 6 characters if provided",
    }),
});

type EditUserFormValues = z.infer<typeof editUserSchema>;

interface EditUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

export default function EditUserDialog({ isOpen, onClose, user }: EditUserDialogProps) {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  
  // Form definition
  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      fullName: "",
      username: "",
      email: "",
      role: "analyst",
      avatarColor: "",
      newPassword: "",
    }
  });
  
  // Update form when user changes
  useEffect(() => {
    if (user) {
      form.reset({
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        role: user.role,
        avatarColor: user.avatarColor || AVATAR_COLORS.BLUE,
        newPassword: "",
      });
    }
  }, [user, form]);
  
  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (userData: EditUserFormValues & { id: number }) => {
      const { id, newPassword, ...data } = userData;
      
      // Prepare the payload, including password if provided
      const payload: any = { ...data };
      if (newPassword && newPassword.trim()) {
        payload.password = newPassword;
      }
      
      console.log(`Sending update request for user ${id}:`, payload);
      
      const res = await apiRequest("PATCH", `/api/users/${id}`, payload);
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to update user');
      }
      
      return await res.json();
    },
    onSuccess: (data) => {
      console.log('User update successful:', data);
      toast({
        title: "User updated successfully",
        description: `${data.fullName || 'User'} information has been updated`,
      });
      onClose();
      
      // Force refresh all user-related queries
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      
      // Refetch users data immediately
      queryClient.refetchQueries({ queryKey: ["/api/users"] });
    },
    onError: (error: Error) => {
      console.error('User update failed:', error);
      toast({
        title: "Failed to update user",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  function onSubmit(data: EditUserFormValues) {
    if (!user) return;
    
    const userData = { 
      ...data, 
      id: user.id,
    };
    
    // Only include the password field if it's not empty
    if (!userData.newPassword) {
      delete userData.newPassword;
    }
    
    updateUserMutation.mutate(userData);
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update user information and permissions.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <label className="text-sm font-medium">Full Name</label>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <label className="text-sm font-medium">Username</label>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <label className="text-sm font-medium">Role</label>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="partner">Partner</SelectItem>
                        <SelectItem value="analyst">Analyst</SelectItem>
                        <SelectItem value="observer">Observer</SelectItem>
                        <SelectItem value="intern">Intern</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <label className="text-sm font-medium">Email</label>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="avatarColor"
              render={({ field }) => (
                <FormItem>
                  <label className="text-sm font-medium">Avatar Color</label>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {Object.entries(AVATAR_COLORS).map(([name, color]) => (
                      <div
                        key={`${name}-${color}`}
                        className={`w-8 h-8 rounded-full cursor-pointer transition-all ${
                          field.value === color
                            ? "ring-2 ring-offset-2 ring-accent"
                            : "hover:scale-110"
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => form.setValue("avatarColor", color)}
                        title={name}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <label className="text-sm font-medium">New Password (optional)</label>
                  <div className="relative">
                    <FormControl>
                      <Input 
                        placeholder="Leave blank to keep current password" 
                        type={showPassword ? "text" : "password"}
                        {...field} 
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateUserMutation.isPending}>
                {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}