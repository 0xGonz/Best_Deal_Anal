import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AVATAR_COLORS } from "@/lib/constants/ui-constants";
import { useQuery } from "@tanstack/react-query";

// Common user type that matches what we need across the application
interface UserAvatarProps {
  user: {
    id: number;
    fullName?: string;
    initials?: string;
    avatarColor?: string | null;
    role?: string;
  } | null | undefined;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Centralized component for displaying user avatars consistently across the application
 * This will pull the most up-to-date user data from the cache
 */
export function UserAvatar({ user, size = 'md', className = '' }: UserAvatarProps) {
  // Get data for this specific user directly - this will guarantee fresh data
  const { data: userData } = useQuery<any>({
    queryKey: ['/api/users', user?.id],
    queryFn: async () => {
      // If this is the current user, use /api/auth/me for most accurate data
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const meData = await res.json();
        if (meData && meData.id === user?.id) {
          console.log('Using /me endpoint data for avatar', meData);
          return meData;
        }
      } catch (e) {
        console.error('Error fetching from /me endpoint', e);
      }
      
      // Otherwise try to get user by ID
      if (user?.id) {
        try {
          const res = await fetch(`/api/users/${user.id}`);
          const userById = await res.json();
          console.log(`Direct user fetch for avatar ID ${user.id}:`, userById);
          return userById;
        } catch (e) {
          console.error(`Error fetching user ${user.id}`, e);
        }
      }
      
      // Fallback to the user data passed in props
      return user;
    },
    enabled: !!user?.id, // Only fetch if we have a user ID
    refetchOnWindowFocus: true,
    staleTime: 0, // Always refetch
    refetchInterval: 10000, // Refresh every 10 seconds
  });
  
  // Use the directly fetched data or fall back to the passed user data
  const currentUserData = userData || user;
  
  // Debug log for avatar color changes
  useEffect(() => {
    if (currentUserData?.avatarColor) {
      console.log(`UserAvatar: User ${currentUserData.id} has color ${currentUserData.avatarColor}`);
    }
  }, [currentUserData?.avatarColor]);
  
  // Size classes mapping
  const sizeClasses = {
    xs: 'h-4 w-4',
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-10 w-10'
  };

  // Font size based on avatar size
  const fontSizes = {
    xs: '9px',
    sm: '10px',
    md: '12px',
    lg: '14px'
  };

  // Always use the most recent avatar color from the users cache
  // Fall back to the passed user data if not in cache
  // Finally fall back to default color if nothing else is available
  const avatarColor = currentUserData?.avatarColor || user?.avatarColor || AVATAR_COLORS.DEFAULT;
  
  // Use the most recent initials, or fallback
  const initials = currentUserData?.initials || user?.initials || '??';
  
  return (
    <Avatar className={`${sizeClasses[size]} ${className}`}>
      <AvatarFallback 
        style={{ 
          backgroundColor: avatarColor,
          color: '#FFFFFF',
          fontSize: fontSizes[size]
        }}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}