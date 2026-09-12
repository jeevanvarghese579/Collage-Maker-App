import { db, TABLES } from './dexie';
import { APP_VERSION, DEFAULT_CATEGORIES, DEFAULT_ITEM_NAME } from '@/constants';
import { makeCategory, makeItem } from './schema';
import { sortByName, nowISO, uuid } from '@/utils';

// Backup/restore schema versioning entry-point. Currently v1.
export const SCHEMA_VERSION = 1;

export async function getCurrentSchemaVersion() {
  const meta = await db.table(TABLES.settings).get('schemaVersion');
  return meta?.value ?? SCHEMA_VERSION;
}

export async function setSchemaVersion(v) {
  await db.table(TABLES.settings).put({ key: 'schemaVersion', value: v });
}

// Placeholder for future migrations between schema versions.
export async function runMigrations() {
  const current = await getCurrentSchemaVersion();
  if (current < 1) {
    await setSchemaVersion(1);
  }
}

// Ensure default categories + items exist on first use.
export async function ensureSeedData() {
  const catCount = await db.table(TABLES.categories).count();
  if (catCount > 0) return;

  let order = 0;
  for (const name of DEFAULT_CATEGORIES) {
    const cat = makeCategory({ name, order: order++, isDefault: true });
    await db.table(TABLES.categories).put(cat);
    const item = makeItem({
      categoryId: cat.id,
      name: DEFAULT_ITEM_NAME,
      order: 0,
    });
    await db.table(TABLES.items).put(item);
  }
}

export async function loadDemoData() {
  await ensureSeedData();
  const categories = await db.table(TABLES.categories).toArray();
  const itemsByCat = {};
  for (const c of categories) {
    itemsByCat[c.id] = await db
      .table(TABLES.items)
      .where('categoryId')
      .equals(c.id)
      .toArray();
  }

  const classes = ['5A', '6A', '7A', '8A'];
  const firstNames = ['Aarav', 'Diya', 'Vivaan', 'Ananya', 'Arjun', 'Sara', 'Kabir', 'Ishaan', 'Maya', 'Rohan'];
  const lastNames = ['Thomas', 'Kumar', 'Nair', 'Menon', 'Varghese', 'Pillai', 'Joseph', 'George'];
  const genders = ['Male', 'Female'];
  const positions = ['First', 'Second', 'Third', ''];
  const grades = ['A+', 'A', 'B+', 'B', ''];

  const students = [];
  for (let i = 0; i < 16; i++) {
    const cls = classes[i % classes.length];
    const fname = firstNames[i % firstNames.length];
    const lname = lastNames[i % lastNames.length];
    const student = {
      id: uuid(),
      name: `${fname} ${lname}`,
      gender: genders[i % genders.length],
      rollNumber: String(i + 1),
      admissionNumber: `ADM${1000 + i}`,
      className: cls,
      photoBlobId: null,
      photoLocalUrl: null,
      photoStorageUrl: null,
      photoCrop: { x: 0, y: 0 },
      photoZoom: 1,
      photoRotation: 0,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      syncStatus: 'pending',
    };
    students.push(student);
  }
  await db.table(TABLES.students).bulkPut(students);

  // Create participations + results for a few students.
  const participations = [];
  const results = [];
  let pi = 0;
  for (const student of students) {
    // 2 participations per student in different categories.
    for (let c = 0; c < 2; c++) {
      const cat = categories[(pi + c) % categories.length];
      const items = itemsByCat[cat.id];
      if (!items.length) continue;
      const item = items[pi % items.length];
      const part = {
        id: uuid(),
        studentId: student.id,
        categoryId: cat.id,
        itemId: item.id,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        syncStatus: 'pending',
      };
      participations.push(part);
      const result = {
        id: uuid(),
        participationId: part.id,
        studentId: student.id,
        categoryId: cat.id,
        itemId: item.id,
        grade: grades[pi % grades.length],
        position: positions[pi % positions.length],
        marks: String(((pi % 5) + 1) * 10),
        createdAt: nowISO(),
        updatedAt: nowISO(),
        syncStatus: 'pending',
      };
      results.push(result);
      pi++;
    }
  }
  await db.table(TABLES.participations).bulkPut(participations);
  await db.table(TABLES.results).bulkPut(results);

  return { students: students.length, participations: participations.length, results: results.length };
}

export async function clearDemoData() {
  // Demo data is indistinguishable from real data in Dexie, so we clear all
  // user data except settings. The user is warned before calling this.
  await db.table(TABLES.students).clear();
  await db.table(TABLES.participations).clear();
  await db.table(TABLES.results).clear();
  await db.table(TABLES.blobs).where('kind').equals('photo').delete();
  await db.table(TABLES.frameTemplates).clear();
  await db.table(TABLES.blobs).where('kind').equals('frame').delete();
  // Re-seed default categories/items.
  await db.table(TABLES.categories).clear();
  await db.table(TABLES.items).clear();
  await ensureSeedData();
}

export { sortByName };
