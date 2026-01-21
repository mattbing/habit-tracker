import { Hono, type Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Env, Variables, User, Habit, HabitLog } from "./types";
import {
  verifyPassword,
  createSession,
  getSession,
  deleteSession,
} from "./utils/auth";
import { getTodayDate, parseYearMonth } from "./utils/date";
import { Layout } from "./components/Layout";
import { HabitCard, HabitList } from "./components/HabitCard";
import { Calendar } from "./components/Calendar";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Helper to extract local date from request header or cookie
function getLocalDate(c: Context): string {
  // Prefer header (HTMX requests), fall back to cookie (page loads)
  const localDate = c.req.header("X-Local-Date") || getCookie(c, "localDate");
  return getTodayDate(localDate);
}

// Auth middleware
app.use("*", async (c, next) => {
  const sessionId = getCookie(c, "session");

  if (sessionId) {
    const result = await getSession(c.env.DB, sessionId);
    if (result) {
      c.set("user", result.user);
      c.set("session", result.session);
    } else {
      c.set("user", null);
      c.set("session", null);
      deleteCookie(c, "session");
    }
  } else {
    c.set("user", null);
    c.set("session", null);
  }

  await next();
});

// Login page
app.get("/login", (c) => {
  const user = c.get("user");
  if (user) {
    return c.redirect("/");
  }

  return c.html(
    <Layout title="Login">
      <div class="max-w-sm mx-auto pt-12">
        <div class="text-center mb-8">
          <h1 class="font-display text-3xl font-medium text-warm-100 mb-2">
            Welcome back
          </h1>
          <p class="text-warm-400">Sign in to continue tracking your habits</p>
        </div>
        <form
          action="/login"
          method="post"
          class="bg-night-800/60 rounded-2xl border border-night-700/50 p-6 space-y-5"
        >
          <div>
            <label class="block text-sm font-medium text-warm-300 mb-2">
              Username
            </label>
            <input
              type="text"
              name="username"
              required
              class="w-full px-4 py-3 bg-night-900/50 border border-night-600 rounded-xl text-warm-100 placeholder-warm-500 focus:ring-2 focus:ring-ember-500/20 focus:border-ember-500 transition-colors"
              placeholder="Enter your username"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-warm-300 mb-2">
              Password
            </label>
            <input
              type="password"
              name="password"
              required
              class="w-full px-4 py-3 bg-night-900/50 border border-night-600 rounded-xl text-warm-100 placeholder-warm-500 focus:ring-2 focus:ring-ember-500/20 focus:border-ember-500 transition-colors"
              placeholder="Enter your password"
            />
          </div>
          <button
            type="submit"
            class="w-full bg-ember-500 text-night-950 py-3 px-4 rounded-xl hover:bg-ember-400 font-medium transition-colors"
          >
            Sign in
          </button>
        </form>
      </div>
    </Layout>
  );
});

app.post("/login", async (c) => {
  const body = await c.req.parseBody();
  const username = body.username as string;
  const password = body.password as string;

  const user = await c.env.DB.prepare(
    "SELECT * FROM users WHERE username = ?"
  )
    .bind(username)
    .first<User>();

  if (!user) {
    return c.html(
      <Layout title="Login">
        <div class="max-w-sm mx-auto pt-12">
          <div class="text-center mb-8">
            <h1 class="font-display text-3xl font-medium text-warm-100 mb-2">
              Welcome back
            </h1>
            <p class="text-warm-400">Sign in to continue tracking your habits</p>
          </div>
          <div class="bg-clay-500/10 text-clay-400 p-4 rounded-xl mb-4 text-sm border border-clay-500/20">
            Invalid username or password
          </div>
          <form
            action="/login"
            method="post"
            class="bg-night-800/60 rounded-2xl border border-night-700/50 p-6 space-y-5"
          >
            <div>
              <label class="block text-sm font-medium text-warm-300 mb-2">
                Username
              </label>
              <input
                type="text"
                name="username"
                required
                value={username}
                class="w-full px-4 py-3 bg-night-900/50 border border-night-600 rounded-xl text-warm-100 placeholder-warm-500 focus:ring-2 focus:ring-ember-500/20 focus:border-ember-500 transition-colors"
                placeholder="Enter your username"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-warm-300 mb-2">
                Password
              </label>
              <input
                type="password"
                name="password"
                required
                class="w-full px-4 py-3 bg-night-900/50 border border-night-600 rounded-xl text-warm-100 placeholder-warm-500 focus:ring-2 focus:ring-ember-500/20 focus:border-ember-500 transition-colors"
                placeholder="Enter your password"
              />
            </div>
            <button
              type="submit"
              class="w-full bg-ember-500 text-night-950 py-3 px-4 rounded-xl hover:bg-ember-400 font-medium transition-colors"
            >
              Sign in
            </button>
          </form>
        </div>
      </Layout>
    );
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return c.html(
      <Layout title="Login">
        <div class="max-w-sm mx-auto pt-12">
          <div class="text-center mb-8">
            <h1 class="font-display text-3xl font-medium text-warm-100 mb-2">
              Welcome back
            </h1>
            <p class="text-warm-400">Sign in to continue tracking your habits</p>
          </div>
          <div class="bg-clay-500/10 text-clay-400 p-4 rounded-xl mb-4 text-sm border border-clay-500/20">
            Invalid username or password
          </div>
          <form
            action="/login"
            method="post"
            class="bg-night-800/60 rounded-2xl border border-night-700/50 p-6 space-y-5"
          >
            <div>
              <label class="block text-sm font-medium text-warm-300 mb-2">
                Username
              </label>
              <input
                type="text"
                name="username"
                required
                value={username}
                class="w-full px-4 py-3 bg-night-900/50 border border-night-600 rounded-xl text-warm-100 placeholder-warm-500 focus:ring-2 focus:ring-ember-500/20 focus:border-ember-500 transition-colors"
                placeholder="Enter your username"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-warm-300 mb-2">
                Password
              </label>
              <input
                type="password"
                name="password"
                required
                class="w-full px-4 py-3 bg-night-900/50 border border-night-600 rounded-xl text-warm-100 placeholder-warm-500 focus:ring-2 focus:ring-ember-500/20 focus:border-ember-500 transition-colors"
                placeholder="Enter your password"
              />
            </div>
            <button
              type="submit"
              class="w-full bg-ember-500 text-night-950 py-3 px-4 rounded-xl hover:bg-ember-400 font-medium transition-colors"
            >
              Sign in
            </button>
          </form>
        </div>
      </Layout>
    );
  }

  const sessionId = await createSession(c.env.DB, user.id);
  const isLocalhost = new URL(c.req.url).hostname === "localhost";
  setCookie(c, "session", sessionId, {
    httpOnly: true,
    secure: !isLocalhost,
    sameSite: "Lax",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: "/",
  });

  return c.redirect("/");
});

app.post("/logout", async (c) => {
  const session = c.get("session");
  if (session) {
    await deleteSession(c.env.DB, session.id);
  }
  deleteCookie(c, "session");
  return c.redirect("/login");
});

// Protected routes middleware
const requireAuth = async (c: any, next: any) => {
  const user = c.get("user");
  if (!user) {
    return c.redirect("/login");
  }
  await next();
};

// Dashboard (home)
app.get("/", requireAuth, async (c) => {
  const user = c.get("user")!;
  const today = getLocalDate(c);

  // Query habits with completion status and last tagged date
  const habits = await c.env.DB.prepare(`
    SELECT h.*,
      CASE WHEN hl_today.id IS NOT NULL THEN 1 ELSE 0 END as completed_today,
      (SELECT MAX(date) FROM habit_logs WHERE habit_id = h.id) as last_tagged
    FROM habits h
    LEFT JOIN habit_logs hl_today ON h.id = hl_today.habit_id AND hl_today.date = ?
    WHERE h.user_id = ?
    ORDER BY h.sort_order ASC, h.created_at ASC
  `)
    .bind(today, user.id)
    .all<Habit & { completed_today: number; last_tagged: string | null }>();

  const habitData =
    habits.results?.map((h) => ({
      id: h.id,
      name: h.name,
      completedToday: h.completed_today === 1,
      lastTagged: h.last_tagged,
    })) || [];

  // Calculate streak info
  const completedCount = habitData.filter((h) => h.completedToday).length;
  const totalCount = habitData.length;

  return c.html(
    <Layout title="Dashboard" username={user.username}>
      <div class="space-y-8">
        {/* Header */}
        <div class="animate-in">
          <p class="text-warm-500 text-sm mb-1" id="current-date">
            <script
              dangerouslySetInnerHTML={{
                __html: `document.write(new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }));`,
              }}
            />
          </p>
          <h1 class="font-display text-3xl font-medium text-warm-100">
            Today's habits
          </h1>
          {totalCount > 0 && (
            <p class="text-warm-400 mt-2">
              <span class="text-moss-400 font-medium">{completedCount}</span>{" "}
              of {totalCount} completed
            </p>
          )}
        </div>

        {/* Habit list */}
        <HabitList habits={habitData} />

        {/* Add new habit form */}
        <div class="animate-in delay-4 pt-4 border-t border-night-700/50">
          <form action="/habits" method="post" class="flex gap-3">
            <input
              type="text"
              name="name"
              required
              placeholder="Add a new habit..."
              class="flex-1 px-4 py-3 bg-night-800/60 border border-night-700/50 rounded-xl text-warm-100 placeholder-warm-500 focus:ring-2 focus:ring-ember-500/20 focus:border-ember-500 transition-colors"
            />
            <button
              type="submit"
              class="bg-ember-500 text-night-950 py-3 px-6 rounded-xl hover:bg-ember-400 font-medium transition-colors flex items-center gap-2"
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span class="hidden sm:inline">Add</span>
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
});

// Create habit
app.post("/habits", requireAuth, async (c) => {
  const user = c.get("user")!;
  const body = await c.req.parseBody();
  const name = (body.name as string).trim();

  if (!name) {
    return c.redirect("/");
  }

  try {
    // Get max sort_order for this user
    const maxOrder = await c.env.DB.prepare(
      "SELECT MAX(sort_order) as max_order FROM habits WHERE user_id = ?"
    )
      .bind(user.id)
      .first<{ max_order: number | null }>();

    const newOrder = (maxOrder?.max_order ?? -1) + 1;

    await c.env.DB.prepare(
      "INSERT INTO habits (user_id, name, sort_order) VALUES (?, ?, ?)"
    )
      .bind(user.id, name, newOrder)
      .run();
  } catch (e) {
    // Habit already exists, ignore
  }

  return c.redirect("/");
});

// Reorder habits
app.post("/habits/reorder", requireAuth, async (c) => {
  const user = c.get("user")!;

  try {
    const body = await c.req.json<{ order: string[] }>();
    const order = body.order;

    if (!Array.isArray(order)) {
      return c.json({ error: "Invalid order" }, 400);
    }

    // Update sort_order for each habit
    for (let i = 0; i < order.length; i++) {
      const habitId = parseInt(order[i]);
      await c.env.DB.prepare(
        "UPDATE habits SET sort_order = ? WHERE id = ? AND user_id = ?"
      )
        .bind(i, habitId, user.id)
        .run();
    }

    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: "Failed to reorder" }, 500);
  }
});

// Toggle habit for a date (defaults to today)
app.post("/habits/:id/toggle", requireAuth, async (c) => {
  const user = c.get("user")!;
  const habitId = parseInt(c.req.param("id"));
  const today = getLocalDate(c);

  // Check for optional date parameter (for calendar-based toggling)
  const dateParam = c.req.query("date");
  const isCalendarToggle = !!dateParam;

  // Validate date format if provided
  let targetDate = today;
  if (dateParam) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return c.text("Invalid date format", 400);
    }
    // Don't allow future dates
    if (dateParam > today) {
      return c.text("Cannot toggle future dates", 400);
    }
    targetDate = dateParam;
  }

  // Verify habit belongs to user
  const habit = await c.env.DB.prepare(
    "SELECT * FROM habits WHERE id = ? AND user_id = ?"
  )
    .bind(habitId, user.id)
    .first<Habit>();

  if (!habit) {
    return c.text("Not found", 404);
  }

  // Check if already completed for target date
  const existing = await c.env.DB.prepare(
    "SELECT * FROM habit_logs WHERE habit_id = ? AND date = ?"
  )
    .bind(habitId, targetDate)
    .first<HabitLog>();

  if (existing) {
    // Remove completion
    await c.env.DB.prepare(
      "DELETE FROM habit_logs WHERE habit_id = ? AND date = ?"
    )
      .bind(habitId, targetDate)
      .run();
  } else {
    // Add completion
    await c.env.DB.prepare(
      "INSERT INTO habit_logs (habit_id, date) VALUES (?, ?)"
    )
      .bind(habitId, targetDate)
      .run();
  }

  // If this is a calendar toggle, return updated Calendar
  if (isCalendarToggle) {
    // Parse the date to get year and month for the calendar view
    const [yearStr, monthStr] = targetDate.split("-");
    const year = parseInt(yearStr);
    const month = parseInt(monthStr) - 1; // 0-indexed

    // Get all completions for this month (and surrounding days for display)
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = `${year}-${String(month + 2).padStart(2, "0")}-01`;

    const logs = await c.env.DB.prepare(
      `SELECT date FROM habit_logs WHERE habit_id = ? AND date >= ? AND date < ?`
    )
      .bind(habitId, startDate, endDate)
      .all<{ date: string }>();

    const completedDates = new Set(logs.results?.map((l) => l.date) || []);

    return c.html(
      <Calendar
        habitId={habit.id}
        habitName={habit.name}
        year={year}
        month={month}
        completedDates={completedDates}
        today={today}
      />
    );
  }

  // Otherwise, return updated HabitCard (for dashboard toggle)
  const completedToday = !existing;

  // Get the last tagged date
  const lastTaggedResult = await c.env.DB.prepare(
    "SELECT MAX(date) as last_tagged FROM habit_logs WHERE habit_id = ?"
  )
    .bind(habitId)
    .first<{ last_tagged: string | null }>();

  return c.html(
    <HabitCard
      id={habit.id}
      name={habit.name}
      completedToday={completedToday}
      lastTagged={lastTaggedResult?.last_tagged ?? null}
    />
  );
});

// Calendar partial (HTMX) - returns just the calendar component for fast updates
app.get("/habits/:id/calendar/partial", requireAuth, async (c) => {
  const user = c.get("user")!;
  const habitId = parseInt(c.req.param("id"));
  const monthParam = c.req.query("month");
  const { year, month } = parseYearMonth(monthParam);

  // Verify habit belongs to user
  const habit = await c.env.DB.prepare(
    "SELECT * FROM habits WHERE id = ? AND user_id = ?"
  )
    .bind(habitId, user.id)
    .first<Habit>();

  if (!habit) {
    return c.text("Not found", 404);
  }

  // Get all completions for this month (and surrounding days for display)
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month + 2).padStart(2, "0")}-01`;

  const logs = await c.env.DB.prepare(
    `SELECT date FROM habit_logs WHERE habit_id = ? AND date >= ? AND date < ?`
  )
    .bind(habitId, startDate, endDate)
    .all<{ date: string }>();

  const completedDates = new Set(logs.results?.map((l) => l.date) || []);

  return c.html(
    <Calendar
      habitId={habit.id}
      habitName={habit.name}
      year={year}
      month={month}
      completedDates={completedDates}
      today={getLocalDate(c)}
    />
  );
});

// Calendar view for habit
app.get("/habits/:id/calendar", requireAuth, async (c) => {
  const user = c.get("user")!;
  const habitId = parseInt(c.req.param("id"));
  const monthParam = c.req.query("month");
  const { year, month } = parseYearMonth(monthParam);

  // Verify habit belongs to user
  const habit = await c.env.DB.prepare(
    "SELECT * FROM habits WHERE id = ? AND user_id = ?"
  )
    .bind(habitId, user.id)
    .first<Habit>();

  if (!habit) {
    return c.redirect("/");
  }

  // Get all completions for this month (and surrounding days for display)
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month + 2).padStart(2, "0")}-01`;

  const logs = await c.env.DB.prepare(
    `
    SELECT date FROM habit_logs
    WHERE habit_id = ? AND date >= ? AND date < ?
  `
  )
    .bind(habitId, startDate, endDate)
    .all<{ date: string }>();

  const completedDates = new Set(logs.results?.map((l) => l.date) || []);

  return c.html(
    <Layout title={`${habit.name} - Calendar`} username={user.username}>
      <div class="space-y-6">
        <div class="flex items-center gap-4 animate-in">
          <a
            href="/"
            class="p-2 text-warm-400 hover:text-ember-400 transition-colors rounded-lg hover:bg-night-700/50"
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
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </a>
          <h1 class="font-display text-2xl font-medium text-warm-100">
            {habit.name}
          </h1>
        </div>
        <div class="animate-in delay-1">
          <Calendar
            habitId={habit.id}
            habitName={habit.name}
            year={year}
            month={month}
            completedDates={completedDates}
            today={getLocalDate(c)}
          />
        </div>
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html: `document.addEventListener("keydown", function(e) {
            if (e.key === "Escape") {
              window.location.href = "/";
            }
          });`,
        }}
      />
    </Layout>
  );
});

// Get habit card (normal mode)
app.get("/habits/:id/card", requireAuth, async (c) => {
  const user = c.get("user")!;
  const habitId = parseInt(c.req.param("id"));
  const today = getLocalDate(c);

  const habit = await c.env.DB.prepare(
    "SELECT * FROM habits WHERE id = ? AND user_id = ?"
  )
    .bind(habitId, user.id)
    .first<Habit>();

  if (!habit) {
    return c.text("Not found", 404);
  }

  const todayLog = await c.env.DB.prepare(
    "SELECT * FROM habit_logs WHERE habit_id = ? AND date = ?"
  )
    .bind(habitId, today)
    .first<HabitLog>();

  const lastTaggedResult = await c.env.DB.prepare(
    "SELECT MAX(date) as last_tagged FROM habit_logs WHERE habit_id = ?"
  )
    .bind(habitId)
    .first<{ last_tagged: string | null }>();

  return c.html(
    <HabitCard
      id={habit.id}
      name={habit.name}
      completedToday={!!todayLog}
      lastTagged={lastTaggedResult?.last_tagged ?? null}
    />
  );
});

// Get habit card in edit mode
app.get("/habits/:id/edit", requireAuth, async (c) => {
  const user = c.get("user")!;
  const habitId = parseInt(c.req.param("id"));
  const today = getLocalDate(c);

  const habit = await c.env.DB.prepare(
    "SELECT * FROM habits WHERE id = ? AND user_id = ?"
  )
    .bind(habitId, user.id)
    .first<Habit>();

  if (!habit) {
    return c.text("Not found", 404);
  }

  const todayLog = await c.env.DB.prepare(
    "SELECT * FROM habit_logs WHERE habit_id = ? AND date = ?"
  )
    .bind(habitId, today)
    .first<HabitLog>();

  const lastTaggedResult = await c.env.DB.prepare(
    "SELECT MAX(date) as last_tagged FROM habit_logs WHERE habit_id = ?"
  )
    .bind(habitId)
    .first<{ last_tagged: string | null }>();

  return c.html(
    <HabitCard
      id={habit.id}
      name={habit.name}
      completedToday={!!todayLog}
      lastTagged={lastTaggedResult?.last_tagged ?? null}
      isEditing={true}
    />
  );
});

// Rename habit
app.post("/habits/:id/rename", requireAuth, async (c) => {
  const user = c.get("user")!;
  const habitId = parseInt(c.req.param("id"));
  const body = await c.req.parseBody();
  const newName = (body.name as string).trim();

  if (!newName) {
    return c.text("Name is required", 400);
  }

  // Verify habit belongs to user
  const habit = await c.env.DB.prepare(
    "SELECT * FROM habits WHERE id = ? AND user_id = ?"
  )
    .bind(habitId, user.id)
    .first<Habit>();

  if (!habit) {
    return c.text("Not found", 404);
  }

  // Update the name
  try {
    await c.env.DB.prepare("UPDATE habits SET name = ? WHERE id = ? AND user_id = ?")
      .bind(newName, habitId, user.id)
      .run();
  } catch (e) {
    // Name conflict (duplicate)
    return c.text("A habit with that name already exists", 400);
  }

  const today = getLocalDate(c);

  // Check if completed today
  const todayLog = await c.env.DB.prepare(
    "SELECT * FROM habit_logs WHERE habit_id = ? AND date = ?"
  )
    .bind(habitId, today)
    .first<HabitLog>();

  // Get last tagged date
  const lastTaggedResult = await c.env.DB.prepare(
    "SELECT MAX(date) as last_tagged FROM habit_logs WHERE habit_id = ?"
  )
    .bind(habitId)
    .first<{ last_tagged: string | null }>();

  return c.html(
    <HabitCard
      id={habitId}
      name={newName}
      completedToday={!!todayLog}
      lastTagged={lastTaggedResult?.last_tagged ?? null}
    />
  );
});

// Delete habit
app.post("/habits/:id/delete", requireAuth, async (c) => {
  const user = c.get("user")!;
  const habitId = parseInt(c.req.param("id"));

  await c.env.DB.prepare("DELETE FROM habits WHERE id = ? AND user_id = ?")
    .bind(habitId, user.id)
    .run();

  return c.redirect("/");
});

export default app;
