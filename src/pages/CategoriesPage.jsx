import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
} from 'lucide-react';
import { useCategories, useItems, useParticipations } from '@/hooks/useDb';
import { db, TABLES } from '@/db/dexie';
import { makeCategory, makeItem } from '@/db/schema';
import { nowISO, SYNC_STATUS } from '@/utils';
import { DEFAULT_ITEM_NAME } from '@/constants';
import { useAppStore } from '@/stores/appStore';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';

export default function CategoriesPage() {
  const categories = useCategories();
  const allItems = useItems();
  const participations = useParticipations();
  const addToast = useAppStore((s) => s.addToast);
  const [expanded, setExpanded] = useState(null);
  const [catModal, setCatModal] = useState(null); // {mode, name, id}
  const [itemModal, setItemModal] = useState(null); // {categoryId, name, id}
  const [confirm, setConfirm] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function onDragEndCategory(e) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const order = categories.map((c) => c.id);
    const oldI = order.indexOf(active.id);
    const newI = order.indexOf(over.id);
    const newOrder = arrayMove(order, oldI, newI);
    const updates = newOrder.map((id, i) => ({
      ...categories.find((c) => c.id === id),
      order: i,
      updatedAt: nowISO(),
      syncStatus: SYNC_STATUS.PENDING,
    }));
    await db.table(TABLES.categories).bulkPut(updates);
  }

  async function onDragEndItem(e, categoryId) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const items = (allItems || []).filter((i) => i.categoryId === categoryId).sort((a, b) => a.order - b.order);
    const order = items.map((i) => i.id);
    const oldI = order.indexOf(active.id);
    const newI = order.indexOf(over.id);
    const newOrder = arrayMove(order, oldI, newI);
    const updates = newOrder.map((id, i) => ({
      ...items.find((it) => it.id === id),
      order: i,
      updatedAt: nowISO(),
      syncStatus: SYNC_STATUS.PENDING,
    }));
    await db.table(TABLES.items).bulkPut(updates);
  }

  async function saveCategory() {
    const name = (catModal.name || '').trim();
    if (!name) return;
    if (catModal.mode === 'edit') {
      await db.table(TABLES.categories).put({
        ...categories.find((c) => c.id === catModal.id),
        name,
        updatedAt: nowISO(),
        syncStatus: SYNC_STATUS.PENDING,
      });
      addToast({ type: 'success', message: 'Category renamed.' });
    } else {
      const order = (categories || []).length;
      const cat = makeCategory({ name, order });
      const item = makeItem({ categoryId: cat.id, name: DEFAULT_ITEM_NAME, order: 0 });
      await db.table(TABLES.categories).put(cat);
      await db.table(TABLES.items).put(item);
      addToast({ type: 'success', message: 'Category added.' });
    }
    setCatModal(null);
  }

  async function saveItem() {
    const name = (itemModal.name || '').trim();
    if (!name) return;
    if (itemModal.mode === 'edit') {
      await db.table(TABLES.items).put({
        ...allItems.find((i) => i.id === itemModal.id),
        name,
        updatedAt: nowISO(),
        syncStatus: SYNC_STATUS.PENDING,
      });
      addToast({ type: 'success', message: 'Item renamed.' });
    } else {
      const items = (allItems || []).filter((i) => i.categoryId === itemModal.categoryId);
      const order = items.length;
      const item = makeItem({ categoryId: itemModal.categoryId, name, order });
      await db.table(TABLES.items).put(item);
      addToast({ type: 'success', message: 'Item added.' });
    }
    setItemModal(null);
  }

  async function deleteCategory(cat) {
    const itemCount = (allItems || []).filter((i) => i.categoryId === cat.id).length;
    const partCount = (participations || []).filter((p) => p.categoryId === cat.id).length;
    if (partCount > 0 || itemCount > 0) {
      setConfirm({ type: 'category', cat });
      return;
    }
    await db.table(TABLES.categories).delete(cat.id);
    await db.table(TABLES.items).where('categoryId').equals(cat.id).delete();
    addToast({ type: 'success', message: 'Category deleted.' });
  }

  async function forceDeleteCategory(cat) {
    await db.table(TABLES.participations).where('categoryId').equals(cat.id).delete();
    await db.table(TABLES.results).where('categoryId').equals(cat.id).delete();
    await db.table(TABLES.items).where('categoryId').equals(cat.id).delete();
    await db.table(TABLES.categories).delete(cat.id);
    addToast({ type: 'success', message: 'Category and related data deleted.' });
    setConfirm(null);
  }

  async function deleteItem(item) {
    const siblings = (allItems || []).filter((i) => i.categoryId === item.categoryId);
    const partCount = (participations || []).filter((p) => p.itemId === item.id).length;
    if (siblings.length <= 1) {
      addToast({ type: 'warning', message: 'A category must keep at least one item. Add another item first.' });
      return;
    }
    if (partCount > 0) {
      setConfirm({ type: 'item', item });
      return;
    }
    await db.table(TABLES.items).delete(item.id);
    addToast({ type: 'success', message: 'Item deleted.' });
  }

  async function forceDeleteItem(item) {
    await db.table(TABLES.participations).where('itemId').equals(item.id).delete();
    await db.table(TABLES.results).where('itemId').equals(item.id).delete();
    await db.table(TABLES.items).delete(item.id);
    addToast({ type: 'success', message: 'Item and related data deleted.' });
    setConfirm(null);
  }

  if (!categories || !allItems) return null;

  return (
    <div>
      <PageHeader
        title="Categories and Items"
        subtitle="Organize competition categories and their items"
        actions={
          <button className="btn-primary" onClick={() => setCatModal({ mode: 'add', name: '' })}>
            <Plus size={16} /> Add Category
          </button>
        }
      />

      {categories.length === 0 ? (
        <EmptyState icon={LayoutGrid} title="No categories" description="Add your first category." />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEndCategory}>
          <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {categories.map((cat) => {
                const items = allItems.filter((i) => i.categoryId === cat.id).sort((a, b) => a.order - b.order);
                const isOpen = expanded === cat.id;
                return (
                  <SortableCategory key={cat.id} cat={cat}>
                    <div className="card">
                      <div className="flex items-center gap-2 p-3">
                        <button onClick={() => setExpanded(isOpen ? null : cat.id)} className="btn-ghost btn-icon btn-sm">
                          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                        <span className="flex-1 font-semibold text-ink-900">{cat.name}</span>
                        {cat.isDefault && <span className="chip">Default</span>}
                        <span className="chip">{items.length} item(s)</span>
                        <button className="btn-ghost btn-icon btn-sm" onClick={() => setCatModal({ mode: 'edit', id: cat.id, name: cat.name })}>
                          <Pencil size={14} />
                        </button>
                        <button className="btn-ghost btn-icon btn-sm text-danger-600" onClick={() => deleteCategory(cat)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                      {isOpen && (
                        <div className="border-t border-ink-100 p-3">
                          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => onDragEndItem(e, cat.id)}>
                            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                              <div className="space-y-2">
                                {items.map((item) => (
                                  <SortableItem key={item.id} item={item}>
                                    <div className="flex items-center gap-2 rounded-lg bg-ink-50 px-3 py-2">
                                      <span className="flex-1 text-sm text-ink-700">{item.name}</span>
                                      <button className="btn-ghost btn-icon btn-sm" onClick={() => setItemModal({ mode: 'edit', categoryId: cat.id, id: item.id, name: item.name })}>
                                        <Pencil size={12} />
                                      </button>
                                      <button className="btn-ghost btn-icon btn-sm text-danger-600" onClick={() => deleteItem(item)}>
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </SortableItem>
                                ))}
                              </div>
                            </SortableContext>
                          </DndContext>
                          <button className="btn-secondary btn-sm mt-3" onClick={() => setItemModal({ mode: 'add', categoryId: cat.id, name: '' })}>
                            <Plus size={14} /> Add Item
                          </button>
                        </div>
                      )}
                    </div>
                  </SortableCategory>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Category modal */}
      <Modal
        open={!!catModal}
        onClose={() => setCatModal(null)}
        title={catModal?.mode === 'edit' ? 'Rename Category' : 'Add Category'}
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setCatModal(null)}>Cancel</button>
            <button className="btn-primary" onClick={saveCategory}>Save</button>
          </>
        }
      >
        <label className="label">Category name</label>
        <input className="input" value={catModal?.name || ''} onChange={(e) => setCatModal((m) => ({ ...m, name: e.target.value }))} placeholder="e.g. Arts" autoFocus />
      </Modal>

      {/* Item modal */}
      <Modal
        open={!!itemModal}
        onClose={() => setItemModal(null)}
        title={itemModal?.mode === 'edit' ? 'Rename Item' : 'Add Item'}
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setItemModal(null)}>Cancel</button>
            <button className="btn-primary" onClick={saveItem}>Save</button>
          </>
        }
      >
        <label className="label">Item name</label>
        <input className="input" value={itemModal?.name || ''} onChange={(e) => setItemModal((m) => ({ ...m, name: e.target.value }))} placeholder="e.g. Margamkali" autoFocus />
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        danger
        title={confirm?.type === 'category' ? 'Delete category with data?' : 'Delete item with data?'}
        message={
          confirm?.type === 'category'
            ? 'This category has items/participations. Deleting will remove all related participation and result data. This cannot be undone.'
            : 'This item has participations. Deleting will remove related participation and result data. This cannot be undone.'
        }
        confirmLabel="Delete all"
        onConfirm={() => (confirm?.type === 'category' ? forceDeleteCategory(confirm.cat) : forceDeleteItem(confirm.item))}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

function SortableCategory({ cat, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className="flex items-stretch">
        <button {...listeners} className="px-2 cursor-grab active:cursor-grabbing text-ink-300 hover:text-ink-500 touch-none flex items-center">
          <GripVertical size={18} />
        </button>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}

function SortableItem({ item, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center">
      <button {...listeners} className="px-1 cursor-grab active:cursor-grabbing text-ink-300 hover:text-ink-500 touch-none">
        <GripVertical size={14} />
      </button>
      <div className="flex-1">{children}</div>
    </div>
  );
}
