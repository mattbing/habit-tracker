import type { FC } from 'hono/jsx';
import { getMonthDays, getMonthName, getPrevMonth, getNextMonth } from '../utils/date';

interface CalendarProps {
  habitId: number;
  habitName: string;
  year: number;
  month: number;
  completedDates: Set<string>;
}

export const Calendar: FC<CalendarProps> = ({ habitId, habitName, year, month, completedDates }) => {
  const days = getMonthDays(year, month);
  const monthName = getMonthName(month);
  const prevMonth = getPrevMonth(year, month);
  const nextMonth = getNextMonth(year, month);
  const today = new Date().toISOString().split('T')[0];

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div class="flex items-center justify-between mb-6">
        <a
          href={`/habits/${habitId}/calendar?month=${prevMonth}`}
          class="p-2 hover:bg-gray-100 rounded-lg text-gray-600 hover:text-gray-800"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </a>
        <h3 class="text-lg font-semibold text-gray-800">
          {monthName} {year}
        </h3>
        <a
          href={`/habits/${habitId}/calendar?month=${nextMonth}`}
          class="p-2 hover:bg-gray-100 rounded-lg text-gray-600 hover:text-gray-800"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>

      <div class="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map(day => (
          <div class="text-center text-xs font-medium text-gray-500 py-2">
            {day}
          </div>
        ))}
      </div>

      <div class="grid grid-cols-7 gap-1">
        {days.map(({ date, day, isCurrentMonth }) => {
          const isCompleted = completedDates.has(date);
          const isToday = date === today;

          return (
            <div
              class={`
                aspect-square flex items-center justify-center text-sm rounded-lg
                ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}
                ${isCompleted && isCurrentMonth ? 'bg-green-500 text-white font-medium' : ''}
                ${isToday && isCurrentMonth && !isCompleted ? 'ring-2 ring-blue-500 ring-inset' : ''}
                ${isCurrentMonth && !isCompleted ? 'hover:bg-gray-100' : ''}
              `}
            >
              {day}
            </div>
          );
        })}
      </div>

      <div class="mt-6 flex items-center gap-4 text-sm text-gray-600">
        <div class="flex items-center gap-2">
          <div class="w-4 h-4 rounded bg-green-500"></div>
          <span>Completed</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-4 h-4 rounded ring-2 ring-blue-500 ring-inset"></div>
          <span>Today</span>
        </div>
      </div>
    </div>
  );
};
