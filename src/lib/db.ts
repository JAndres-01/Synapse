import Dexie, { type Table } from 'dexie';
import type { Subject, Schedule, Task, Notice, Profile } from '@/types/database';

export class SynapseOfflineDB extends Dexie {
  profile!: Table<Profile, string>;
  subjects!: Table<Subject, string>;
  schedules!: Table<Schedule, string>;
  tasks!: Table<Task, string>;
  notices!: Table<Notice, string>;

  constructor() {
    super('SynapseOfflineDB');
    this.version(1).stores({
      profile: 'id, email, role',
      subjects: 'id, classroom_id, name, code',
      schedules: 'id, classroom_id, subject_id, block_number, day_of_week',
      tasks: 'id, classroom_id, subject_id, type, due_date',
      notices: 'id, classroom_id, category, is_urgent, created_at',
    });
  }
}

export const offlineDB = typeof window !== 'undefined' ? new SynapseOfflineDB() : null;
