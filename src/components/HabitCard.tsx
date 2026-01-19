import type { FC } from "hono/jsx";
import { formatRelativeTime } from "../utils/date";

interface HabitCardProps {
  id: number;
  name: string;
  completedToday: boolean;
  lastTagged: string | null;
  isEditing?: boolean;
}

export const HabitCard: FC<HabitCardProps> = ({
  id,
  name,
  completedToday,
  lastTagged,
  isEditing = false,
}) => {
  const relativeTime = lastTagged ? formatRelativeTime(lastTagged) : null;

  return (
    <div
      id={`habit-${id}`}
      data-habit-id={id}
      class="habit-card bg-night-800/60 rounded-xl border border-night-700/50 px-4 py-4 flex items-center gap-3 hover:bg-night-800 group"
    >
      {/* Drag handle */}
      <div class="drag-handle flex-shrink-0 p-1 -ml-1 text-warm-500 hover:text-warm-400 transition-colors">
        <svg
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 8h16M4 16h16"
          />
        </svg>
      </div>

      {/* Toggle button */}
      <button
        hx-post={`/habits/${id}/toggle`}
        hx-target={`#habit-${id}`}
        hx-swap="outerHTML"
        class={`
          flex-shrink-0 w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all duration-200
          ${
            completedToday
              ? "bg-moss-500 border-moss-500 text-night-950 shadow-sm shadow-moss-500/25"
              : "border-night-600 hover:border-moss-500 text-transparent hover:text-moss-500 bg-night-900/50"
          }
        `}
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2.5"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </button>

      {/* Habit name and last tagged - or edit form */}
      {isEditing ? (
        <form
          hx-post={`/habits/${id}/rename`}
          hx-target={`#habit-${id}`}
          hx-swap="outerHTML"
          class="flex-1 flex gap-2"
        >
          <input
            type="text"
            name="name"
            value={name}
            required
            autofocus
            class="flex-1 px-3 py-1.5 bg-night-900 border border-night-600 rounded-lg text-warm-100 text-sm focus:ring-2 focus:ring-ember-500/20 focus:border-ember-500 transition-colors"
          />
          <button
            type="submit"
            class="px-3 py-1.5 bg-ember-500 text-night-950 rounded-lg text-sm font-medium hover:bg-ember-400 transition-colors"
          >
            Save
          </button>
          <button
            type="button"
            hx-get={`/habits/${id}/card`}
            hx-target={`#habit-${id}`}
            hx-swap="outerHTML"
            class="px-3 py-1.5 text-warm-400 hover:text-warm-200 rounded-lg text-sm transition-colors"
          >
            Cancel
          </button>
        </form>
      ) : (
        <div class="flex-1 min-w-0 flex items-center gap-2">
          <div class="flex-1 min-w-0">
            <span
              class={`block font-medium transition-colors duration-200 ${
                completedToday ? "text-warm-400 line-through decoration-warm-500/50" : "text-warm-100"
              }`}
            >
              {name}
            </span>
            {relativeTime && (
              <span class="block text-xs text-warm-500 mt-0.5">{relativeTime}</span>
            )}
          </div>
          {/* Edit button - visible on hover */}
          <button
            hx-get={`/habits/${id}/edit`}
            hx-target={`#habit-${id}`}
            hx-swap="outerHTML"
            class="flex-shrink-0 p-1.5 text-warm-500 hover:text-ember-400 transition-colors rounded-lg hover:bg-night-700/50 opacity-0 group-hover:opacity-100"
            title="Rename habit"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Calendar link - hide when editing */}
      {!isEditing && (
        <a
          href={`/habits/${id}/calendar`}
          class="flex-shrink-0 p-2 text-warm-500 hover:text-ember-400 transition-colors rounded-lg hover:bg-night-700/50"
          title="View calendar"
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
              stroke-width="1.5"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </a>
      )}
    </div>
  );
};

interface HabitListProps {
  habits: Array<{
    id: number;
    name: string;
    completedToday: boolean;
    lastTagged: string | null;
  }>;
}

export const HabitList: FC<HabitListProps> = ({ habits }) => {
  return (
    <div id="habit-list" class="space-y-2">
      {habits.length === 0 ? (
        <div class="text-center py-12">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-night-800 mb-4">
            <svg
              class="w-8 h-8 text-warm-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
          </div>
          <p class="text-warm-300 font-medium">No habits yet</p>
          <p class="text-warm-500 text-sm mt-1">
            Add your first habit below to get started
          </p>
        </div>
      ) : (
        habits.map((habit, index) => (
          <div
            class={`animate-in ${index === 0 ? "delay-1" : ""} ${index === 1 ? "delay-2" : ""} ${index === 2 ? "delay-3" : ""} ${index >= 3 ? "delay-4" : ""}`}
          >
            <HabitCard
              id={habit.id}
              name={habit.name}
              completedToday={habit.completedToday}
              lastTagged={habit.lastTagged}
            />
          </div>
        ))
      )}
    </div>
  );
};
