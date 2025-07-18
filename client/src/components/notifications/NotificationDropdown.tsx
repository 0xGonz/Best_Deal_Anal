import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { Bell, Check, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';

// Define notification type for frontend use
interface Notification {
  id: number;
  userId: number;
  title: string;
  message: string;
  type: 'deal' | 'memo' | 'assignment' | 'system';
  relatedId?: number;
  isRead: boolean;
  createdAt: string;
}

// Define unread count response type
interface UnreadCountResponse {
  count: number;
}

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch notifications
  const { data: notifications = [] } = useQuery<Notification[], Error, Notification[]>({
    queryKey: ['/api/notifications'],
    staleTime: 60000, // 1 minute,
    select: (data) => data.filter(notification => !notification.isRead) as Notification[]
  });

  // Fetch unread count
  const { data: unreadCountData } = useQuery<UnreadCountResponse, Error, UnreadCountResponse>({
    queryKey: ['/api/notifications/unread-count'],
    staleTime: 30000, // 30 seconds
  });

  const unreadCount = unreadCountData?.count || 0;

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', '/api/notifications/mark-all-read', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
      toast({
        title: 'Notifications marked as read',
        description: 'All notifications have been marked as read',
      });
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to mark notifications as read',
      });
    },
  });

  // Mark single notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('PATCH', `/api/notifications/${id}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to mark notification as read',
      });
    },
  });

  // Get notification type color
  const getTypeColor = (type: Notification['type']) => {
    switch (type) {
      case 'deal':
        return 'bg-blue-100 text-blue-800';
      case 'memo':
        return 'bg-green-100 text-green-800';
      case 'assignment':
        return 'bg-purple-100 text-purple-800';
      case 'system':
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="relative text-neutral-600 hover:text-neutral-800 h-10 w-10 p-0">
          <Bell className="h-6 w-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-accent text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[85vw] max-w-[320px] p-0" align="end" sideOffset={8}>
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">Notifications</CardTitle>
              {unreadCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-[10px] xs:text-xs h-7 xs:h-8 px-1.5 xs:px-2"
                  onClick={() => markAllAsReadMutation.mutate()}
                  disabled={markAllAsReadMutation.isPending}
                >
                  Mark all read
                </Button>
              )}
            </div>
            <CardDescription className="text-sm">
              {notifications.length === 0 
                ? 'No notifications'
                : `You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0 max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-8 px-4 text-neutral-500">
                <Mail className="h-12 w-12 mb-2 text-neutral-300" />
                <p className="text-sm font-medium">No notifications</p>
                <p className="text-xs">You're all caught up!</p>
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((notification) => (
                  <div 
                    key={notification.id} 
                    className={`p-4 hover:bg-neutral-50 ${!notification.isRead ? 'bg-blue-50/30' : ''}`}
                  >
                    <div className="flex justify-between gap-2">
                      <div className="min-w-0 flex-grow">
                        <div className="font-medium text-xs xs:text-sm truncate">{notification.title}</div>
                        <p className="text-xs xs:text-sm text-gray-500 mt-1 line-clamp-2">{notification.message}</p>
                        <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-2">
                          <Badge variant="outline" className={`${getTypeColor(notification.type)} border-0 text-[10px] px-1.5 py-0.5 leading-none`}>
                            {notification.type.charAt(0).toUpperCase() + notification.type.slice(1)}
                          </Badge>
                          <span className="text-[10px] text-gray-400">
                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      {!notification.isRead && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-gray-400 hover:text-gray-600"
                          onClick={() => markAsReadMutation.mutate(notification.id)}
                          disabled={markAsReadMutation.isPending}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter className="pt-2 pb-4 px-4">
            <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setOpen(false)}>
              Close
            </Button>
          </CardFooter>
        </Card>
      </PopoverContent>
    </Popover>
  );
}