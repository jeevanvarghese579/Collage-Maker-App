import { useMemo, useRef, useState } from 'react';
import {
  Plus,
  Upload,
  Download,
  FileDown,
  Search,
  LayoutGrid,
  List,
  Pencil,
  Trash2,
  Users,
  CheckSquare,
  Square,
} from 'lucide-react';
import { useStudents } from '@/hooks/useDb';
import { useAppStore } from '@/stores/appStore';
import { db, TABLES } from '@/db/dexie';
import { deleteBlob } from '@/db/blobs';
import { makeStudent } from '@/db/schema';
import { nowISO, SYNC_STATUS, classNames, sortByName, nilIfEmpty } from '@/utils';
import { GENDERS } from '@/constants';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import { TableSkeleton } from '@/components/common/EmptyState';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import StudentFormModal from '@/components/students/StudentFormModal';
import CsvPreviewModal from '@/components/common/CsvPreviewModal';
import { useStudentPhoto } from '@/hooks/useApp';
import {
  parseStudentCsv,
  exportStudentsCsv,
  exportBlankStudentsCsv,
} from '@/services/csvService';

const PAGE_SIZE = 24;

export default function StudentsPage() {
  const students = useStudents();
  const addToast = useAppStore((s) => s.addToast);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [view, setView] = useState('card');
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(new Set());
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [csvPreview, setCsvPreview] = useState(null);
  const [bulkClass, setBulkClass] = useState('');
  const importRef = useRef(null);

  const classes = useMemo(
    () => [...new Set((students || []).map((s) => s.className).filter(Boolean))].sort(),
    [students]
  );

  const filtered = useMemo(() => {
    if (!students) return [];
    const q = search.trim().toLowerCase();
    let list = students.filter((s) => {
      if (classFilter && s.className !== classFilter) return false;
      if (genderFilter && s.gender !== genderFilter) return false;
      if (q) {
        const hay = `${s.name} ${s.rollNumber} ${s.admissionNumber} ${s.className}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      switch (sortKey) {
        case 'name': return sortByName(a, b);
        case 'className': return (a.className || '').localeCompare(b.className || '');
        case 'rollNumber': return (a.rollNumber || '').localeCompare(b.rollNumber || '', undefined, { numeric: true });
        case 'admissionNumber': return (a.admissionNumber || '').localeCompare(b.admissionNumber || '');
        case 'gender': return (a.gender || '').localeCompare(b.gender || '');
        default: return 0;
      }
    });
    return list;
  }, [students, search, classFilter, genderFilter, sortKey]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(s) {
    setEditing(s);
    setFormOpen(true);
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      pageItems.forEach((s) => next.add(s.id));
      return next;
    });
  }
  function clearSelection() {
    setSelected(new Set());
  }

  async function deleteStudent(s) {
    await db.table(TABLES.students).delete(s.id);
    if (s.photoBlobId) {
      await deleteBlob(s.photoBlobId);
    }
    // Cascade: remove participations & results.
    const parts = await db.table(TABLES.participations).where('studentId').equals(s.id).toArray();
    const partIds = parts.map((p) => p.id);
    if (partIds.length) {
      await db.table(TABLES.participations).bulkDelete(partIds);
      await db.table(TABLES.results).where('participationId').anyOf(partIds).delete();
    }
    addToast({ type: 'success', message: 'Student deleted.' });
  }

  async function bulkDelete() {
    const ids = [...selected];
    for (const id of ids) {
      const s = await db.table(TABLES.students).get(id);
      if (s) await deleteStudent(s);
    }
    clearSelection();
    setConfirmDelete(null);
  }

  async function bulkUpdateClass() {
    if (!bulkClass) return;
    const ids = [...selected];
    const recs = await db.table(TABLES.students).bulkGet(ids);
    const updates = recs.filter(Boolean).map((r) => ({
      ...r,
      className: bulkClass,
      updatedAt: nowISO(),
      syncStatus: SYNC_STATUS.PENDING,
    }));
    await db.table(TABLES.students).bulkPut(updates);
    addToast({ type: 'success', message: `Updated class for ${updates.length} students.` });
    setBulkClass('');
    clearSelection();
  }

  async function onImportFile(e) {
    const file = e.target.files?.[0];
    if (file) {
      const res = await parseStudentCsv(file);
      setCsvPreview(res);
    }
    e.target.value = '';
  }

  async function confirmStudentImport(result) {
    const recs = result.valid.map((r) =>
      makeStudent({
        name: r.name,
        gender: r.gender,
        rollNumber: r.rollNumber,
        admissionNumber: r.admissionNumber,
        className: r.className,
      })
    );
    await db.table(TABLES.students).bulkPut(recs);
    addToast({ type: 'success', message: `Imported ${recs.length} students.` });
    setCsvPreview(null);
  }

  if (!students) return <TableSkeleton />;
  return (
    <div>
      <PageHeader
        title="Student Details"
        subtitle={`${students.length} students total`}
        actions={
          <>
            <button className="btn-primary" onClick={openAdd}>
              <Plus size={16} /> Add Student
            </button>
            <button className="btn-secondary" onClick={() => importRef.current?.click()}>
              <Upload size={16} /> Import CSV
            </button>
            <button className="btn-secondary" onClick={() => exportStudentsCsv(students)}>
              <Download size={16} /> Export CSV
            </button>
            <button className="btn-secondary" onClick={exportBlankStudentsCsv}>
              <FileDown size={16} /> Blank CSV
            </button>
            <input ref={importRef} type="file" accept=".csv" className="hidden" onChange={onImportFile} />
          </>
        }
      />

      {/* Filters */}
      <div className="card p-4 mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            className="input pl-9"
            placeholder="Search name, roll, admission…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select className="select w-auto" value={classFilter} onChange={(e) => { setClassFilter(e.target.value); setPage(1); }}>
          <option value="">All classes</option>
          {classes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="select w-auto" value={genderFilter} onChange={(e) => { setGenderFilter(e.target.value); setPage(1); }}>
          <option value="">All genders</option>
          {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select className="select w-auto" value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
          <option value="name">Sort: Name</option>
          <option value="className">Sort: Class</option>
          <option value="rollNumber">Sort: Roll</option>
          <option value="admissionNumber">Sort: Admission</option>
          <option value="gender">Sort: Gender</option>
        </select>
        <div className="flex rounded-lg border border-ink-200 overflow-hidden">
          <button className={classNames('px-3 py-2', view === 'card' ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:bg-ink-50')} onClick={() => setView('card')} title="Card view">
            <LayoutGrid size={16} />
          </button>
          <button className={classNames('px-3 py-2', view === 'table' ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:bg-ink-50')} onClick={() => setView('table')} title="Table view">
            <List size={16} />
          </button>
        </div>
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="card p-3 mb-4 flex flex-wrap items-center gap-3 bg-brand-50/50">
          <span className="chip chip-brand">{selected.size} selected</span>
          <button className="btn-ghost btn-sm" onClick={selectAllVisible}>Select all visible</button>
          <button className="btn-ghost btn-sm" onClick={clearSelection}>Clear</button>
          <div className="flex items-center gap-2 ml-auto">
            <input className="input w-32" placeholder="Class" value={bulkClass} onChange={(e) => setBulkClass(e.target.value)} />
            <button className="btn-secondary btn-sm" onClick={bulkUpdateClass} disabled={!bulkClass}>Set Class</button>
            <button className="btn-danger btn-sm" onClick={() => setConfirmDelete({ bulk: true })}>Delete</button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No students found"
          description="Add students manually or import from a CSV file."
          action={<button className="btn-primary" onClick={openAdd}><Plus size={16} /> Add Student</button>}
        />
      ) : view === 'card' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {pageItems.map((s) => (
            <StudentCard
              key={s.id}
              student={s}
              selected={selected.has(s.id)}
              onToggle={() => toggleSelect(s.id)}
              onEdit={() => openEdit(s)}
              onDelete={() => setConfirmDelete({ student: s })}
            />
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 border-b border-ink-100">
                <tr>
                  <th className="px-3 py-3 w-10"></th>
                  <th className="table-header px-3 py-3">Photo</th>
                  <th className="table-header px-3 py-3">Name</th>
                  <th className="table-header px-3 py-3">Class</th>
                  <th className="table-header px-3 py-3">Gender</th>
                  <th className="table-header px-3 py-3">Roll</th>
                  <th className="table-header px-3 py-3">Admission</th>
                  <th className="table-header px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((s) => (
                  <StudentRow
                    key={s.id}
                    student={s}
                    selected={selected.has(s.id)}
                    onToggle={() => toggleSelect(s.id)}
                    onEdit={() => openEdit(s)}
                    onDelete={() => setConfirmDelete({ student: s })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button className="btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span className="text-sm text-ink-600">Page {page} of {pageCount}</span>
          <button className="btn-secondary btn-sm" disabled={page === pageCount} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}

      <StudentFormModal open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
      <CsvPreviewModal
        open={!!csvPreview}
        result={csvPreview}
        onClose={() => setCsvPreview(null)}
        onConfirm={confirmStudentImport}
        title="Import Students from CSV"
      />
      <ConfirmDialog
        open={!!confirmDelete}
        danger
        title={confirmDelete?.bulk ? `Delete ${selected.size} students?` : 'Delete student?'}
        message="This also removes their participations and results. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => (confirmDelete?.bulk ? bulkDelete() : (deleteStudent(confirmDelete.student), setConfirmDelete(null)))}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function StudentCard({ student, selected, onToggle, onEdit, onDelete }) {
  const photoUrl = useStudentPhoto(student);
  return (
    <div className={classNames('card overflow-hidden transition-all', selected && 'ring-2 ring-brand-500')}>
      <div className="relative aspect-[3/4] bg-ink-100">
        {photoUrl ? (
          <img src={photoUrl} alt={student.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-ink-300 text-xs">No Photo</div>
        )}
        <button
          onClick={onToggle}
          className="absolute top-2 left-2 bg-white/90 rounded p-1 hover:bg-white"
          aria-label="Select"
        >
          {selected ? <CheckSquare size={16} className="text-brand-600" /> : <Square size={16} className="text-ink-400" />}
        </button>
      </div>
      <div className="p-3">
        <p className="font-semibold text-sm text-ink-900 truncate">{student.name}</p>
        <p className="text-xs text-ink-500 mt-0.5">{nilIfEmpty(student.className)} · {nilIfEmpty(student.rollNumber)}</p>
        <div className="flex gap-1 mt-2">
          <button className="btn-ghost btn-icon btn-sm" onClick={onEdit} title="Edit"><Pencil size={14} /></button>
          <button className="btn-ghost btn-icon btn-sm text-danger-600" onClick={onDelete} title="Delete"><Trash2 size={14} /></button>
        </div>
      </div>
    </div>
  );
}

function StudentRow({ student, selected, onToggle, onEdit, onDelete }) {
  const photoUrl = useStudentPhoto(student);
  return (
    <tr className="border-b border-ink-100 hover:bg-ink-50/50">
      <td className="px-3 py-2">
        <button onClick={onToggle} aria-label="Select">
          {selected ? <CheckSquare size={16} className="text-brand-600" /> : <Square size={16} className="text-ink-300" />}
        </button>
      </td>
      <td className="px-3 py-2">
        <div className="w-9 h-12 rounded bg-ink-100 overflow-hidden">
          {photoUrl && <img src={photoUrl} alt="" className="w-full h-full object-cover" />}
        </div>
      </td>
      <td className="px-3 py-2 font-medium text-ink-900">{student.name}</td>
      <td className="px-3 py-2">{nilIfEmpty(student.className)}</td>
      <td className="px-3 py-2">{nilIfEmpty(student.gender)}</td>
      <td className="px-3 py-2">{nilIfEmpty(student.rollNumber)}</td>
      <td className="px-3 py-2">{nilIfEmpty(student.admissionNumber)}</td>
      <td className="px-3 py-2 text-right">
        <button className="btn-ghost btn-icon btn-sm" onClick={onEdit}><Pencil size={14} /></button>
        <button className="btn-ghost btn-icon btn-sm text-danger-600" onClick={onDelete}><Trash2 size={14} /></button>
      </td>
    </tr>
  );
}
