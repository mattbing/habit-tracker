import type { FC } from "hono/jsx";

interface LayoutProps {
  title: string;
  children: any;
  username?: string;
}

export const Layout: FC<LayoutProps> = ({ title, children, username }) => {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title} - Habit Tracker</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;500;600&family=DM+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://unpkg.com/htmx.org@1.9.12"></script>
        <script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
          tailwind.config = {
            theme: {
              extend: {
                fontFamily: {
                  'display': ['Crimson Pro', 'Georgia', 'serif'],
                  'body': ['DM Sans', 'system-ui', 'sans-serif'],
                },
                colors: {
                  'night': {
                    950: '#0C0A09',
                    900: '#1C1917',
                    800: '#292524',
                    700: '#44403C',
                    600: '#57534E',
                  },
                  'warm': {
                    50: '#FAFAF9',
                    100: '#F5F5F4',
                    200: '#E7E5E4',
                    300: '#D6D3D1',
                    400: '#A8A29E',
                    500: '#78716C',
                  },
                  'ember': {
                    400: '#FB923C',
                    500: '#F97316',
                    600: '#EA580C',
                  },
                  'moss': {
                    400: '#4ADE80',
                    500: '#22C55E',
                    600: '#16A34A',
                    700: '#15803D',
                  },
                  'clay': {
                    400: '#F87171',
                    500: '#EF4444',
                  }
                }
              }
            }
          }
        `,
          }}
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `
          .htmx-request { opacity: 0.6; transition: opacity 150ms ease-out; }
          .htmx-indicator { display: none; }
          .htmx-request .htmx-indicator { display: inline; }
          .htmx-request.htmx-indicator { display: inline; }

          /* Subtle grain texture */
          .grain-texture {
            position: relative;
          }
          .grain-texture::before {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
            opacity: 0.03;
            pointer-events: none;
            z-index: 1000;
          }

          /* Drag handle styling */
          .drag-handle {
            cursor: grab;
            touch-action: none;
          }
          .drag-handle:active {
            cursor: grabbing;
          }

          /* Sortable ghost */
          .sortable-ghost {
            opacity: 0.4;
            background: #292524 !important;
          }
          .sortable-chosen {
            box-shadow: 0 8px 32px -8px rgba(0,0,0,0.4);
          }
          .sortable-drag {
            box-shadow: 0 12px 40px -8px rgba(0,0,0,0.5);
          }

          /* Smooth hover transitions */
          .habit-card {
            transition: transform 200ms ease, box-shadow 200ms ease, background-color 200ms ease;
          }
          .habit-card:hover {
            transform: translateY(-1px);
          }

          /* Stagger animation for page load */
          @keyframes fadeSlideIn {
            from {
              opacity: 0;
              transform: translateY(8px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .animate-in {
            animation: fadeSlideIn 400ms ease-out forwards;
          }
          .delay-1 { animation-delay: 50ms; opacity: 0; }
          .delay-2 { animation-delay: 100ms; opacity: 0; }
          .delay-3 { animation-delay: 150ms; opacity: 0; }
          .delay-4 { animation-delay: 200ms; opacity: 0; }
        `,
          }}
        />
      </head>
      <body class="bg-night-950 min-h-screen font-body text-warm-200 grain-texture">
        <nav class="bg-night-900/80 border-b border-night-700/50 backdrop-blur-sm sticky top-0 z-50">
          <div class="max-w-2xl mx-auto px-6 py-4 flex justify-between items-center">
            <a
              href="/"
              class="font-display text-2xl font-medium text-warm-100 tracking-tight hover:text-ember-400 transition-colors"
            >
              Habits
            </a>
            {username && (
              <div class="flex items-center gap-5">
                <span class="text-warm-400 text-sm">{username}</span>
                <form action="/logout" method="post">
                  <button
                    type="submit"
                    class="text-sm text-warm-400 hover:text-ember-400 transition-colors"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            )}
          </div>
        </nav>
        <main class="max-w-2xl mx-auto px-6 py-10">{children}</main>

        <script
          dangerouslySetInnerHTML={{
            __html: `
          // Initialize sortable on habit list
          document.addEventListener('DOMContentLoaded', function() {
            const habitList = document.getElementById('habit-list');
            if (habitList) {
              new Sortable(habitList, {
                animation: 200,
                handle: '.drag-handle',
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                dragClass: 'sortable-drag',
                easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                onEnd: function(evt) {
                  const items = habitList.querySelectorAll('[data-habit-id]');
                  const order = Array.from(items).map(item => item.dataset.habitId);

                  fetch('/habits/reorder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ order })
                  });
                }
              });
            }
          });

          // Set local date cookie and send with HTMX requests
          function getLocalDateString() {
            const today = new Date();
            return today.getFullYear() + '-' +
              String(today.getMonth() + 1).padStart(2, '0') + '-' +
              String(today.getDate()).padStart(2, '0');
          }

          // Set cookie so server can read local date on page loads
          document.cookie = 'localDate=' + getLocalDateString() + ';path=/;SameSite=Lax';

          // Send user's local date with every HTMX request
          document.body.addEventListener('htmx:configRequest', function(evt) {
            evt.detail.headers['X-Local-Date'] = getLocalDateString();
          });

          // Re-initialize after HTMX swaps
          document.body.addEventListener('htmx:afterSwap', function(evt) {
            const habitList = document.getElementById('habit-list');
            if (habitList && !habitList.sortable) {
              new Sortable(habitList, {
                animation: 200,
                handle: '.drag-handle',
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                dragClass: 'sortable-drag',
                easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                onEnd: function(evt) {
                  const items = habitList.querySelectorAll('[data-habit-id]');
                  const order = Array.from(items).map(item => item.dataset.habitId);

                  fetch('/habits/reorder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ order })
                  });
                }
              });
            }
          });
        `,
          }}
        />
      </body>
    </html>
  );
};
