import type { FC } from 'hono/jsx';

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
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://unpkg.com/htmx.org@1.9.12"></script>
        <style>{`
          .htmx-request { opacity: 0.5; }
          .htmx-indicator { display: none; }
          .htmx-request .htmx-indicator { display: inline; }
          .htmx-request.htmx-indicator { display: inline; }
        `}</style>
      </head>
      <body class="bg-gray-900 min-h-screen text-gray-100">
        <nav class="bg-gray-800 border-b border-gray-700">
          <div class="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
            <a href="/" class="text-xl font-semibold text-gray-100 hover:text-gray-300">
              Habit Tracker
            </a>
            {username && (
              <div class="flex items-center gap-4">
                <span class="text-gray-400">Hi, {username}</span>
                <form action="/logout" method="post">
                  <button
                    type="submit"
                    class="text-sm text-gray-400 hover:text-gray-200"
                  >
                    Logout
                  </button>
                </form>
              </div>
            )}
          </div>
        </nav>
        <main class="max-w-4xl mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
};
