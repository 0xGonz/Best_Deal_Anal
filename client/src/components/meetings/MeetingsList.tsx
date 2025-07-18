import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Calendar,
  Users,
  StickyNote,
  Trash2,
  Edit,
  MoreHorizontal,
  PlusCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Meeting {
  id: number;
  dealId: number;
  title: string;
  date: string;
  attendees: string | null;
  notes: string | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  dealName: string;
}

interface MeetingsListProps {
  dealId: number;
  onCreateMeeting?: () => void;
}

export default function MeetingsList({ dealId, onCreateMeeting }: MeetingsListProps) {
  const { toast } = useToast();
  const [meetingToDelete, setMeetingToDelete] = useState<number | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  // Fetch meetings for this deal
  const { data: meetings = [], isLoading } = useQuery<Meeting[]>({
    queryKey: [`/api/meetings/deal/${dealId}`],
    enabled: !!dealId
  });
  
  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (meetingId: number) => {
      return apiRequest('DELETE', `/api/meetings/${meetingId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/meetings/deal/${dealId}`] });
      toast({
        title: 'Meeting deleted',
        description: 'The meeting has been successfully deleted.',
      });
      setIsDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: 'Error deleting meeting',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
    }
  });
  
  const handleDelete = (meetingId: number) => {
    setMeetingToDelete(meetingId);
    setIsDeleteDialogOpen(true);
  };
  
  const confirmDelete = () => {
    if (meetingToDelete) {
      deleteMutation.mutate(meetingToDelete);
    }
  };
  
  if (isLoading) {
    return (
      <div className="text-center py-8 text-neutral-500">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-opacity-50 border-t-primary rounded-full mx-auto mb-4"></div>
        <p>Loading meetings...</p>
      </div>
    );
  }
  
  if (meetings.length === 0) {
    return (
      <div className="text-center py-6">
        <Calendar className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-neutral-600 mb-1">No meetings scheduled</h3>
        <p className="text-neutral-500 text-sm mb-4">Schedule meetings with the team or external parties</p>
        {onCreateMeeting && (
          <Button onClick={onCreateMeeting} className="mt-2">
            <PlusCircle className="h-4 w-4 mr-2" />
            Schedule Meeting
          </Button>
        )}
      </div>
    );
  }
  
  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        <h3 className="text-lg font-medium">Scheduled Meetings</h3>
        {onCreateMeeting && (
          <Button onClick={onCreateMeeting} size="sm">
            <PlusCircle className="h-4 w-4 mr-2" />
            New Meeting
          </Button>
        )}
      </div>
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Attendees</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {meetings.map((meeting) => (
            <TableRow key={meeting.id}>
              <TableCell className="font-medium">
                {format(new Date(meeting.date), 'MMM d, yyyy h:mm a')}
              </TableCell>
              <TableCell>{meeting.title}</TableCell>
              <TableCell>
                {meeting.attendees ? 
                  meeting.attendees.split(',').map((attendee, idx) => (
                    <Badge key={idx} variant="outline" className="mr-1 mb-1">
                      {attendee.trim()}
                    </Badge>
                  )) 
                  : 'No attendees specified'}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => {}}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Meeting
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDelete(meeting.id)}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Meeting</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Are you sure you want to delete this meeting?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}