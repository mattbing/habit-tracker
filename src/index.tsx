import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Env, Variables, User, Habit, HabitLog } from './types';
import { hashPassword, verifyPassword, createSession, getSession, deleteSession } from './utils/auth';
import { getTodayDate, parseYearMonth } from './utils/date';
import { Layout } from './components/Layout';
import { HabitCard, HabitList } from './components/HabitCard';
import { Calendar } from './components/Calendar';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Auth middleware
app.use('*', async (c, next) => {
  const sessionId = getCookie(c, 'session');

  if (sessionId) {
    const result = await getSession(c.env.DB, sessionId);
    if (result) {
      c.set('user', result.user);
      c.set('session', result.session);
    } else {
      c.set('user', null);
      c.set('session', null);
      deleteCookie(c, 'session');
    }
  } else {
    c.set('user', null);
    c.set('session', null);
  }

  await next();
});

// Login page
app.get('/login', (c) => {
  const user = c.get('user');
  if (user) {
    return c.redirect('/');
  }

  return c.html(
    <Layout title="Login">
      <div class="max-w-md mx-auto">
        <h1 class="text-2xl font-bold text-gray-800 mb-6 text-center">Login</h1>
        <form action="/login" method="post" class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              name="username"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              name="password"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            class="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 font-medium"
          >
            Login
          </button>
        </form>
      </div>
    </Layout>
  );
});

app.post('/login', async (c) => {
  const body = await c.req.parseBody();
  const username = body.username as string;
  const password = body.password as string;

  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE username = ?'
  ).bind(username).first<User>();

  if (!user) {
    return c.html(
      <Layout title="Login">
        <div class="max-w-md mx-auto">
          <h1 class="text-2xl font-bold text-gray-800 mb-6 text-center">Login</h1>
          <div class="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
            Invalid username or password
          </div>
          <form action="/login" method="post" class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                name="username"
                required
                value={username}
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                name="password"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              class="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 font-medium"
            >
              Login
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
        <div class="max-w-md mx-auto">
          <h1 class="text-2xl font-bold text-gray-800 mb-6 text-center">Login</h1>
          <div class="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
            Invalid username or password
          </div>
          <form action="/login" method="post" class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                name="username"
                required
                value={username}
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                name="password"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              class="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 font-medium"
            >
              Login
            </button>
          </form>
        </div>
      </Layout>
    );
  }

  const sessionId = await createSession(c.env.DB, user.id);
  setCookie(c, 'session', sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: '/',
  });

  return c.redirect('/');
});

app.post('/logout', async (c) => {
  const session = c.get('session');
  if (session) {
    await deleteSession(c.env.DB, session.id);
  }
  deleteCookie(c, 'session');
  return c.redirect('/login');
});

// Protected routes middleware
const requireAuth = async (c: any, next: any) => {
  const user = c.get('user');
  if (!user) {
    return c.redirect('/login');
  }
  await next();
};

// Dashboard (home)
app.get('/', requireAuth, async (c) => {
  const user = c.get('user')!;
  const today = getTodayDate();

  const habits = await c.env.DB.prepare(`
    SELECT h.*,
      CASE WHEN hl.id IS NOT NULL THEN 1 ELSE 0 END as completed_today
    FROM habits h
    LEFT JOIN habit_logs hl ON h.id = hl.habit_id AND hl.date = ?
    WHERE h.user_id = ?
    ORDER BY h.created_at ASC
  `).bind(today, user.id).all<Habit & { completed_today: number }>();

  const habitData = habits.results?.map(h => ({
    id: h.id,
    name: h.name,
    completedToday: h.completed_today === 1,
  })) || [];

  return c.html(
    <Layout title="Dashboard" username={user.username}>
      <div class="space-y-8">
        <div>
          <h1 class="text-2xl font-bold text-gray-800 mb-2">Today's Habits</h1>
          <p class="text-gray-600 mb-6">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <HabitList habits={habitData} />
        </div>

        <div class="border-t border-gray-200 pt-8">
          <h2 class="text-lg font-semibold text-gray-800 mb-4">Add New Habit</h2>
          <form
            action="/habits"
            method="post"
            class="flex gap-3"
          >
            <input
              type="text"
              name="name"
              required
              placeholder="Enter habit name..."
              class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="submit"
              class="bg-blue-500 text-white py-2 px-6 rounded-lg hover:bg-blue-600 font-medium"
            >
              Add Habit
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
});

// Create habit
app.post('/habits', requireAuth, async (c) => {
  const user = c.get('user')!;
  const body = await c.req.parseBody();
  const name = (body.name as string).trim();

  if (!name) {
    return c.redirect('/');
  }

  try {
    await c.env.DB.prepare(
      'INSERT INTO habits (user_id, name) VALUES (?, ?)'
    ).bind(user.id, name).run();
  } catch (e) {
    // Habit already exists, ignore
  }

  return c.redirect('/');
});

// Toggle habit for today
app.post('/habits/:id/toggle', requireAuth, async (c) => {
  const user = c.get('user')!;
  const habitId = parseInt(c.req.param('id'));
  const today = getTodayDate();

  // Verify habit belongs to user
  const habit = await c.env.DB.prepare(
    'SELECT * FROM habits WHERE id = ? AND user_id = ?'
  ).bind(habitId, user.id).first<Habit>();

  if (!habit) {
    return c.text('Not found', 404);
  }

  // Check if already completed today
  const existing = await c.env.DB.prepare(
    'SELECT * FROM habit_logs WHERE habit_id = ? AND date = ?'
  ).bind(habitId, today).first<HabitLog>();

  if (existing) {
    // Remove completion
    await c.env.DB.prepare(
      'DELETE FROM habit_logs WHERE habit_id = ? AND date = ?'
    ).bind(habitId, today).run();
  } else {
    // Add completion
    await c.env.DB.prepare(
      'INSERT INTO habit_logs (habit_id, date) VALUES (?, ?)'
    ).bind(habitId, today).run();
  }

  const completedToday = !existing;

  return c.html(
    <HabitCard id={habit.id} name={habit.name} completedToday={completedToday} />
  );
});

// Calendar view for habit
app.get('/habits/:id/calendar', requireAuth, async (c) => {
  const user = c.get('user')!;
  const habitId = parseInt(c.req.param('id'));
  const monthParam = c.req.query('month');
  const { year, month } = parseYearMonth(monthParam);

  // Verify habit belongs to user
  const habit = await c.env.DB.prepare(
    'SELECT * FROM habits WHERE id = ? AND user_id = ?'
  ).bind(habitId, user.id).first<Habit>();

  if (!habit) {
    return c.redirect('/');
  }

  // Get all completions for this month (and surrounding days for display)
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month + 2).padStart(2, '0')}-01`;

  const logs = await c.env.DB.prepare(`
    SELECT date FROM habit_logs
    WHERE habit_id = ? AND date >= ? AND date < ?
  `).bind(habitId, startDate, endDate).all<{ date: string }>();

  const completedDates = new Set(logs.results?.map(l => l.date) || []);

  return c.html(
    <Layout title={`${habit.name} - Calendar`} username={user.username}>
      <div class="space-y-6">
        <div class="flex items-center gap-4">
          <a href="/" class="text-blue-500 hover:text-blue-600">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </a>
          <h1 class="text-2xl font-bold text-gray-800">{habit.name}</h1>
        </div>
        <Calendar
          habitId={habit.id}
          habitName={habit.name}
          year={year}
          month={month}
          completedDates={completedDates}
        />
      </div>
    </Layout>
  );
});

// Delete habit
app.post('/habits/:id/delete', requireAuth, async (c) => {
  const user = c.get('user')!;
  const habitId = parseInt(c.req.param('id'));

  await c.env.DB.prepare(
    'DELETE FROM habits WHERE id = ? AND user_id = ?'
  ).bind(habitId, user.id).run();

  return c.redirect('/');
});

export default app;
