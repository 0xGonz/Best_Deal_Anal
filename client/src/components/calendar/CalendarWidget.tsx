import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isToday, isPast } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, DollarSign, FileText, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  CALENDAR_EVENT_TYPES,
  CALENDAR_HIGHLIGHT_COLORS,
  CALENDAR_INDICATOR_COLORS 
} from '@/lib/constants/calendar-constants';
import { CAPITAL_CALL_STATUS_COLORS, CAPITAL_CALL_STATUS_LABELS } from '@/lib/constants/capital-call-constants';
import { CLOSING_EVENT_STATUS_COLORS } from '@/lib/constants/closing-event-constants';
import { formatCurrency } from '@/lib/utils/formatters';

interface CalendarWidgetProps {
  /** Compact mode shows mini calendar, full mode shows detailed view */
  mode?: 'compact' | 'full';
  /** Height constraint for the widget */
  height?: string;
  /** Optional deal filter to show only events for specific deal */
  dealId?: number;
  /** Show upcoming events list */
  showUpcoming?: boolean;
  /** Event type filter */
  eventTypes?: string[];
  /** Click handler for calendar events */
  onEventClick?: (event: CalendarEvent) => void;
}

interface CalendarEvent {
  id: number;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  eventType: string;
  status: string;
  dealId?: number;
  metadata?: any;
}

export default function CalendarWidget({
  mode = 'compact',
  height = '400px',
  dealId,
  showUpcoming = true,
  eventTypes = ['all'],
  onEventClick
}: CalendarWidgetProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentWeek, setCurrentWeek] = useState(new Date());

  // Fetch calendar events with optional filtering
  const { data: calendarData, isLoading } = useQuery({
    queryKey: ['/api/calendar/events', dealId, eventTypes],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dealId) params.append('dealId', dealId.toString());
      if (eventTypes.length && !eventTypes.includes('all')) {
        eventTypes.forEach(type => params.append('eventTypes', type));
      }
      
      const response = await fetch(`/api/calendar/events?${params}`);
      if (!response.ok) throw new Error('Failed to fetch calendar events');
      return response.json();
    }
  });

  const events: CalendarEvent[] = calendarData?.events || [];

  // Get events for selected date
  const selectedDateEvents = events.filter(event => {
    const eventDate = new Date(event.startDate).toDateString();
    return eventDate === selectedDate.toDateString();
  });

  // Get upcoming events (next 7 days)
  const upcomingEvents = events
    .filter(event => {
      const eventDate = new Date(event.startDate);
      const today = new Date();
      const weekFromNow = addDays(today, 7);
      return eventDate >= today && eventDate <= weekFromNow;
    })
    .slice(0, 5);

  // Get current week days for compact view
  const weekDays = eachDayOfInterval({
    start: startOfWeek(currentWeek),
    end: endOfWeek(currentWeek)
  });

  // Get events count for each day
  const getEventsForDay = (date: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.startDate).toDateString();
      return eventDate === date.toDateString();
    });
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'meeting':
        return <Users className="h-3 w-3" />;
      case 'capital_call':
        return <DollarSign className="h-3 w-3" />;
      case 'closing_first':
      case 'closing_final':
        return <FileText className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  const getEventColor = (event: CalendarEvent) => {
    switch (event.eventType) {
      case 'meeting':
        return 'bg-pink-100 text-pink-800 border-pink-200';
      case 'capital_call':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'closing_first':
      case 'closing_final':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (mode === 'compact') {
    return (
      <Card className="w-full" style={{ height }}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Calendar
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentWeek(subDays(currentWeek, 7))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentWeek(addDays(currentWeek, 7))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Week of {format(startOfWeek(currentWeek), 'MMM d, yyyy')}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mini Week Calendar */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
              <div key={index} className="text-xs font-medium text-muted-foreground p-1">
                {day}
              </div>
            ))}
            {weekDays.map((day, index) => {
              const dayEvents = getEventsForDay(day);
              const isSelected = selectedDate.toDateString() === day.toDateString();
              
              return (
                <TooltipProvider key={index}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setSelectedDate(day)}
                        className={`relative p-2 text-sm rounded-md transition-colors hover:bg-gray-100 ${
                          isSelected 
                            ? 'bg-primary text-primary-foreground' 
                            : isToday(day) 
                            ? 'bg-accent text-accent-foreground font-medium'
                            : isPast(day) 
                            ? 'text-muted-foreground' 
                            : ''
                        }`}
                      >
                        {format(day, 'd')}
                        {dayEvents.length > 0 && (
                          <div className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 bg-primary rounded-full"></div>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{format(day, 'MMM d, yyyy')}</p>
                      {dayEvents.length > 0 && (
                        <p className="text-xs">{dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>

          {/* Selected Date Events */}
          {selectedDateEvents.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">
                {format(selectedDate, 'MMM d, yyyy')} Events
              </h4>
              <ScrollArea className="h-24">
                <div className="space-y-1">
                  {selectedDateEvents.map((event) => (
                    <div
                      key={event.id}
                      onClick={() => onEventClick?.(event)}
                      className={`p-2 rounded-md border text-xs cursor-pointer hover:opacity-80 transition-opacity ${getEventColor(event)}`}
                    >
                      <div className="flex items-center gap-1 mb-1">
                        {getEventIcon(event.eventType)}
                        <span className="font-medium truncate">{event.title}</span>
                      </div>
                      {event.metadata?.callAmount && (
                        <p className="text-xs opacity-75">
                          {formatCurrency(event.metadata.callAmount)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Upcoming Events */}
          {showUpcoming && upcomingEvents.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Upcoming This Week</h4>
              <ScrollArea className="h-20">
                <div className="space-y-1">
                  {upcomingEvents.map((event) => (
                    <div
                      key={event.id}
                      onClick={() => onEventClick?.(event)}
                      className="flex items-center justify-between p-1.5 rounded hover:bg-gray-50 cursor-pointer text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {getEventIcon(event.eventType)}
                        <span className="truncate">{event.title}</span>
                      </div>
                      <span className="text-muted-foreground whitespace-nowrap ml-1">
                        {format(new Date(event.startDate), 'MMM d')}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Full mode implementation would go here
  return (
    <Card className="w-full" style={{ height }}>
      <CardHeader>
        <CardTitle>Full Calendar View</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Full calendar implementation</p>
      </CardContent>
    </Card>
  );
}