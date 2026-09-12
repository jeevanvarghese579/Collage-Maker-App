import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  UserPlus,
  Eye,
  Search,
  Plus,
  Minus,
  ClipboardList,
  X,
  Pencil,
  FolderPlus,
} from 'lucide-react';
import {
  useCategories,
  useItems,
  useStudents,
  useParticipations,
} from '@/hooks/useDb';
import { db, TABLES } from '@/db/dexie';
import { makeParticipation, makeCategory, makeItem } from '@/db/schema';
import { classNames, nilIfEmpty } from '@/utils';
import { useAppStore } from '@/stores/appStore';
import { useStudentPhoto } from '@/hooks/useApp';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import Modal from '@/components/common/Modal';
import StudentFormModal from '@/components/students/StudentFormModal';
import { DEFAULT_ITEM_NAME } from '@/constants';

export default function ParticipationPage() {
  const categories = useCategories();
  const allItems = useItems();
  const students = useStudents();
  const participations = useParticipations();
  const addToast = useAppStore((s) => s.addToast);
  const [expanded, setExpanded] = useState(null);
  const [addModal, setAddModal] = useState(null); // {item, categoryId}
  const [viewModal, setViewModal] = useState(null); // {item}
  const [studentForm, setStudentForm] = useState(null); // {editing}
  const [createModal, setCreateModal] = useState(null); // {type, name, categoryId}

  async function createCategoryOrItem() {
    const name = createModal?.name?.trim();
    if (!name) return;
    if (createModal.type === 'category') {
      const category = makeCategory({ name, order: categories.length });
      await db.table(TABLES.categories).put(category);
      await db.table(TABLES.items).put(makeItem({ categoryId: category.id, name: DEFAULT_ITEM_NAME, order: 0 }));
      setExpanded(category.id);
      addToast({ type: 'success', message: 'Category created.' });
    } else {
      const categoryItems = allItems.filter((item) => item.categoryId === createModal.categoryId);
      await db.table(TABLES.items).put(makeItem({ categoryId: createModal.categoryId, name, order: categoryItems.length }));
      setExpanded(createModal.categoryId);
      addToast({ type: 'success', message: 'Item created.' });
    }
    setCreateModal(null);
  }

  const partsByItem = useMemo(() => {
    const map = new Map();
    (participations || []).forEach((p) => {
      if (!map.has(p.itemId)) map.set(p.itemId, []);
      map.get(p.itemId).push(p);
    });
    return map;
  }, [participations]);

  async function addParticipation(studentId, item, categoryId) {
    const existing = (participations || []).find(
      (p) => p.studentId === studentId && p.itemId === item.id
    );
    if (existing) {
      addToast({ type: 'info', message: 'Student already participates in this item.' });
      return false;
    }
    const part = makeParticipation({ studentId, categoryId, itemId: item.id });
    await db.table(TABLES.participations).put(part);
    return true;
  }

  async function removeParticipation(partId) {
    await db.table(TABLES.participations).delete(partId);
    await db.table(TABLES.results).where('participationId').equals(partId).delete();
  }

  if (!categories || !allItems || !students || !participations) return null;

  return (
    <div>
      <PageHeader
        title="Participation Entry"
        subtitle="Assign students to category items"
        actions={<>
          <button className="btn-secondary" onClick={() => setCreateModal({ type: 'category', name: '' })}><FolderPlus size={16} /> New Category</button>
          <button className="btn-primary" disabled={categories.length === 0} onClick={() => setCreateModal({ type: 'item', name: '', categoryId: expanded || categories[0]?.id })}><Plus size={16} /> New Item</button>
        </>}
      />
      {categories.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No categories" description="Create categories first." />
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => {
            const items = allItems.filter((i) => i.categoryId === cat.id).sort((a, b) => a.order - b.order);
            const isOpen = expanded === cat.id;
            return (
              <div key={cat.id} className="card overflow-hidden">
                <button
                  className="flex items-center gap-3 w-full p-4 text-left hover:bg-ink-50/50"
                  onClick={() => setExpanded(isOpen ? null : cat.id)}
                >
                  {isOpen ? <ChevronDown size={18} className="text-ink-400" /> : <ChevronRight size={18} className="text-ink-400" />}
                  <span className="font-display font-semibold text-ink-900 flex-1">{cat.name}</span>
                  <span className="chip">{items.length} items</span>
                </button>
                {isOpen && (
                  <div className="border-t border-ink-100 divide-y divide-ink-100">
                    {items.map((item) => {
                      const parts = partsByItem.get(item.id) || [];
                      return (
                        <div key={item.id} className="flex items-center gap-3 p-3">
                          <div className="flex-1">
                            <p className="font-medium text-sm text-ink-900">{item.name}</p>
                            <p className="text-xs text-ink-500">{parts.length} student(s)</p>
                          </div>
                          <button className="btn-secondary btn-sm" onClick={() => setViewModal({ item })}>
                            <Eye size={14} /> View
                          </button>
                          <button className="btn-primary btn-sm" onClick={() => setAddModal({ item, categoryId: cat.id })}>
                            <UserPlus size={14} /> Add Students
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AddStudentsModal
        data={{ addModal, students, participations }}
        onClose={() => setAddModal(null)}
        onAdd={(sid) => addParticipation(sid, addModal.item, addModal.categoryId)}
        onNewStudent={() => setStudentForm({ editing: null })}
        onEditStudent={(student) => setStudentForm({ editing: student })}
      />
      <StudentFormModal open={!!studentForm} editing={studentForm?.editing} onClose={() => setStudentForm(null)} />
      <Modal
        open={!!createModal}
        onClose={() => setCreateModal(null)}
        title={createModal?.type === 'category' ? 'Create Category' : 'Create Item'}
        size="sm"
        footer={<><button className="btn-secondary" onClick={() => setCreateModal(null)}>Cancel</button><button className="btn-primary" onClick={createCategoryOrItem} disabled={!createModal?.name?.trim()}>Create</button></>}
      >
        <div className="space-y-4">
          {createModal?.type === 'item' && <div><label className="label">Category</label><select className="select" value={createModal.categoryId} onChange={(e) => setCreateModal((m) => ({ ...m, categoryId: e.target.value }))}>{categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}</select></div>}
          <div><label className="label">Name</label><input autoFocus className="input" value={createModal?.name || ''} onChange={(e) => setCreateModal((m) => ({ ...m, name: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') createCategoryOrItem(); }} /></div>
        </div>
      </Modal>
      <ViewStudentsModal
        data={{ viewModal, students, participations }}
        onClose={() => setViewModal(null)}
        onRemove={removeParticipation}
      />
    </div>
  );
}

function AddStudentsModal({ data, onClose, onAdd, onNewStudent, onEditStudent }) {
  const { addModal, students, participations } = data;
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [selected, setSelected] = useState(new Set());
  const addToast = useAppStore((s) => s.addToast);

  const classes = useMemo(
    () => [...new Set((students || []).map((s) => s.className).filter(Boolean))].sort(),
    [students]
  );

  const filtered = useMemo(() => {
    if (!students) return [];
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (classFilter && s.className !== classFilter) return false;
      if (genderFilter && s.gender !== genderFilter) return false;
      if (q) {
        const hay = `${s.name} ${s.rollNumber} ${s.admissionNumber} ${s.className}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [students, search, classFilter, genderFilter]);

  if (!addModal) return null;
  const itemId = addModal.item.id;
  const existingIds = new Set(
    (participations || []).filter((p) => p.itemId === itemId).map((p) => p.studentId)
  );

  function toggle(sid) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      filtered.forEach((s) => next.add(s.id));
      return next;
    });
  }

  async function addSelected() {
    let added = 0;
    for (const sid of selected) {
      const ok = await onAdd(sid);
      if (ok) added++;
    }
    addToast({ type: 'success', message: `Added ${added} student(s).` });
    setSelected(new Set());
    onClose();
  }

  return (
    <Modal
      open={!!addModal}
      onClose={onClose}
      title={`Add Students — ${addModal.item.name}`}
      size="xl"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Close</button>
          <button className="btn-primary" onClick={addSelected} disabled={selected.size === 0}>
            <Plus size={16} /> Add Selected ({selected.size})
          </button>
        </>
      }
    >
      <div className="flex flex-wrap gap-2 mb-3">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input className="input pl-9" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="select w-auto" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
          <option value="">All classes</option>
          {classes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="select w-auto" value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)}>
          <option value="">All genders</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
        </select>
        <button className="btn-ghost btn-sm" onClick={() => { setSearch(''); setClassFilter(''); setGenderFilter(''); }}>Clear filters</button>
        <button className="btn-ghost btn-sm" onClick={selectAllVisible}>Select all visible</button>
        <button className="btn-primary btn-sm" onClick={onNewStudent}><UserPlus size={14} /> New Student</button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-ink-200 max-h-[50vh]">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 sticky top-0">
            <tr>
              <th className="table-header px-3 py-2">Photo</th>
              <th className="table-header px-3 py-2">Name</th>
              <th className="table-header px-3 py-2">Class</th>
              <th className="table-header px-3 py-2">Gender</th>
              <th className="table-header px-3 py-2">Roll</th>
              <th className="table-header px-3 py-2">Admission</th>
              <th className="table-header px-3 py-2 text-center">Status</th>
              <th className="table-header px-3 py-2 text-center">Edit</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const already = existingIds.has(s.id);
              const isSel = selected.has(s.id);
              return (
                <tr key={s.id} className={classNames('border-t border-ink-100', isSel && 'bg-brand-50/50')}>
                  <td className="px-3 py-2">
                    <Thumb student={s} />
                  </td>
                  <td className="px-3 py-2 font-medium text-ink-900">{s.name}</td>
                  <td className="px-3 py-2">{nilIfEmpty(s.className)}</td>
                  <td className="px-3 py-2">{nilIfEmpty(s.gender)}</td>
                  <td className="px-3 py-2">{nilIfEmpty(s.rollNumber)}</td>
                  <td className="px-3 py-2">{nilIfEmpty(s.admissionNumber)}</td>
                  <td className="px-3 py-2 text-center">
                    {already ? (
                      <span className="chip chip-success">Participating</span>
                    ) : isSel ? (
                      <button className="btn-danger btn-sm" onClick={() => toggle(s.id)}>
                        <Minus size={12} /> Remove
                      </button>
                    ) : <button className="btn-secondary btn-sm" onClick={() => toggle(s.id)}><Plus size={12} /> Add</button>}
                  </td>
                  <td className="px-3 py-2 text-center"><button className="btn-ghost btn-icon btn-sm" title="Edit student" onClick={() => onEditStudent(s)}><Pencil size={13} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

function ViewStudentsModal({ data, onClose, onRemove }) {
  const { viewModal, students, participations } = data;
  if (!viewModal) return null;
  const itemId = viewModal.item.id;
  const parts = (participations || []).filter((p) => p.itemId === itemId);
  const studentMap = new Map((students || []).map((s) => [s.id, s]));
  return (
    <Modal
      open={!!viewModal}
      onClose={onClose}
      title={`Participating — ${viewModal.item.name}`}
      size="lg"
      footer={<button className="btn-secondary" onClick={onClose}>Close</button>}
    >
      {parts.length === 0 ? (
        <EmptyState icon={UserPlus} title="No participants yet" description="Add students to this item." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-ink-200 max-h-[50vh]">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 sticky top-0">
              <tr>
                <th className="table-header px-3 py-2">Photo</th>
                <th className="table-header px-3 py-2">Name</th>
                <th className="table-header px-3 py-2">Class</th>
                <th className="table-header px-3 py-2">Roll</th>
                <th className="table-header px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {parts.map((p) => {
                const s = studentMap.get(p.studentId);
                if (!s) return null;
                return (
                  <tr key={p.id} className="border-t border-ink-100">
                    <td className="px-3 py-2"><Thumb student={s} /></td>
                    <td className="px-3 py-2 font-medium text-ink-900">{s.name}</td>
                    <td className="px-3 py-2">{nilIfEmpty(s.className)}</td>
                    <td className="px-3 py-2">{nilIfEmpty(s.rollNumber)}</td>
                    <td className="px-3 py-2 text-right">
                      <button className="btn-danger btn-sm" onClick={() => onRemove(p.id)}>
                        <X size={12} /> Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

function Thumb({ student }) {
  const url = useStudentPhoto(student);
  return (
    <div className="w-8 h-10 rounded bg-ink-100 overflow-hidden">
      {url && <img src={url} alt="" className="w-full h-full object-cover" />}
    </div>
  );
}
