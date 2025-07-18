import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, isPast, addDays, isToday, startOfWeek, addWeeks, subWeeks } from 'date-fns';
import { useLocation } from 'wouter';
import { DATE_FORMATS } from '@/lib/constants/time-constants';
import { formatCurrency, formatDate } from '@/lib/utils/formatters';
import { formatAmountByType } from '@/lib/utils/format';
import { 
  CAPITAL_CALL_STATUS, 
  CAPITAL_CALL_STATUS_COLORS, 
  CAPITAL_CALL_STATUS_LABELS 
} from '@/lib/constants/capital-call-constants';
import {
  CLOSING_EVENT_STATUS,
  CLOSING_EVENT_STATUS_COLORS,
  CLOSING_EVENT_STATUS_LABELS,
  CLOSING_EVENT_TYPES,
  CLOSING_EVENT_TYPE_LABELS
} from '@/lib/constants/closing-event-constants';
import {
  CALENDAR_HIGHLIGHT_COLORS,
  CALENDAR_INDICATOR_COLORS,
  CALENDAR_EVENT_TYPES
} from '@/lib/constants/calendar-constants';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import UnifiedEventForm from '@/components/calendar/UnifiedEventForm';
import { useAuth } from '@/hooks/use-auth';

interface CapitalCall {
  id: number;
  allocationId: number;
  callAmount: number;
  amountType: 'percentage' | 'dollar';
  callDate: string;
  dueDate: string;
  dealId: number;
  paidAmount: number;
  paidDate: string | null;
  status: typeof CAPITAL_CALL_STATUS[keyof typeof CAPITAL_CALL_STATUS];
  notes: string | null;
  dealName: string; // Added through API join
  fundName: string; // Added through API join
}

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
  dealName: string; // Added through API join
}

interface ClosingScheduleEvent {
  id: number;
  dealId: number;
  createdBy: number;
  eventType: typeof CLOSING_EVENT_TYPES[keyof typeof CLOSING_EVENT_TYPES];
  eventName: string;
  scheduledDate: string;
  targetAmount: number | null;
  amountType: 'percentage' | 'dollar';
  status: typeof CLOSING_EVENT_STATUS[keyof typeof CLOSING_EVENT_STATUS];
  notes: string | null;
  actualDate: string | null;
  actualAmount: number | null;
  dealName: string; // Added through API join
}

const CalendarPage = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [activeTab, setActiveTab] = useState<string>(CALENDAR_EVENT_TYPES.ALL);
  const [, setLocation] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  
  // State for unified event form
  const [isEventFormOpen, setIsEventFormOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<{
    type: 'capital-call' | 'closing-event' | 'meeting';
    id: number;
  } | null>(null);
  
  // Ensure authentication is valid on this page
  const { data: currentUser } = useAuth();
  
  // Fetch capital calls - no need to add auth check since ProtectedRoute handles it
  const { data: capitalCalls = [], isLoading: isLoadingCalls } = useQuery<CapitalCall[]>({
    queryKey: ['/api/capital-calls'],
  });
  
  // Fetch closing schedule events - no need to add auth check since ProtectedRoute handles it
  const { data: closingEvents = [], isLoading: isLoadingEvents } = useQuery<ClosingScheduleEvent[]>({
    queryKey: ['/api/closing-schedules'],
  });
  
  // Fetch deal meetings
  const { data: meetings = [], isLoading: isLoadingMeetings } = useQuery<Meeting[]>({
    queryKey: ['/api/meetings'],
  });
  
  const isLoading = isLoadingCalls || isLoadingEvents || isLoadingMeetings;
  
  // Debug authentication state
  console.log('Calendar page auth state:', { 
    isAuthenticated: !!currentUser, 
    username: currentUser?.username
  });
  
  // Filter events based on selected date, tab and status filters
  const filteredCalls = React.useMemo(() => {
    if (!selectedDate) return [];
    
    const dateStr = format(selectedDate, DATE_FORMATS.ISO);
    const selectedDateStr = dateStr.split('T')[0];
    
    let filtered = capitalCalls.filter(call => {
      // Compare only the date part (YYYY-MM-DD) and ignore time to handle different timezones
      const callDateStr = call.callDate.split('T')[0];
      const dueDateStr = call.dueDate.split('T')[0];
      const paidDateStr = call.paidDate?.split('T')[0];
      
      return callDateStr === selectedDateStr || dueDateStr === selectedDateStr || paidDateStr === selectedDateStr;
    });
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(call => call.status === statusFilter);
    }
    
    return filtered;
  }, [capitalCalls, selectedDate, statusFilter]);

  // Filter closing schedule events based on selected date and filters
  const filteredClosingEvents = React.useMemo(() => {
    if (!selectedDate) return [];
    
    const dateStr = format(selectedDate, DATE_FORMATS.ISO);
    let filtered = closingEvents.filter(event => {
      const scheduledDateMatch = event.scheduledDate.startsWith(dateStr);
      const actualDateMatch = event.actualDate?.startsWith(dateStr);
      
      return scheduledDateMatch || actualDateMatch;
    });
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(event => event.status === statusFilter);
    }
    
    if (eventTypeFilter !== 'all') {
      filtered = filtered.filter(event => event.eventType === eventTypeFilter);
    }
    
    return filtered;
  }, [closingEvents, selectedDate, statusFilter, eventTypeFilter]);
  
  // Filter meetings based on selected date
  const filteredMeetings = React.useMemo(() => {
    if (!selectedDate) return [];
    
    const dateStr = format(selectedDate, DATE_FORMATS.ISO);
    const filtered = meetings.filter(meeting => {
      return meeting.date.startsWith(dateStr);
    });
    
    return filtered;
  }, [meetings, selectedDate]);

  // Generate calendar highlights based on capital calls and closing events
  const calendarHighlights = React.useMemo(() => {
    const highlights: { [key: string]: { count: number, types: Set<string> } } = {};
    
    // Show capital calls only if on 'all' or 'capital-calls' tab
    if (activeTab === CALENDAR_EVENT_TYPES.ALL || activeTab === CALENDAR_EVENT_TYPES.CAPITAL_CALLS) {
      // Add capital call highlights
      capitalCalls.forEach(call => {
        // Format dates to YYYY-MM-DD strings for comparison
        // This approach ensures consistency regardless of the time component
        const callDateStr = call.callDate.split('T')[0];
        const dueDateStr = call.dueDate.split('T')[0];
        
        // Add call date highlight
        if (!highlights[callDateStr]) {
          highlights[callDateStr] = { count: 0, types: new Set() };
        }
        highlights[callDateStr].count++;
        highlights[callDateStr].types.add('call');
        
        // Add due date highlight
        if (!highlights[dueDateStr]) {
          highlights[dueDateStr] = { count: 0, types: new Set() };
        }
        highlights[dueDateStr].count++;
        highlights[dueDateStr].types.add('due');
        
        // Add paid date highlight if it exists
        if (call.paidDate) {
          const paidDateStr = call.paidDate.split('T')[0];
          if (!highlights[paidDateStr]) {
            highlights[paidDateStr] = { count: 0, types: new Set() };
          }
          highlights[paidDateStr].count++;
          highlights[paidDateStr].types.add('paid');
        }
      });
    }
    
    // Show closing events only if on 'all' or 'closing-events' tab
    if (activeTab === CALENDAR_EVENT_TYPES.ALL || activeTab === CALENDAR_EVENT_TYPES.CLOSING_EVENTS) {
      // Add closing event highlights
      closingEvents.forEach(event => {
        // Format dates to YYYY-MM-DD strings for comparison
        const scheduledDateStr = event.scheduledDate.split('T')[0];
        
        // Add scheduled date highlight
        if (!highlights[scheduledDateStr]) {
          highlights[scheduledDateStr] = { count: 0, types: new Set() };
        }
        highlights[scheduledDateStr].count++;
        highlights[scheduledDateStr].types.add('closing');
        
        // Add actual date highlight if it exists
        if (event.actualDate) {
          const actualDateStr = event.actualDate.split('T')[0];
          if (!highlights[actualDateStr]) {
            highlights[actualDateStr] = { count: 0, types: new Set() };
          }
          highlights[actualDateStr].count++;
          highlights[actualDateStr].types.add('completed');
        }
      });
    }
    
    // Show meetings only if on 'all' or 'meetings' tab
    if (activeTab === CALENDAR_EVENT_TYPES.ALL || activeTab === CALENDAR_EVENT_TYPES.MEETINGS) {
      // Add meeting highlights
      meetings.forEach(meeting => {
        // Format dates to YYYY-MM-DD strings for comparison
        const meetingDateStr = meeting.date.split('T')[0];
        
        // Add meeting date highlight
        if (!highlights[meetingDateStr]) {
          highlights[meetingDateStr] = { count: 0, types: new Set() };
        }
        highlights[meetingDateStr].count++;
        highlights[meetingDateStr].types.add('meeting');
      });
    }
    
    return highlights;
  }, [capitalCalls, closingEvents, meetings, activeTab]);

  // Custom day render function for the calendar
  const renderDay = (date: Date) => {
    const dateStr = format(date, DATE_FORMATS.ISO);
    const highlight = calendarHighlights[dateStr];
    
    const isPastDate = isPast(date) && !isToday(date);
    const isSelected = selectedDate && format(selectedDate, DATE_FORMATS.ISO) === dateStr;
    
    let bgClass = '';
    if (highlight) {
      if (highlight.types.has('due')) {
        bgClass = CALENDAR_HIGHLIGHT_COLORS.DUE;
      }
      if (highlight.types.has('call')) {
        bgClass = CALENDAR_HIGHLIGHT_COLORS.CALL;
      }
      if (highlight.types.has('paid')) {
        bgClass = CALENDAR_HIGHLIGHT_COLORS.PAID;
      }
      if (highlight.types.has('closing')) {
        bgClass = CALENDAR_HIGHLIGHT_COLORS.CLOSING;
      }
      if (highlight.types.has('completed')) {
        bgClass = CALENDAR_HIGHLIGHT_COLORS.ACTUAL_CLOSING;
      }
      if (isSelected) {
        bgClass = '';
      }
    }
    
    return (
      <div className={`w-full h-full flex items-center justify-center rounded-md relative ${bgClass}`}>
        <span className={`text-lg ${isPastDate ? 'text-muted-foreground' : ''}`}>
          {format(date, 'd')}
        </span>
        {highlight && (
          <div className="absolute top-0.5 right-0.5">
            {/* Show indicator in top right corner with event count */}
            {highlight.types.size > 0 && (
              <div className="flex items-center justify-center bg-primary/10 rounded-full w-4 h-4">
                <span className="text-[9px] font-medium text-primary">{highlight.types.size}</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const nextDate = () => {
    if (selectedDate) {
      setSelectedDate(addDays(selectedDate, 1));
    }
  };

  const prevDate = () => {
    if (selectedDate) {
      setSelectedDate(addDays(selectedDate, -1));
    }
  };

  return (
    <AppLayout>
      <div className="container py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Calendar</h1>
          
          <div className="flex gap-2 items-center">
            <Button 
              onClick={() => setIsEventFormOpen(true)}
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Event
            </Button>
            
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Event Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CALENDAR_EVENT_TYPES.ALL}>All Events</SelectItem>
                <SelectItem value={CALENDAR_EVENT_TYPES.CAPITAL_CALLS}>Capital Calls</SelectItem>
                <SelectItem value={CALENDAR_EVENT_TYPES.CLOSING_EVENTS}>Closing Events</SelectItem>
                <SelectItem value={CALENDAR_EVENT_TYPES.MEETINGS}>Deal Meetings</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-6 h-full">
          {/* Calendar */}
          <Card className="h-full w-full flex flex-col">
            <CardContent className="p-0 flex flex-col flex-grow">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md w-full flex-1"
                weekStartsOn={0}
                showOutsideDays
                ISOWeek
                components={{
                  Day: (props) => {
                    // Using a custom Day component to show events
                    return (
                      <button 
                        onClick={() => {
                          // Handle the click event manually
                          setSelectedDate(props.date);
                        }} 
                        className="w-full h-full p-2 my-0.5 aspect-square font-normal text-base rounded-md flex items-center justify-center transition-colors hover:bg-neutral-100"
                      >
                        {renderDay(props.date)}
                      </button>
                    );
                  },
                }}
              />
              <div className="p-4 mt-auto text-sm text-neutral-600 bg-gray-50 border-t">
                <h3 className="text-xs uppercase font-semibold text-muted-foreground mb-2">Legend</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {(activeTab === CALENDAR_EVENT_TYPES.ALL || activeTab === CALENDAR_EVENT_TYPES.CAPITAL_CALLS) && (
                    <>
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${CALENDAR_INDICATOR_COLORS.CALL}`}></div>
                        <span>Capital Call</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${CALENDAR_INDICATOR_COLORS.DUE}`}></div>
                        <span>Due Date</span>
                      </div>
                    </>
                  )}
                  {(activeTab === CALENDAR_EVENT_TYPES.ALL || activeTab === CALENDAR_EVENT_TYPES.CLOSING_EVENTS) && (
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${CALENDAR_INDICATOR_COLORS.CLOSING}`}></div>
                      <span>Closing Event</span>
                    </div>
                  )}
                  {(activeTab === CALENDAR_EVENT_TYPES.ALL || activeTab === CALENDAR_EVENT_TYPES.MEETINGS) && (
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${CALENDAR_INDICATOR_COLORS.MEETING}`}></div>
                      <span>Deal Meeting</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Events for selected date */}
          <div>
            {selectedDate && (
              <div className="flex items-center justify-between mb-4">
                <Button variant="outline" size="icon" onClick={prevDate}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-xl font-semibold">
                  {format(selectedDate, DATE_FORMATS.FULL)}
                </h2>
                <Button variant="outline" size="icon" onClick={nextDate}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
            
            {/* Show status filter based on active tab */}
            <div className="mb-4">
              {activeTab === CALENDAR_EVENT_TYPES.CAPITAL_CALLS && (
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {Object.entries(CAPITAL_CALL_STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              {activeTab === CALENDAR_EVENT_TYPES.CLOSING_EVENTS && (
                <>
                  <div className="flex gap-2 mb-2">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        {Object.entries(CLOSING_EVENT_STATUS_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {Object.entries(CLOSING_EVENT_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>
            
            <div className="space-y-4">
              {isLoading ? (
                <div className="flex justify-center my-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <>

                
                  {/* Capital Calls */}
                  {(activeTab === CALENDAR_EVENT_TYPES.ALL || activeTab === CALENDAR_EVENT_TYPES.CAPITAL_CALLS) && (
                    <>
                      {filteredCalls.length > 0 && (
                        <div>
                          <h3 className="text-base font-semibold mb-2 flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${CALENDAR_INDICATOR_COLORS.CALL}`}></div>
                            Capital Calls
                          </h3>
                          <div className="space-y-2">
                            {filteredCalls.map(call => (
                              <Card 
                                key={call.id} 
                                className="overflow-hidden border-l-4 border-l-blue-500 cursor-pointer hover:bg-gray-50" 
                                onClick={() => {
                                  // Navigate to deal detail with capital calls tab selected using wouter
                                  setLocation(`/deals/${call.dealId}?tab=capitalcalls`);
                                }}
                              >
                                <CardContent className="p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="font-medium">{call.dealName}</div>
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-xs">
                                        {CAPITAL_CALL_STATUS_LABELS[call.status]}
                                      </Badge>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-6 w-6" 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEventToEdit({
                                            type: 'capital-call',
                                            id: call.id
                                          });
                                          setIsEventFormOpen(true);
                                        }}
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                          <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                                          <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
                                        </svg>
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate">Fund: {call.fundName}</div>
                                  <div className="flex justify-between items-center mt-2">
                                    <div className="text-sm">
                                      <span className="font-medium">Amount:</span> {formatAmountByType(call.callAmount, call.amountType)}
                                    </div>
                                    
                                    <div className="text-xs text-muted-foreground flex flex-col gap-1">
                                      <span>Call Date: {formatDate(call.callDate)}</span>
                                      <span>Due: {formatDate(call.dueDate)}</span>
                                      {call.paidDate && (
                                        <span>Paid: {formatDate(call.paidDate)}</span>
                                      )}
                                    </div>
                                  </div>
                                  {call.notes && (
                                    <div className="mt-2 text-xs border-t pt-2 text-muted-foreground line-clamp-2">
                                      {call.notes}
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  
                  {/* Closing Events */}
                  {(activeTab === CALENDAR_EVENT_TYPES.ALL || activeTab === CALENDAR_EVENT_TYPES.CLOSING_EVENTS) && (
                    <>
                      {filteredClosingEvents.length > 0 && (
                        <div className="mt-4">
                          <h3 className="text-base font-semibold mb-2 flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${CALENDAR_INDICATOR_COLORS.CLOSING}`}></div>
                            Closing Events
                          </h3>
                          <div className="space-y-2">
                            {filteredClosingEvents.map(event => (
                              <Card key={event.id} className="overflow-hidden border-l-4 border-l-purple-500">
                                <CardContent className="p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="font-medium">{event.eventName}</div>
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-xs">
                                        {CLOSING_EVENT_STATUS_LABELS[event.status]}
                                      </Badge>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-6 w-6" 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEventToEdit({
                                            type: 'closing-event',
                                            id: event.id
                                          });
                                          setIsEventFormOpen(true);
                                        }}
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                          <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                                          <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
                                        </svg>
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate">Deal: {event.dealName}</div>
                                  <div className="text-xs text-muted-foreground">Type: {CLOSING_EVENT_TYPE_LABELS[event.eventType]}</div>
                                  
                                  <div className="flex justify-between mt-2 items-center">
                                    {event.targetAmount && (
                                      <div className="text-sm">
                                        <span className="font-medium">Target:</span> {formatAmountByType(event.targetAmount, event.amountType)}
                                      </div>
                                    )}
                                    
                                    <div className="text-xs text-muted-foreground flex flex-col gap-1">
                                      <span>Scheduled: {formatDate(event.scheduledDate)}</span>
                                      {event.actualDate && (
                                        <span>Actual: {formatDate(event.actualDate)}</span>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {event.notes && (
                                    <div className="mt-2 text-xs border-t pt-2 text-muted-foreground line-clamp-2">
                                      {event.notes}
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  
                  {/* Meetings */}
                  {(activeTab === CALENDAR_EVENT_TYPES.ALL || activeTab === CALENDAR_EVENT_TYPES.MEETINGS) && (
                    <>
                      {filteredMeetings.length > 0 && (
                        <div className="mt-4">
                          <h3 className="text-base font-semibold mb-2 flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${CALENDAR_INDICATOR_COLORS.MEETING}`}></div>
                            Deal Meetings
                          </h3>
                          <div className="space-y-2">
                            {filteredMeetings.map(meeting => (
                              <Card key={meeting.id} className="overflow-hidden border-l-4 border-l-pink-500">
                                <CardContent className="p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="font-medium">{meeting.title}</div>
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-xs">
                                        Meeting
                                      </Badge>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-6 w-6" 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEventToEdit({
                                            type: 'meeting',
                                            id: meeting.id
                                          });
                                          setIsEventFormOpen(true);
                                        }}
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                          <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                                          <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
                                        </svg>
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate">Deal: {meeting.dealName}</div>
                                  
                                  <div className="flex justify-between items-center mt-2">
                                    <div className="text-sm">
                                      <span className="font-medium">Time:</span> {format(new Date(meeting.date), 'h:mm a')}
                                    </div>
                                  </div>
                                  
                                  {meeting.attendees && (
                                    <div className="mt-2 text-xs text-muted-foreground truncate max-w-full">
                                      <span className="font-medium">Attendees:</span> {meeting.attendees}
                                    </div>
                                  )}
                                  
                                  {meeting.notes && (
                                    <div className="mt-2 text-xs border-t pt-2 text-muted-foreground line-clamp-2">
                                      {meeting.notes}
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  
                  {/* Show unified empty state when no events are found */}
                  {((activeTab === CALENDAR_EVENT_TYPES.CAPITAL_CALLS && filteredCalls.length === 0) ||
                    (activeTab === CALENDAR_EVENT_TYPES.CLOSING_EVENTS && filteredClosingEvents.length === 0) ||
                    (activeTab === CALENDAR_EVENT_TYPES.MEETINGS && filteredMeetings.length === 0) ||
                    (activeTab === CALENDAR_EVENT_TYPES.ALL && filteredCalls.length === 0 && 
                     filteredClosingEvents.length === 0 && filteredMeetings.length === 0)) && (
                    <Card className="border-dashed">
                      <CardContent className="py-8 flex flex-col items-center justify-center text-center">
                        <div className="rounded-full bg-muted p-3 mb-3">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground h-6 w-6">
                            <rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect>
                            <line x1="16" x2="16" y1="2" y2="6"></line>
                            <line x1="8" x2="8" y1="2" y2="6"></line>
                            <line x1="3" x2="21" y1="10" y2="10"></line>
                          </svg>
                        </div>
                        <h3 className="font-medium text-lg">No events scheduled</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {selectedDate ? `No events found for ${format(selectedDate, 'MMM d, yyyy')}.` : 'No events found for this date.'}
                        </p>
                        <Button 
                          onClick={() => setIsEventFormOpen(true)}
                          size="sm"
                          variant="outline"
                          className="mt-4"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Event
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Render the unified event form */}
      <UnifiedEventForm
        isOpen={isEventFormOpen}
        onClose={() => {
          setIsEventFormOpen(false);
          setEventToEdit(null);
        }}
        selectedDate={selectedDate}
        eventToEdit={eventToEdit}
      />
    </AppLayout>
  );
};

export default CalendarPage;