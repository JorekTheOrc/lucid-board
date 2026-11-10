import Dexie, { type EntityTable } from 'dexie';
import type { Board, Pass, Progress } from '../types/schemas';

export interface AudioAssetData {
  id: string;
  blob: Blob;
}

const db = new Dexie('LucidBoardDatabase') as Dexie & {
  boards: EntityTable<Board, 'id'>;
  passes: EntityTable<Pass, 'id'>;
  progress: EntityTable<Progress, 'id'>;
  assets: EntityTable<AudioAssetData, 'id'>;
};

// Обновляем версию базы и добавляем таблицу assets
db.version(2).stores({
  boards: 'id, title, course, updatedAt',
  passes: 'id, boardId, studentName',
  progress: 'id, passId, boardId, studentName',
  assets: 'id'
});

export { db };