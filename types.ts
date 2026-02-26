export interface Task {
  id: string;
  title: string;
  isCompleted: boolean;
  date: string; // ISO Date string YYYY-MM-DD
  time?: string; // e.g. "10:00 AM"
  location?: string;
  tag?: string; // e.g., "Work", "Personal"
  priority?: 'normal' | 'high';
  image?: string; // Base64 Data URI
}

export type TaskStatus = 'overdue' | 'today' | 'upcoming';

export interface SmartTaskResponse {
  title: string;
  time?: string;
  location?: string;
  tag?: string;
  priority?: 'normal' | 'high';
  isOverdue?: boolean; // Just for simulation
}