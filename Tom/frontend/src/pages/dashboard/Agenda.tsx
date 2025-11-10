import { useEffect, useMemo, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarPlus, Trash2, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string; // ISO date string (yyyy-MM-dd)
  time?: string;
}

const STORAGE_KEY = 'dashboard-agenda-events';

export function Agenda() {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: CalendarEvent[] = JSON.parse(stored);
        setEvents(parsed);
      }
    } catch (error) {
      console.error('Erro ao carregar eventos da agenda:', error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  }, [events]);

  const daysInCalendar = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  const eventsByDate = useMemo(() => {
    return events.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
      const key = event.date;
      if (!acc[key]) acc[key] = [];
      acc[key].push(event);
      return acc;
    }, {});
  }, [events]);

  const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');
  const eventsForSelectedDate = eventsByDate[selectedDateKey] || [];

  const handleAddEvent = () => {
    if (!title.trim()) return;
    const newEvent: CalendarEvent = {
      id: crypto.randomUUID(),
      title: title.trim(),
      description: description.trim() || undefined,
      date: selectedDateKey,
      time: time || undefined,
    };
    setEvents((prev) => [...prev, newEvent]);
    setTitle('');
    setTime('');
    setDescription('');
  };

  const handleDeleteEvent = (id: string) => {
    setEvents((prev) => prev.filter((event) => event.id !== id));
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Agenda</h1>
            <p className="text-gray-600 mt-1">
              Organize eventos e compromissos do mês.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="px-4 py-2 bg-gray-100 rounded-lg text-gray-900 font-medium">
              {format(currentMonth, "LLLL 'de' yyyy", { locale: ptBR })}
            </div>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100"
              aria-label="Próximo mês"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
        {/* Calendar Grid */}
        <div className="flex-1 border-b lg:border-b-0 lg:border-r border-gray-200 overflow-y-auto p-6">
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase text-gray-500">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
              <div key={day} className="py-1">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2 mt-2 text-sm">
            {daysInCalendar.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const hasEvents = !!eventsByDate[key];
              const isSelected = isSameDay(day, selectedDate);
              const isCurrentMonth = isSameMonth(day, currentMonth);

              return (
                <button
                  key={key}
                  onClick={() => setSelectedDate(day)}
                  className={[
                    'aspect-square rounded-lg border hover:border-blue-500 transition-colors flex flex-col items-center justify-center gap-1',
                    isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200',
                    !isCurrentMonth ? 'text-gray-400' : 'text-gray-900',
                  ].join(' ')}
                >
                  <span className="font-medium">{format(day, 'd')}</span>
                  {hasEvents && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sidebar events */}
        <div className="w-full lg:w-96 flex-shrink-0 overflow-y-auto p-6 bg-gray-50 border-t lg:border-t-0">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <CalendarPlus className="w-5 h-5" />
              Novo evento
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Título
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Reunião com cliente"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Horário (opcional)
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data
                  </label>
                  <input
                    type="date"
                    value={selectedDateKey}
                    onChange={(e) => setSelectedDate(parseISO(e.target.value))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observações (opcional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                  placeholder="Adicione detalhes importantes"
                />
              </div>
              <button
                onClick={handleAddEvent}
                disabled={!title.trim()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
              >
                Adicionar evento
              </button>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Eventos do dia
            </h2>
            {eventsForSelectedDate.length === 0 ? (
              <div className="rounded-md border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-500">
                Nenhum evento agendado para este dia.
              </div>
            ) : (
              <ul className="space-y-3">
                {eventsForSelectedDate
                  .slice()
                  .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
                  .map((event) => (
                    <li key={event.id} className="rounded-md bg-white border border-gray-200 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900">
                            {event.title}
                          </h3>
                          {event.time && (
                            <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                              <Clock className="w-3 h-3" />
                              <span>{event.time}</span>
                            </div>
                          )}
                          {event.description && (
                            <p className="mt-2 text-sm text-gray-600 whitespace-pre-line">
                              {event.description}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteEvent(event.id)}
                          className="text-red-500 hover:text-red-600 transition-colors"
                          title="Excluir evento"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

