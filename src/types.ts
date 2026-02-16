export interface User {
  id: number;
  username: string;
  password_hash: string;
  created_at: string;
}

export interface Habit {
  id: number;
  user_id: number;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface HabitLog {
  id: number;
  habit_id: number;
  date: string;
  created_at: string;
}

export interface Env {
  DB: D1Database;
  CF_ACCESS_TEAM_DOMAIN: string;
  CF_ACCESS_AUD: string;
}

export interface Variables {
  user: User | null;
}
