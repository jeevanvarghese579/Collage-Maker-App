import { useMemo, useRef, useState } from 'react';
import {
  Upload,
  Download,
  FileDown,
  Search,
  Trophy,
  Save,
  Eraser,
} from 'lucide-react';
import {
  useStudents,
  useCategories,
  useItems,
  useParticipations,
  useResults,
} from '@/hooks/useDb';
import { db, TABLES } from '@/db/dexie';
import { makeStudent, makeCategory, makeItem, makeParticipation, makeResult } from '@/db/schema';
import { nowISO, SYNC_STATUS, nilIfEmpty, classNames } from '@/utils';
import { useAppStore } from '@/stores/appStore';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import { TableSkeleton } from '@/components/common/EmptyState';
import CsvPreviewModal from '@/components/common/CsvPreviewModal';
import { parseResultsCsv, exportResultsCsv, exportBlankResultsCsv } from '@/services/csvService';

export default function ResultsPage() {
  const students = useStudents();
  const categories = useCategories();
  const items = useItems();
  const participations = useParticipations();
  const results = useResults();
  const addToast = useAppStore((s) => s.addToast);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [itemFilter, setItemFilter] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [editing, setEditing] = useState({}); // participationId -> {grade, position, marks}
  const [bulkGrade, setBulkGrade] = useState('');
  const [bulkPosition, setBulkPosition] = useState('');
  const [bulkMarks, setBulkMarks] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [csvPreview, setCsvPreview] = useState(null);
  const importRef = useRef(null);

  const rows = useMemo(() => {
    if (!students || !categories || !items || !participations || !results) return [];
    const studentMap = new Map(students.map((s) => [s.id, s]));
    const catMap = new Map(categories.map((c) => [c.id, c]));
    const itemMap = new Map(items.map((i) => [i.id, i]));
    const resultMap = new Map(results.map((r) => [r.participationId, r]));
    const out = [];
    for (const p of participations) {
      const s = studentMap.get(p.studentId);
      const c = catMap.get(p.categoryId);
      const it = itemMap.get(p.itemId);
      const r = resultMap.get(p.id);
      if (!s) continue;
      out.push({
        participationId: p.id,
        studentId: s.id,
        categoryId: c?.id || '',
        itemId: it?.id || '',
        studentName: s.name,
        gender: s.gender,
        rollNumber: s.rollNumber,
        admissionNumber: s.admissionNumber,
        className: s.className,
        category: c?.name || '',
        item: it?.name || '',
        grade: r?.grade || '',
        position: r?.position || '',
        marks: r?.marks || '',
        resultId: r?.id || null,
      });
    }
    return out;
  }, [students, categories, items, participations, results]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (catFilter && r.category !== catFilter) return false;
      if (itemFilter && r.item !== itemFilter) return false;
      if (gradeFilter && r.grade !== gradeFilter) return false;
      if (positionFilter && r.position !== positionFilter) return false;
      if (q) {
        const hay = `${r.studentName} ${r.className} ${r.rollNumber} ${r.admissionNumber} ${r.category} ${r.item}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, catFilter, itemFilter, gradeFilter, positionFilter]);

  const categoryNames = useMemo(
    () => [...new Set(rows.map((r) => r.category).filter(Boolean))].sort(),
    [rows]
  );
  const itemNames = useMemo(
    () => [...new Set(rows.map((r) => r.item).filter(Boolean))].sort(),
    [rows]
  );
  const gradeValues = useMemo(
    () => [...new Set(rows.map((r) => r.grade).filter(Boolean))].sort(),
    [rows]
  );
  const positionValues = useMemo(
    () => [...new Set(rows.map((r) => r.position).filter(Boolean))].sort(),
    [rows]
  );

  function startEdit(r) {
    setEditing((e) => ({
      ...e,
      [r.participationId]: { grade: r.grade, position: r.position, marks: r.marks },
    }));
  }

  function setField(partId, field, value) {
    setEditing((e) => ({
      ...e,
      [partId]: { ...e[partId], [field]: value },
    }));
  }

  async function saveRow(r) {
    const ed = editing[r.participationId];
    if (!ed) return;
    if (r.resultId) {
      const existing = await db.table(TABLES.results).get(r.resultId);
      await db.table(TABLES.results).put({
        ...existing,
        grade: ed.grade,
        position: ed.position,
        marks: ed.marks,
        updatedAt: nowISO(),
        syncStatus: SYNC_STATUS.PENDING,
      });
    } else {
      const result = makeResult({
        participationId: r.participationId,
        studentId: r.studentId,
        categoryId: r.categoryId,
        itemId: r.itemId,
        grade: ed.grade,
        position: ed.position,
        marks: ed.marks,
      });
      await db.table(TABLES.results).put(result);
    }
    setEditing((e) => {
      const next = { ...e };
      delete next[r.participationId];
      return next;
    });
  }

  function toggleSelect(partId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(partId)) next.delete(partId);
      else next.add(partId);
      return next;
    });
  }

  async function bulkApply() {
    const ids = [...selected];
    for (const pid of ids) {
      const r = rows.find((x) => x.participationId === pid);
      if (!r) continue;
      const ed = {
        grade: bulkGrade,
        position: bulkPosition,
        marks: bulkMarks,
      };
      if (r.resultId) {
        const existing = await db.table(TABLES.results).get(r.resultId);
        await db.table(TABLES.results).put({
          ...existing,
          grade: bulkGrade || existing.grade,
          position: bulkPosition || existing.position,
          marks: bulkMarks || existing.marks,
          updatedAt: nowISO(),
          syncStatus: SYNC_STATUS.PENDING,
        });
      } else {
        const result = makeResult({
          participationId: pid,
          studentId: r.studentId,
          categoryId: r.categoryId,
          itemId: r.itemId,
          grade: bulkGrade,
          position: bulkPosition,
          marks: bulkMarks,
        });
        await db.table(TABLES.results).put(result);
      }
    }
    addToast({ type: 'success', message: `Applied to ${ids.length} rows.` });
    setSelected(new Set());
    setBulkGrade(''); setBulkPosition(''); setBulkMarks('');
  }

  async function bulkClear() {
    const ids = [...selected];
    for (const pid of ids) {
      const r = rows.find((x) => x.participationId === pid);
      if (r?.resultId) {
        await db.table(TABLES.results).delete(r.resultId);
      }
    }
    addToast({ type: 'success', message: `Cleared ${ids.length} rows.` });
    setSelected(new Set());
  }

  function onExport() {
    exportResultsCsv(filtered);
  }

  async function onImportFile(e) {
    const file = e.target.files?.[0];
    if (file) {
      const res = await parseResultsCsv(file);
      setCsvPreview(res);
    }
    e.target.value = '';
  }

  async function confirmResultsImport(result) {
    const report = { created: { student: 0, category: 0, item: 0, participation: 0, result: 0 }, updated: 0, skipped: 0, failed: 0 };
    const allStudents = await db.table(TABLES.students).toArray();
    const allCats = await db.table(TABLES.categories).toArray();
    const allItems = await db.table(TABLES.items).toArray();
    const allParts = await db.table(TABLES.participations).toArray();

    const studentByAdm = new Map(allStudents.filter((s) => s.admissionNumber).map((s) => [s.admissionNumber, s]));
    const studentByNameClass = new Map(allStudents.map((s) => [`${s.name}|${s.className}`.toLowerCase(), s]));
    const catByName = new Map(allCats.map((c) => [c.name.toLowerCase(), c]));
    const catById = new Map(allCats.map((c) => [c.id, c]));
    const itemByNameCat = new Map(allItems.map((i) => [`${i.name}|${i.categoryId}`.toLowerCase(), i]));
    const partByStudentItem = new Map(allParts.map((p) => [`${p.studentId}|${p.itemId}`, p]));

    for (const row of result.valid) {
      try {
        // Resolve student
        let student = (row.studentId && allStudents.find((s) => s.id === row.studentId)) || null;
        if (!student && row.admissionNumber) student = studentByAdm.get(row.admissionNumber);
        if (!student) {
          const key = `${row.studentName}|${row.className}`.toLowerCase();
          student = studentByNameClass.get(key);
        }
        if (!student) {
          student = makeStudent({ name: row.studentName, gender: row.gender, rollNumber: row.rollNumber, admissionNumber: row.admissionNumber, className: row.className });
          await db.table(TABLES.students).put(student);
          report.created.student++;
        }

        // Resolve category
        let cat = (row.categoryId && catById.get(row.categoryId)) || catByName.get(row.category.toLowerCase());
        if (!cat) {
          cat = makeCategory({ name: row.category, order: (await db.table(TABLES.categories).count()) });
          const item = makeItem({ categoryId: cat.id, name: 'General', order: 0 });
          await db.table(TABLES.categories).put(cat);
          await db.table(TABLES.items).put(item);
          report.created.category++;
          report.created.item++;
        }

        // Resolve item
        let item = (row.itemId && allItems.find((i) => i.id === row.itemId)) || itemByNameCat.get(`${row.item}|${cat.id}`.toLowerCase());
        if (!item) {
          const count = (await db.table(TABLES.items).where('categoryId').equals(cat.id).count());
          item = makeItem({ categoryId: cat.id, name: row.item, order: count });
          await db.table(TABLES.items).put(item);
          report.created.item++;
        }

        // Resolve participation
        let part = partByStudentItem.get(`${student.id}|${item.id}`);
        if (!part) {
          part = makeParticipation({ studentId: student.id, categoryId: cat.id, itemId: item.id });
          await db.table(TABLES.participations).put(part);
          report.created.participation++;
        }

        // Result
        const existingResult = await db.table(TABLES.results).where('participationId').equals(part.id).first();
        if (existingResult) {
          await db.table(TABLES.results).put({
            ...existingResult,
            grade: row.grade,
            position: row.position,
            marks: row.marks,
            updatedAt: nowISO(),
            syncStatus: SYNC_STATUS.PENDING,
          });
          report.updated++;
        } else {
          const res = makeResult({
            participationId: part.id,
            studentId: student.id,
            categoryId: cat.id,
            itemId: item.id,
            grade: row.grade,
            position: row.position,
            marks: row.marks,
          });
          await db.table(TABLES.results).put(res);
          report.created.result++;
        }
      } catch (err) {
        report.failed++;
      }
    }
    addToast({ type: 'success', message: `Import done. Created/updated records. See report.` });
    alert(
      `Import Report:\nStudents created: ${report.created.student}\nCategories created: ${report.created.category}\nItems created: ${report.created.item}\nParticipations created: ${report.created.participation}\nResults created: ${report.created.result}\nUpdated: ${report.updated}\nFailed: ${report.failed}`
    );
    setCsvPreview(null);
  }

  if (!students || !categories || !items || !participations || !results) return <TableSkeleton />;

  return (
    <div>
      <PageHeader
        title="Results Entry"
        subtitle={`${filtered.length} participations`}
        actions={
          <>
            <button className="btn-secondary" onClick={() => importRef.current?.click()}>
              <Upload size={16} /> Import CSV
            </button>
            <button className="btn-secondary" onClick={onExport}>
              <Download size={16} /> Export CSV
            </button>
            <button className="btn-secondary" onClick={exportBlankResultsCsv}>
              <FileDown size={16} /> Blank CSV
            </button>
            <input ref={importRef} type="file" accept=".csv" className="hidden" onChange={onImportFile} />
          </>
        }
      />

      <div className="card p-3 mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input className="input pl-9" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="select w-auto" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="">All categories</option>
          {categoryNames.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="select w-auto" value={itemFilter} onChange={(e) => setItemFilter(e.target.value)}>
          <option value="">All items</option>
          {itemNames.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="select w-auto" value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}>
          <option value="">All grades</option>
          {gradeValues.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="select w-auto" value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)}>
          <option value="">All positions</option>
          {positionValues.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {selected.size > 0 && (
        <div className="card p-3 mb-4 flex flex-wrap items-center gap-2 bg-brand-50/50">
          <span className="chip chip-brand">{selected.size} selected</span>
          <input className="input w-28" placeholder="Grade" value={bulkGrade} onChange={(e) => setBulkGrade(e.target.value)} />
          <input className="input w-28" placeholder="Position" value={bulkPosition} onChange={(e) => setBulkPosition(e.target.value)} />
          <input className="input w-28" placeholder="Marks" value={bulkMarks} onChange={(e) => setBulkMarks(e.target.value)} />
          <button className="btn-primary btn-sm" onClick={bulkApply}><Save size={14} /> Apply</button>
          <button className="btn-danger btn-sm" onClick={bulkClear}><Eraser size={14} /> Clear</button>
          <button className="btn-ghost btn-sm" onClick={() => setSelected(new Set())}>Deselect</button>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon={Trophy} title="No results to show" description="Add participations first, then enter results here." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto max-h-[65vh]">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 sticky top-0 z-10">
                <tr>
                  <th className="table-header px-3 py-2 w-10"></th>
                  <th className="table-header px-3 py-2">Student</th>
                  <th className="table-header px-3 py-2">Class</th>
                  <th className="table-header px-3 py-2">Category</th>
                  <th className="table-header px-3 py-2">Item</th>
                  <th className="table-header px-3 py-2 w-24">Grade</th>
                  <th className="table-header px-3 py-2 w-28">Position</th>
                  <th className="table-header px-3 py-2 w-24">Marks</th>
                  <th className="table-header px-3 py-2 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const ed = editing[r.participationId];
                  const isEditing = !!ed;
                  return (
                    <tr
                      key={r.participationId}
                      className={classNames('border-t border-ink-100 hover:bg-ink-50/40', selected.has(r.participationId) && 'bg-brand-50/40')}
                      onClick={() => toggleSelect(r.participationId)}
                    >
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={selected.has(r.participationId)} onChange={() => toggleSelect(r.participationId)} />
                      </td>
                      <td className="px-3 py-2 font-medium text-ink-900">{r.studentName}</td>
                      <td className="px-3 py-2">{nilIfEmpty(r.className)}</td>
                      <td className="px-3 py-2">{nilIfEmpty(r.category)}</td>
                      <td className="px-3 py-2">{nilIfEmpty(r.item)}</td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <input className="input py-1" value={ed.grade} onChange={(e) => setField(r.participationId, 'grade', e.target.value)} autoFocus />
                        ) : (
                          <span onDoubleClick={() => startEdit(r)}>{nilIfEmpty(r.grade)}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <input className="input py-1" value={ed.position} onChange={(e) => setField(r.participationId, 'position', e.target.value)} />
                        ) : (
                          <span onDoubleClick={() => startEdit(r)}>{nilIfEmpty(r.position)}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <input className="input py-1" value={ed.marks} onChange={(e) => setField(r.participationId, 'marks', e.target.value)} />
                        ) : (
                          <span onDoubleClick={() => startEdit(r)}>{nilIfEmpty(r.marks)}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <button className="btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); saveRow(r); }}><Save size={12} /></button>
                        ) : (
                          <button className="btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); startEdit(r); }}>Edit</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="text-xs text-ink-400 mt-2">Double-click a cell to edit, or select rows and use bulk apply. Empty values show as NIL.</p>

      <CsvPreviewModal
        open={!!csvPreview}
        result={csvPreview}
        onClose={() => setCsvPreview(null)}
        onConfirm={confirmResultsImport}
        title="Import Results from CSV"
        confirmLabel="Import & Create Records"
      />
    </div>
  );
}
