import Dexie, { type EntityTable } from 'dexie';
import type { Board, Pass, Progress } from '../types/schemas';

const db = new Dexie('LucidBoardDatabase') as Dexie & {
  boards: EntityTable<Board, 'id'>;
  passes: EntityTable<Pass, 'id'>;
  progress: EntityTable<Progress, 'id'>;
};

// Schema declaration
db.version(1).stores({
  boards: 'id, title, course, updatedAt',
  passes: 'id, boardId, studentName',
  progress: 'id, passId, boardId, studentName'
});

export { db };
