import type { FC } from 'hono/jsx';

interface HabitCardProps {
  id: number;
  name: string;
  completedToday: boolean;
}

export const HabitCard: FC<HabitCardProps> = ({ id, name, completedToday }) => {
  return (
    <div
      id={`habit-${id}`}
      class="bg-gray-800 rounded-lg border border-gray-700 p-4 flex items-center justify-between"
    >
      <div class="flex items-center gap-3">
        <button
          hx-post={`/habits/${id}/toggle`}
          hx-target={`#habit-${id}`}
          hx-swap="outerHTML"
          class={`
            w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors
            ${completedToday
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-gray-600 hover:border-green-400 text-transparent hover:text-green-400'
            }
          `}
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </button>
        <span class={`text-gray-100 ${completedToday ? 'line-through text-gray-500' : ''}`}>
          {name}
        </span>
      </div>

      <a
        href={`/habits/${id}/calendar`}
        class="text-sm text-blue-400 hover:text-blue-300 hover:underline"
      >
        View Calendar
      </a>
    </div>
  );
};

export const HabitList: FC<{ habits: Array<{ id: number; name: string; completedToday: boolean }> }> = ({ habits }) => {
  return (
    <div class="space-y-3">
      {habits.length === 0 ? (
        <p class="text-gray-400 text-center py-8">
          No habits yet. Create your first habit below!
        </p>
      ) : (
        habits.map(habit => (
          <HabitCard
            id={habit.id}
            name={habit.name}
            completedToday={habit.completedToday}
          />
        ))
      )}
    </div>
  );
};
