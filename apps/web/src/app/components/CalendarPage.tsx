import { useState } from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  Wallet,
  TrendingUp,
  Target,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Clock,
  MapPin,
  Bell
} from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { Button } from './ui/button';
import { useAuthGate, logoutAndRedirect } from '../hooks/useAuthGate';
import { Card, CardContent } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  addWeeks,
  addYears,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  startOfYear,
  setMonth,
  startOfDay,
  parseISO,
  getMonth,
  getDate,
  getYear
} from 'date-fns';

// Русская локализация
const monthNamesRu = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const monthNamesGenitiveRu = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];

const dayNamesRu = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const dayNamesFullRu = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

const formatRu = (date: Date, formatStr: string): string => {
  const month = getMonth(date);
  const day = getDate(date);
  const year = getYear(date);

  if (formatStr === 'MMMM') return monthNamesRu[month];
  if (formatStr === 'MMMM yyyy') return `${monthNamesRu[month]} ${year}`;
  if (formatStr === 'd MMMM yyyy') return `${day} ${monthNamesGenitiveRu[month]} ${year}`;
  if (formatStr === 'd MMM') return `${day} ${monthNamesGenitiveRu[month].slice(0, 3)}`;
  if (formatStr === 'd MMM yyyy') return `${day} ${monthNamesGenitiveRu[month].slice(0, 3)} ${year}`;
  if (formatStr === 'yyyy') return `${year}`;
  if (formatStr === 'd') return `${day}`;
  if (formatStr === 'EEE') {
    const dayOfWeek = date.getDay();
    return dayNamesRu[dayOfWeek === 0 ? 6 : dayOfWeek - 1];
  }

  return format(date, formatStr);
};

type ViewMode = 'year' | 'month' | 'week' | 'day';

interface CalendarEvent {
  id: string;
  title: string;
  type: 'event' | 'reminder';
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  description?: string;
  color?: string;
}

export function CalendarPage() {
  const { status } = useAuthGate();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [eventType, setEventType] = useState<'event' | 'reminder'>('event');
  const [events, setEvents] = useState<CalendarEvent[]>([
    {
      id: '1',
      title: 'Встреча с командой',
      type: 'event',
      startDate: '2026-05-07',
      endDate: '2026-05-07',
      startTime: '10:00',
      endTime: '11:30',
      location: 'Офис',
      color: 'var(--chart-1)',
      description: 'Обсуждение проекта anton-hub'
    },
    {
      id: '2',
      title: 'Оплатить счета',
      type: 'reminder',
      startDate: '2026-05-10',
      startTime: '09:00',
      color: 'var(--warning)'
    },
    {
      id: '3',
      title: 'День рождения',
      type: 'event',
      startDate: '2026-05-15',
      endDate: '2026-05-15',
      startTime: '18:00',
      color: 'var(--chart-5)'
    }
  ]);

  const [newEvent, setNewEvent] = useState<Partial<CalendarEvent>>({
    type: 'event',
    color: 'var(--chart-1)'
  });

  const modules = [
    { id: 'tasks', name: 'Задачи', icon: CheckSquare, path: '/tasks' },
    { id: 'finances', name: 'Финансы', icon: Wallet, path: '/finances' },
    { id: 'investments', name: 'Инвестиции', icon: TrendingUp, path: '/investments' },
    { id: 'fire', name: 'FIRE', icon: Target, path: '/fire' },
    { id: 'calendar', name: 'Календарь', icon: CalendarIcon, path: '/calendar' },
  ];

  const navigatePrevious = () => {
    switch (viewMode) {
      case 'year':
        setCurrentDate(addYears(currentDate, -1));
        break;
      case 'month':
        setCurrentDate(addMonths(currentDate, -1));
        break;
      case 'week':
        setCurrentDate(addWeeks(currentDate, -1));
        break;
      case 'day':
        setCurrentDate(addDays(currentDate, -1));
        break;
    }
  };

  const navigateNext = () => {
    switch (viewMode) {
      case 'year':
        setCurrentDate(addYears(currentDate, 1));
        break;
      case 'month':
        setCurrentDate(addMonths(currentDate, 1));
        break;
      case 'week':
        setCurrentDate(addWeeks(currentDate, 1));
        break;
      case 'day':
        setCurrentDate(addDays(currentDate, 1));
        break;
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const openEventDialog = (date?: Date) => {
    setSelectedDate(date || currentDate);
    setNewEvent({
      type: eventType,
      startDate: format(date || currentDate, 'yyyy-MM-dd'),
      color: 'var(--chart-1)'
    });
    setIsEventDialogOpen(true);
  };

  const saveEvent = () => {
    if (newEvent.title && newEvent.startDate) {
      const event: CalendarEvent = {
        id: Date.now().toString(),
        title: newEvent.title,
        type: newEvent.type || 'event',
        startDate: newEvent.startDate,
        endDate: newEvent.type === 'event' ? newEvent.endDate : undefined,
        startTime: newEvent.startTime,
        endTime: newEvent.type === 'event' ? newEvent.endTime : undefined,
        location: newEvent.location,
        description: newEvent.description,
        color: newEvent.color || 'var(--chart-1)'
      };
      setEvents([...events, event]);
      setIsEventDialogOpen(false);
      setNewEvent({ type: 'event', color: 'var(--chart-1)' });
    }
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventStart = parseISO(event.startDate);
      const eventEnd = event.endDate ? parseISO(event.endDate) : eventStart;
      return date >= startOfDay(eventStart) && date <= startOfDay(eventEnd);
    });
  };

  const renderYearView = () => {
    const yearStart = startOfYear(currentDate);
    const months = Array.from({ length: 12 }, (_, i) => setMonth(yearStart, i));

    return (
      <div className="grid grid-cols-3 md:grid-cols-4 gap-3 md:gap-4 p-3 md:p-4 overflow-y-auto max-h-[calc(100vh-200px)]">
        {months.map((month, index) => {
          const monthStart = startOfMonth(month);
          const monthEnd = endOfMonth(month);
          const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
          const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
          const days = [];
          let day = startDate;

          while (day <= endDate) {
            days.push(day);
            day = addDays(day, 1);
          }

          return (
            <Card key={index} className="p-2 md:p-3">
              <div className="text-center font-medium mb-2 text-xs md:text-sm">
                {formatRu(month, 'MMMM')}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {dayNamesRu.map((day, i) => (
                  <div key={i} className="text-center text-[10px] text-muted-foreground">
                    {day[0]}
                  </div>
                ))}
                {days.map((day, i) => {
                  const hasEvents = getEventsForDate(day).length > 0;
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        setCurrentDate(day);
                        setViewMode('day');
                      }}
                      className={`aspect-square text-[10px] rounded flex items-center justify-center relative
                        ${!isSameMonth(day, month) ? 'text-muted-foreground/40' : ''}
                        ${isToday(day) ? 'bg-primary text-primary-foreground font-medium' : 'hover:bg-accent'}
                      `}
                    >
                      {formatRu(day, 'd')}
                      {hasEvents && (
                        <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-chart-1" />
                      )}
                    </button>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = [];
    let day = startDate;

    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }

    const weeks = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    return (
      <div className="flex flex-col h-full p-3 md:p-4">
        <div className="grid grid-cols-7 gap-2 mb-2">
          {dayNamesFullRu.map(day => (
            <div key={day} className="text-center text-xs md:text-sm font-medium text-muted-foreground py-2">
              <span className="hidden md:inline">{day}</span>
              <span className="md:hidden">{day.slice(0, 2)}</span>
            </div>
          ))}
        </div>
        <div className="flex-1 flex flex-col gap-2">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 gap-2 flex-1">
              {week.map((day, dayIndex) => {
                const dayEvents = getEventsForDate(day);
                return (
                  <Card
                    key={dayIndex}
                    className={`p-2 min-h-[80px] md:min-h-[100px] cursor-pointer transition-colors
                      ${!isSameMonth(day, currentDate) ? 'opacity-40' : ''}
                      ${isToday(day) ? 'border-primary border-2' : ''}
                      hover:border-ring
                    `}
                    onClick={() => openEventDialog(day)}
                  >
                    <div className={`text-xs md:text-sm mb-1 ${isToday(day) ? 'font-bold text-primary' : ''}`}>
                      {formatRu(day, 'd')}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map(event => (
                        <div
                          key={event.id}
                          className="text-[10px] md:text-xs px-1.5 py-0.5 rounded truncate"
                          style={{ backgroundColor: event.color, color: 'white' }}
                        >
                          {event.startTime && `${event.startTime} `}
                          {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-[10px] text-muted-foreground">+{dayEvents.length - 3}</div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-1 border-b p-2 bg-card">
          <div />
          {days.map((day, i) => (
            <div key={i} className={`text-center ${isToday(day) ? 'text-primary font-bold' : ''}`}>
              <div className="text-xs text-muted-foreground">{formatRu(day, 'EEE')}</div>
              <div className="text-sm md:text-base">{formatRu(day, 'd')}</div>
            </div>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-1">
            {hours.map(hour => (
              <div key={hour} className="contents">
                <div className="text-xs text-right pr-2 py-4 text-muted-foreground">
                  {String(hour).padStart(2, '0')}:00
                </div>
                {days.map((day, dayIndex) => {
                  const hourEvents = events.filter(event => {
                    if (!isSameDay(parseISO(event.startDate), day)) return false;
                    if (!event.startTime) return false;
                    const eventHour = parseInt(event.startTime.split(':')[0]);
                    return eventHour === hour;
                  });

                  return (
                    <div
                      key={dayIndex}
                      className="border-l border-t p-1 min-h-[60px] hover:bg-accent cursor-pointer"
                      onClick={() => openEventDialog(day)}
                    >
                      {hourEvents.map(event => (
                        <div
                          key={event.id}
                          className="text-xs p-1 rounded mb-1 text-white"
                          style={{ backgroundColor: event.color }}
                        >
                          <div className="font-medium truncate">{event.title}</div>
                          <div className="text-[10px] opacity-90">
                            {event.startTime}
                            {event.endTime && ` - ${event.endTime}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const dayEvents = getEventsForDate(currentDate);

    return (
      <div className="flex flex-col md:flex-row gap-4 p-3 md:p-4 h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-[60px_1fr] gap-1">
            {hours.map(hour => {
              const hourEvents = dayEvents.filter(event => {
                if (!event.startTime) return false;
                const eventHour = parseInt(event.startTime.split(':')[0]);
                return eventHour === hour;
              });

              return (
                <div key={hour} className="contents">
                  <div className="text-xs text-right pr-2 py-4 text-muted-foreground">
                    {String(hour).padStart(2, '0')}:00
                  </div>
                  <div
                    className="border-l border-t p-2 min-h-[80px] hover:bg-accent cursor-pointer"
                    onClick={() => openEventDialog(currentDate)}
                  >
                    {hourEvents.map(event => (
                      <Card key={event.id} className="p-3 mb-2" style={{ borderLeftColor: event.color, borderLeftWidth: '4px' }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="font-medium mb-1">{event.title}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                              <Clock className="size-3" />
                              {event.startTime}
                              {event.endTime && ` - ${event.endTime}`}
                            </div>
                            {event.location && (
                              <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                                <MapPin className="size-3" />
                                {event.location}
                              </div>
                            )}
                            {event.description && (
                              <div className="text-sm mt-2">{event.description}</div>
                            )}
                          </div>
                          <Badge variant="outline">{event.type === 'event' ? 'Событие' : 'Напоминание'}</Badge>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <Card className="w-full md:w-64 p-4 h-fit">
          <h3 className="font-medium mb-3">События на {formatRu(currentDate, 'd MMMM yyyy')}</h3>
          <div className="space-y-2">
            {dayEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет событий</p>
            ) : (
              dayEvents.map(event => (
                <div
                  key={event.id}
                  className="p-2 rounded border-l-4"
                  style={{ borderLeftColor: event.color }}
                >
                  <div className="text-sm font-medium">{event.title}</div>
                  {event.startTime && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {event.startTime}
                      {event.endTime && ` - ${event.endTime}`}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="border-b bg-card">
        <div className="px-4 py-3 md:py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 md:gap-3">
              <Link to="/" className="flex items-center gap-2 md:gap-3">
                <div className="bg-primary text-primary-foreground p-1.5 md:p-2 rounded-lg">
                  <LayoutDashboard className="size-5 md:size-6" />
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-lg md:text-xl">anton-hub</h1>
                  <p className="text-xs md:text-sm text-muted-foreground">Личный центр управления</p>
                </div>
              </Link>
            </div>

            <div className="flex gap-1 md:gap-2 overflow-x-auto scrollbar-hide flex-1 justify-center">
              {modules.map((module) => {
                const Icon = module.icon;
                const isActive = module.id === 'calendar';
                return (
                  <Link key={module.id} to={module.path}>
                    <Button
                      variant={isActive ? 'default' : 'ghost'}
                      size="sm"
                      className="gap-1 md:gap-2 text-xs md:text-sm whitespace-nowrap h-8 md:h-9"
                    >
                      <Icon className="size-3 md:size-4" />
                      <span className="hidden xs:inline">{module.name}</span>
                    </Button>
                  </Link>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="md:h-9"
              onClick={() => logoutAndRedirect(navigate)}
            >
              <span className="hidden sm:inline">Выход</span>
              <X className="size-4 sm:hidden" />
            </Button>
          </div>
        </div>
      </header>

      <div className="border-b bg-card px-4 py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={navigatePrevious}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Сегодня
            </Button>
            <Button variant="outline" size="sm" onClick={navigateNext}>
              <ChevronRight className="size-4" />
            </Button>
            <h2 className="text-lg md:text-xl font-medium ml-2">
              {viewMode === 'year' && formatRu(currentDate, 'yyyy')}
              {viewMode === 'month' && formatRu(currentDate, 'MMMM yyyy')}
              {viewMode === 'week' && `${formatRu(startOfWeek(currentDate, { weekStartsOn: 1 }), 'd MMM')} - ${formatRu(endOfWeek(currentDate, { weekStartsOn: 1 }), 'd MMM yyyy')}`}
              {viewMode === 'day' && formatRu(currentDate, 'd MMMM yyyy')}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === 'year' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('year')}
                className="rounded-r-none text-xs"
              >
                Год
              </Button>
              <Button
                variant={viewMode === 'month' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('month')}
                className="rounded-none text-xs"
              >
                Месяц
              </Button>
              <Button
                variant={viewMode === 'week' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('week')}
                className="rounded-none text-xs"
              >
                Неделя
              </Button>
              <Button
                variant={viewMode === 'day' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('day')}
                className="rounded-l-none text-xs"
              >
                День
              </Button>
            </div>
            <Button size="sm" onClick={() => openEventDialog()} className="gap-2">
              <Plus className="size-4" />
              <span className="hidden sm:inline">Добавить</span>
            </Button>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-hidden">
        {viewMode === 'year' && renderYearView()}
        {viewMode === 'month' && renderMonthView()}
        {viewMode === 'week' && renderWeekView()}
        {viewMode === 'day' && renderDayView()}
      </main>

      <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Новое {eventType === 'event' ? 'событие' : 'напоминание'}</DialogTitle>
            <DialogDescription>
              Заполните информацию для создания {eventType === 'event' ? 'события' : 'напоминания'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Тип</Label>
              <Select
                value={newEvent.type || 'event'}
                onValueChange={(value: 'event' | 'reminder') => {
                  setEventType(value);
                  setNewEvent({ ...newEvent, type: value });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="event">Событие</SelectItem>
                  <SelectItem value="reminder">Напоминание</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Название</Label>
              <Input
                id="title"
                placeholder="Введите название"
                value={newEvent.title || ''}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Дата начала</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={newEvent.startDate || ''}
                  onChange={(e) => setNewEvent({ ...newEvent, startDate: e.target.value })}
                />
              </div>
              {newEvent.type === 'event' && (
                <div className="space-y-2">
                  <Label htmlFor="endDate">Дата окончания</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={newEvent.endDate || newEvent.startDate || ''}
                    onChange={(e) => setNewEvent({ ...newEvent, endDate: e.target.value })}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Время начала</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={newEvent.startTime || ''}
                  onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })}
                />
              </div>
              {newEvent.type === 'event' && (
                <div className="space-y-2">
                  <Label htmlFor="endTime">Время окончания</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={newEvent.endTime || ''}
                    onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })}
                  />
                </div>
              )}
            </div>

            {newEvent.type === 'event' && (
              <div className="space-y-2">
                <Label htmlFor="location">Место</Label>
                <Input
                  id="location"
                  placeholder="Введите место проведения"
                  value={newEvent.location || ''}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">Описание</Label>
              <Textarea
                id="description"
                placeholder="Добавьте описание"
                rows={3}
                value={newEvent.description || ''}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Цвет</Label>
              <div className="flex gap-2 flex-wrap">
                {[
                  'var(--chart-1)',
                  'var(--chart-2)',
                  'var(--chart-3)',
                  'var(--chart-4)',
                  'var(--chart-5)',
                  'var(--success)',
                  'var(--warning)',
                  'var(--danger)',
                  'var(--primary)',
                  'var(--muted-foreground)'
                ].map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewEvent({ ...newEvent, color })}
                    className={`size-8 rounded-full border-2 transition-all ${
                      newEvent.color === color ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEventDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={saveEvent}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
