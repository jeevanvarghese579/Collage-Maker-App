import { useEffect, useState } from 'react';
import { db, TABLES } from '@/db/dexie';
import { useLiveQuery } from 'dexie-react-hooks';

// Live query helper bound to the Dexie db.
export function useLiveTable(table, queryFn) {
  return useLiveQuery(
    () => (queryFn ? queryFn(db.table(table)) : db.table(table).toArray()),
    []
  );
}

export function useStudents() {
  return useLiveQuery(() => db.table(TABLES.students).toArray(), []);
}

export function useCategories() {
  return useLiveQuery(() => db.table(TABLES.categories).orderBy('order').toArray(), []);
}

export function useItems(categoryId) {
  return useLiveQuery(
    () =>
      categoryId
        ? db.table(TABLES.items).where('categoryId').equals(categoryId).toArray()
        : db.table(TABLES.items).toArray(),
    [categoryId]
  );
}

export function useParticipations() {
  return useLiveQuery(() => db.table(TABLES.participations).toArray(), []);
}

export function useResults() {
  return useLiveQuery(() => db.table(TABLES.results).toArray(), []);
}

export function useFrameTemplates() {
  return useLiveQuery(() => db.table(TABLES.frameTemplates).toArray(), []);
}

export function useSetting(key, defaultValue) {
  const [value, setValue] = useState(defaultValue);
  useEffect(() => {
    let active = true;
    db.table(TABLES.settings)
      .get(key)
      .then((r) => {
        if (active) setValue(r ? r.value : defaultValue);
      });
    return () => {
      active = false;
    };
  }, [key]);
  return [value, async (v) => {
    setValue(v);
    await db.table(TABLES.settings).put({ key, value: v });
  }];
}
