import type { FC } from "hono/jsx";
import {
  getMonthDays,
  getMonthName,
  getPrevMonth,
  getNextMonth,
} from "../utils/date";

interface CalendarProps {
  habitId: number;
  habitName: string;
  year: number;
  month: number;
  completedDates: Set<string>;
}

export const Calendar: FC<CalendarProps> = ({
  habitId,
  habitName,
  year,
  month,
  completedDates,
}) => {
  const days = getMonthDays(year, month);
  const monthName = getMonthName(month);
  const prevMonth = getPrevMonth(year, month);
  const nextMonth = getNextMonth(year, month);
  const today = new Date().toISOString().split("T")[0];

  const weekDays = ["S", "M", "T", "W", "T", "F", "S"];

  // Calculate completion stats for the month
  const currentMonthDays = days.filter((d) => d.isCurrentMonth);
  const completedThisMonth = currentMonthDays.filter((d) =>
    completedDates.has(d.date)
  ).length;

  return (
    <div
      id="calendar-container"
      class="bg-night-800/60 rounded-2xl border border-night-700/50 p-6"
    >
      {/* Month navigation - using HTMX for fast partial updates */}
      <div class="flex items-center justify-between mb-6">
        <button
          hx-get={`/habits/${habitId}/calendar/partial?month=${prevMonth}`}
          hx-target="#calendar-container"
          hx-swap="outerHTML"
          class="p-2 hover:bg-night-700/50 rounded-xl text-warm-400 hover:text-warm-200 transition-colors"
        >
          <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <div class="text-center">
          <h3 class="font-display text-xl font-medium text-warm-100">
            {monthName} {year}
          </h3>
          <p class="text-xs text-warm-500 mt-0.5">
            {completedThisMonth} of {currentMonthDays.length} days
          </p>
        </div>
        <button
          hx-get={`/habits/${habitId}/calendar/partial?month=${nextMonth}`}
          hx-target="#calendar-container"
          hx-swap="outerHTML"
          class="p-2 hover:bg-night-700/50 rounded-xl text-warm-400 hover:text-warm-200 transition-colors"
        >
          <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      {/* Weekday headers */}
      <div class="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((day) => (
          <div class="text-center text-xs font-medium text-warm-500 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div class="grid grid-cols-7 gap-1">
        {days.map(({ date, day, isCurrentMonth }) => {
          const isCompleted = completedDates.has(date);
          const isToday = date === today;

          return (
            <div
              class={`
                aspect-square flex items-center justify-center text-sm rounded-xl transition-colors
                ${!isCurrentMonth ? "text-warm-500/30" : "text-warm-300"}
                ${isCompleted && isCurrentMonth ? "bg-moss-500 text-night-950 font-medium" : ""}
                ${isToday && isCurrentMonth && !isCompleted ? "ring-2 ring-ember-500 ring-inset text-ember-400 font-medium" : ""}
                ${isCurrentMonth && !isCompleted ? "hover:bg-night-700/50" : ""}
              `}
            >
              {day}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div class="mt-6 pt-4 border-t border-night-700/50 flex items-center justify-center gap-6 text-xs text-warm-500">
        <div class="flex items-center gap-2">
          <div class="w-4 h-4 rounded-md bg-moss-500"></div>
          <span>Completed</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-4 h-4 rounded-md ring-2 ring-ember-500 ring-inset"></div>
          <span>Today</span>
        </div>
      </div>
    </div>
  );
};
