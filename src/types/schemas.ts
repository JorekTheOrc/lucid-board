// Core types for Lucid Board

export interface Board {
  id: string;
  title: string;
  course: string;
  createdAt: number;
  updatedAt: number;
  content: any; // tldraw snapshot (will be typed properly later)
}

export interface Pass {
  id: string;
  boardId: string;
  studentName: string;
  expiresAt: number | null;
  pin: string | null;
  permissions: {
    attachFiles: boolean;
    addNotes: boolean;
    moveShapes: boolean;
  };
  attempts: {
    default: number;
    overrides?: Record<string, number>; // exerciseId -> attempts
  };
}

export interface Progress {
  id: string;
  passId: string;
  boardId: string;
  studentName: string;
  startedAt: number;
  finishedAt: number | null;
  answers: any[]; // Will type properly later
  summary: {
    total: number;
    correct: number;
  };
}
