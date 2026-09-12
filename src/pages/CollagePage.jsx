import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Images,
  Search,
  Download,
  FileImage,
  FileText,
  Shuffle,
  GripVertical,
  Loader2,
  Image as ImageIcon,
  Columns3,
  X,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  useStudents,
  useCategories,
  useItems,
  useParticipations,
  useResults,
  useFrameTemplates,
} from '@/hooks/useDb';
import { db, TABLES } from '@/db/dexie';
import { getBlobUrl, getBlob } from '@/db/blobs';
import { useAppStore } from '@/stores/appStore';
import { useStudentPhoto } from '@/hooks/useApp';
import {
  estimateCollageSize,
  renderCollage,
  exportCollageJpeg,
  exportCollagePng,
  exportCollagePdf,
  exportCollageAsZipSections,
  getDetailEntries,
} from '@/services/collageExportService';
import {
  A4_WIDTH_MM,
  DEFAULT_DPI,
  DEFAULT_JPEG_QUALITY,
  COLLAGE_DETAIL_FIELDS,
  FONT_OPTIONS,
  TEXT_ALIGN_OPTIONS,
} from '@/constants';
import { mmToPx, nilIfEmpty, classNames, todayStamp } from '@/utils';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';

export default function CollagePage() {
  const students = useStudents();
  const categories = useCategories();
  const items = useItems();
  const participations = useParticipations();
  const results = useResults();
  const frames = useFrameTemplates();
  const { settings, setSettings, addToast } = useAppStore();

  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [itemFilter, setItemFilter] = useState('');
  const [posFilter, setPosFilter] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [admissionFilter, setAdmissionFilter] = useState('');
  const [rollFilter, setRollFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(null);
  const cancelRef = useRef(false);

  const activeFrame = useMemo(
    () => (frames || []).find((f) => f.enabled) || null,
    [frames]
  );

  // Build enriched student list with matched participation/result info.
  const enriched = useMemo(() => {
    if (!students) return [];
    const catMap = new Map((categories || []).map((c) => [c.id, c]));
    const itemMap = new Map((items || []).map((i) => [i.id, i]));
    const resultMap = new Map((results || []).map((r) => [r.participationId, r]));
    const partsByStudent = new Map();
    (participations || []).forEach((p) => {
      if (!partsByStudent.has(p.studentId)) partsByStudent.set(p.studentId, []);
      partsByStudent.get(p.studentId).push(p);
    });
    return students.map((s) => {
      const parts = (partsByStudent.get(s.id) || []).map((p) => {
        const r = resultMap.get(p.id);
        return {
          ...p,
          categoryName: catMap.get(p.categoryId)?.name || '',
          itemName: itemMap.get(p.itemId)?.name || '',
          grade: r?.grade || '',
          position: r?.position || '',
          marks: r?.marks || '',
        };
      });
      return { ...s, __parts: parts };
    });
  }, [students, categories, items, participations, results]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((s) => {
      if (classFilter && s.className !== classFilter) return false;
      if (genderFilter && s.gender !== genderFilter) return false;
      if (admissionFilter && s.admissionNumber !== admissionFilter) return false;
      if (rollFilter && s.rollNumber !== rollFilter) return false;
      if (q) {
        const hay = `${s.name} ${s.className} ${s.rollNumber} ${s.admissionNumber}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (catFilter || itemFilter || posFilter || gradeFilter) {
        const matches = s.__parts.some((p) =>
          (!catFilter || p.categoryName === catFilter) &&
          (!itemFilter || p.itemName === itemFilter) &&
          (!posFilter || p.position === posFilter) &&
          (!gradeFilter || p.grade === gradeFilter)
        );
        if (!matches) return false;
      }
      return true;
    });
  }, [enriched, search, classFilter, genderFilter, admissionFilter, rollFilter, catFilter, itemFilter, posFilter, gradeFilter]);

  const filterValues = useMemo(() => {
    const classes = [...new Set(enriched.map((s) => s.className).filter(Boolean))].sort();
    const cats = [...new Set((categories || []).map((c) => c.name))].sort();
    const itms = [...new Set((items || []).map((i) => i.name))].sort();
    const positions = [...new Set((results || []).map((r) => r.position).filter(Boolean))].sort();
    const grades = [...new Set((results || []).map((r) => r.grade).filter(Boolean))].sort();
    const admissions = [...new Set(enriched.map((s) => s.admissionNumber).filter(Boolean))].sort();
    const rolls = [...new Set(enriched.map((s) => s.rollNumber).filter(Boolean))].sort();
    return { classes, cats, itms, positions, grades, admissions, rolls };
  }, [enriched, categories, items, results]);

  const selected = useMemo(
    () => selectedIds.map((id) => enriched.find((s) => s.id === id)).filter(Boolean),
    [selectedIds, enriched]
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function onDragEnd(e) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setSelectedIds((ids) => {
      const oldI = ids.indexOf(active.id);
      const newI = ids.indexOf(over.id);
      return arrayMove(ids, oldI, newI);
    });
  }

  function selectAllFiltered() {
    setSelectedIds(filtered.map((s) => s.id));
  }
  function clearSelection() {
    setSelectedIds([]);
  }
  function toggleSelect(id) {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  function sortBy(key) {
    setSelectedIds((ids) => {
      const arr = ids.map((id) => enriched.find((s) => s.id === id)).filter(Boolean);
      arr.sort((a, b) => {
        if (key === 'position') {
          return (a.__parts[0]?.position || '').localeCompare(b.__parts[0]?.position || '');
        }
        return (a[key] || '').localeCompare(b[key] || '', undefined, { numeric: true });
      });
      return arr.map((s) => s.id);
    });
  }

  function randomize() {
    setSelectedIds((ids) => {
      const arr = [...ids];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    });
  }

  // Estimate export dimensions.
  const dpi = settings.dpi || DEFAULT_DPI;
  const detailLineCount = useMemo(() => {
    const v = settings.visibleDetails;
    return Object.values(v).filter((x, i) => x && i > 0).length;
  }, [settings.visibleDetails]);

  const estimate = useMemo(
    () => estimateCollageSize(Math.max(selected.length, 1), { ...settings, detailLines: detailLineCount }, dpi),
    [selected.length, settings, dpi, detailLineCount]
  );

  async function loadFrameImage() {
    if (!activeFrame?.imageBlobId) return null;
    const url = await getBlobUrl(activeFrame.imageBlobId);
    if (!url) return null;
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  // Prepare selected students with photo URLs for export.
  async function prepareExportStudents() {
    const out = [];
    for (const s of selected) {
      let photoUrl = null;
      if (s.photoBlobId) photoUrl = await getBlobUrl(s.photoBlobId);
      // attach matched participation info based on current filters
      const matched = s.__parts.filter((p) =>
        (!catFilter || p.categoryName === catFilter) &&
        (!itemFilter || p.itemName === itemFilter) &&
        (!posFilter || p.position === posFilter) &&
        (!gradeFilter || p.grade === gradeFilter)
      );
      const info = matched[0] || s.__parts[0] || {};
      out.push({
        ...s,
        __photoUrl: photoUrl,
        __categoryName: info.categoryName || '',
        __itemName: info.itemName || '',
        __position: info.position || '',
        __grade: info.grade || '',
        __marks: info.marks || '',
      });
    }
    return out;
  }

  async function doExport(format) {
    if (selected.length === 0) {
      addToast({ type: 'warning', message: 'Select at least one student.' });
      return;
    }
    setExporting(true);
    cancelRef.current = false;
    setProgress({ done: 0, total: selected.length });
    try {
      const frameImg = await loadFrameImage();
      const exportStudents = await prepareExportStudents();
      const config = {
        ...settings,
        detailLines: detailLineCount,
        frameEnabled: activeFrame?.enabled && !!frameImg,
        frameWidthScale: activeFrame?.widthScale || 1,
        frameHeightScale: activeFrame?.heightScale || 1,
        frameOffsetX: activeFrame?.offsetX || 0,
        frameOffsetY: activeFrame?.offsetY || 0,
      };
      const result = await renderCollage({
        students: exportStudents,
        config,
        frameImage: frameImg,
        onProgress: (p) => setProgress(p),
        shouldCancel: () => cancelRef.current,
      });
      if (result.cancelled) {
        addToast({ type: 'info', message: 'Export cancelled.' });
        return;
      }
      if (result.tooLarge) {
        addToast({ type: 'error', message: `Canvas too large (${result.estimated.heightPx}px). Use lower DPI, fewer columns, or section export.` });
        return;
      }
      if (format === 'jpeg') {
        await exportCollageJpeg(result, `School-Collage-${todayStamp()}.jpg`);
        addToast({ type: 'success', message: 'JPEG exported.' });
      } else if (format === 'png') {
        await exportCollagePng(result, `School-Collage-${todayStamp()}.png`);
        addToast({ type: 'success', message: 'PNG exported.' });
      } else if (format === 'pdf') {
        await exportCollagePdf(result, `School-Collage-${todayStamp()}.pdf`);
        addToast({ type: 'success', message: 'PDF exported.' });
      }
    } catch (e) {
      addToast({ type: 'error', message: `Export failed: ${e.message}` });
    } finally {
      setExporting(false);
      setProgress(null);
    }
  }

  async function doExportSections() {
    if (selected.length === 0) return;
    setExporting(true);
    cancelRef.current = false;
    try {
      const frameImg = await loadFrameImage();
      const exportStudents = await prepareExportStudents();
      const config = {
        ...settings,
        detailLines: detailLineCount,
        frameEnabled: activeFrame?.enabled && !!frameImg,
        frameWidthScale: activeFrame?.widthScale || 1,
        frameHeightScale: activeFrame?.heightScale || 1,
        frameOffsetX: activeFrame?.offsetX || 0,
        frameOffsetY: activeFrame?.offsetY || 0,
      };
      await exportCollageAsZipSections({
        students: exportStudents,
        config,
        frameImage: frameImg,
        onProgress: setProgress,
        shouldCancel: () => cancelRef.current,
      });
      addToast({ type: 'success', message: 'Sections ZIP exported.' });
    } finally {
      setExporting(false);
      setProgress(null);
    }
  }

  if (!students) return null;

  return (
    <div>
      <PageHeader
        title="Create Collage"
        subtitle={`${filtered.length} matching students · ${selected.length} selected`}
        actions={
          <>
            <button className="btn-primary" onClick={() => doExport('jpeg')} disabled={exporting}>
              {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              Export JPEG
            </button>
            <button className="btn-secondary" onClick={() => doExport('png')} disabled={exporting}>
              <FileImage size={16} /> PNG
            </button>
            <button className="btn-secondary" onClick={() => doExport('pdf')} disabled={exporting}>
              <FileText size={16} /> PDF
            </button>
            <button className="btn-secondary" onClick={doExportSections} disabled={exporting}>
              <Images size={16} /> Sections ZIP
            </button>
          </>
        }
      />

      {exporting && (
        <div className="card p-4 mb-4 bg-brand-50/50 flex items-center gap-3">
          <Loader2 size={20} className="animate-spin text-brand-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-ink-700">Rendering collage…</p>
            {progress && (
              <div className="h-2 bg-ink-200 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-brand-600 transition-all" style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
              </div>
            )}
          </div>
          <button className="btn-danger btn-sm" onClick={() => { cancelRef.current = true; }}>Cancel</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Left: filters + selection */}
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[140px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input className="input pl-9" placeholder="Search name…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <select className="select w-auto" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
                <option value="">All classes</option>
                {filterValues.classes.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="select w-auto" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
                <option value="">All categories</option>
                {filterValues.cats.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="select w-auto" value={itemFilter} onChange={(e) => setItemFilter(e.target.value)}>
                <option value="">All items</option>
                {filterValues.itms.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="select w-auto" value={posFilter} onChange={(e) => setPosFilter(e.target.value)}>
                <option value="">All positions</option>
                {filterValues.positions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="select w-auto" value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}>
                <option value="">All grades</option>
                {filterValues.grades.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="select w-auto" value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)}>
                <option value="">All genders</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <button className="btn-secondary btn-sm" onClick={selectAllFiltered}>Select all filtered</button>
              <button className="btn-ghost btn-sm" onClick={clearSelection}>Clear selection</button>
              <span className="text-xs text-ink-400 mx-1">Sort:</span>
              <button className="btn-ghost btn-sm" onClick={() => sortBy('name')}>Name</button>
              <button className="btn-ghost btn-sm" onClick={() => sortBy('className')}>Class</button>
              <button className="btn-ghost btn-sm" onClick={() => sortBy('rollNumber')}>Roll</button>
              <button className="btn-ghost btn-sm" onClick={() => sortBy('admissionNumber')}>Admission</button>
              <button className="btn-ghost btn-sm" onClick={() => sortBy('position')}>Position</button>
              <button className="btn-ghost btn-sm" onClick={randomize}><Shuffle size={12} /> Random</button>
            </div>
          </div>

          {/* Selected order list */}
          {selected.length > 0 && (
            <div className="card p-4">
              <h3 className="font-semibold text-sm text-ink-900 mb-3">Selected Students ({selected.length}) — drag to reorder</h3>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={selectedIds} strategy={verticalListSortingStrategy}>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {selected.map((s) => (
                      <SortableSelected key={s.id} id={s.id} student={s} onRemove={() => toggleSelect(s.id)} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}

          {/* Filtered grid to pick from */}
          <div className="card p-4">
            <h3 className="font-semibold text-sm text-ink-900 mb-3">Filtered Students ({filtered.length})</h3>
            {filtered.length === 0 ? (
              <EmptyState icon={ImageIcon} title="No matching students" description="Adjust filters above." />
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 max-h-96 overflow-y-auto">
                {filtered.map((s) => (
                  <SelectableThumb
                    key={s.id}
                    student={s}
                    selected={selectedIds.includes(s.id)}
                    onToggle={() => toggleSelect(s.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: settings + preview */}
        <div className="space-y-4">
          <CollageConfigPanel settings={settings} setSettings={setSettings} />
          <ExportEstimate estimate={estimate} />
          <LivePreview
            students={selected.slice(0, 8)}
            settings={settings}
            activeFrame={activeFrame}
          />
        </div>
      </div>
    </div>
  );
}

function SortableSelected({ id, student, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} {...attributes} className="flex items-center gap-2 rounded-lg bg-ink-50 px-2 py-1.5">
      <button {...listeners} className="cursor-grab active:cursor-grabbing text-ink-300 touch-none"><GripVertical size={14} /></button>
      <span className="text-sm text-ink-700 flex-1 truncate">{student.name}</span>
      <span className="text-xs text-ink-400">{nilIfEmpty(student.className)}</span>
      <button className="btn-ghost btn-icon btn-sm" onClick={onRemove}><X size={12} /></button>
    </div>
  );
}

function SelectableThumb({ student, selected, onToggle }) {
  const url = useStudentPhoto(student);
  return (
    <button
      onClick={onToggle}
      className={classNames(
        'relative aspect-[3/4] rounded-lg overflow-hidden border-2 transition-all',
        selected ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-transparent hover:border-ink-300'
      )}
    >
      {url ? (
        <img src={url} alt={student.name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-ink-100 flex items-center justify-center text-ink-300 text-[10px]">No Photo</div>
      )}
      {selected && (
        <div className="absolute inset-0 bg-brand-600/20 flex items-center justify-center">
          <div className="bg-brand-600 text-white rounded-full p-1"><Images size={12} /></div>
        </div>
      )}
      <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] px-1 py-0.5 truncate">{student.name}</div>
    </button>
  );
}

function CollageConfigPanel({ settings, setSettings }) {
  return (
    <div className="card p-4">
      <h3 className="font-semibold text-sm text-ink-900 mb-3 flex items-center gap-2"><Columns3 size={16} /> Collage Settings</h3>
      <div className="space-y-3">
        <div>
          <label className="label">Columns: {settings.columns}</label>
          <input type="range" min="1" max="8" step="1" value={settings.columns} onChange={(e) => setSettings({ columns: Number(e.target.value) })} className="w-full accent-brand-600" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">H spacing (mm)</label>
            <input type="number" className="input py-1" value={settings.horizontalSpacing} onChange={(e) => setSettings({ horizontalSpacing: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">V spacing (mm)</label>
            <input type="number" className="input py-1" value={settings.verticalSpacing} onChange={(e) => setSettings({ verticalSpacing: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Margin (mm)</label>
            <input type="number" className="input py-1" value={settings.outerMargin} onChange={(e) => setSettings({ outerMargin: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Corner radius</label>
            <input type="number" className="input py-1" value={settings.cornerRadius} onChange={(e) => setSettings({ cornerRadius: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Photo border</label>
            <input type="number" min="0" step="0.5" className="input py-1" value={settings.photoBorderThickness} onChange={(e) => setSettings({ photoBorderThickness: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Details border</label>
            <input type="number" className="input py-1" value={settings.detailsBorderThickness} onChange={(e) => setSettings({ detailsBorderThickness: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Name font</label>
            <input type="number" className="input py-1" value={settings.nameFontSize} onChange={(e) => setSettings({ nameFontSize: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Details font</label>
            <input type="number" className="input py-1" value={settings.detailsFontSize} onChange={(e) => setSettings({ detailsFontSize: Number(e.target.value) })} />
          </div>
        </div>
        <div>
          <label className="label">Font family</label>
          <select className="select" value={settings.fontFamily} onChange={(e) => setSettings({ fontFamily: e.target.value })}>
            {FONT_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Text alignment</label>
          <select className="select" value={settings.textAlign} onChange={(e) => setSettings({ textAlign: e.target.value })}>
            {TEXT_ALIGN_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">DPI</label>
            <select className="select" value={settings.dpi} onChange={(e) => setSettings({ dpi: Number(e.target.value) })}>
              <option value={150}>150</option>
              <option value={200}>200</option>
              <option value={300}>300 (print)</option>
              <option value={600}>600 (fine)</option>
            </select>
          </div>
          <div>
            <label className="label">JPEG quality</label>
            <select className="select" value={settings.imageQuality} onChange={(e) => setSettings({ imageQuality: Number(e.target.value) })}>
              <option value={0.85}>0.85</option>
              <option value={0.9}>0.90</option>
              <option value={0.95}>0.95 (default)</option>
              <option value={1}>1.00 (max)</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">Page title</label>
          <input className="input" value={settings.pageTitle} onChange={(e) => setSettings({ pageTitle: e.target.value })} placeholder="Optional" />
        </div>
        {(settings.pageTitle) && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Title size</label>
              <input type="number" className="input py-1" value={settings.titleFontSize} onChange={(e) => setSettings({ titleFontSize: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">Title spacing</label>
              <input type="number" className="input py-1" value={settings.titleSpacing} onChange={(e) => setSettings({ titleSpacing: Number(e.target.value) })} />
            </div>
          </div>
        )}
        <div>
          <label className="label">Background colour</label>
          <input type="color" className="input h-10 p-1" value={settings.backgroundColor} onChange={(e) => setSettings({ backgroundColor: e.target.value })} />
        </div>
        <div>
          <label className="label">Details in Collage</label>
          <label className="flex items-center gap-2 text-sm font-medium text-ink-700 mb-1.5">
            <input
              type="checkbox"
              checked={settings.showDetailLabels !== false}
              onChange={(e) => setSettings({ showDetailLabels: e.target.checked })}
              className="accent-brand-600"
            />
            Show detail labels (e.g. "Name: Alex")
          </label>
          <p className="text-xs text-ink-400 mb-2">When off, only the value is shown (e.g. "Alex").</p>
          <div className="grid grid-cols-2 gap-1.5">
            {COLLAGE_DETAIL_FIELDS.map((f) => (
              <label key={f.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!settings.visibleDetails[f.key]}
                  onChange={(e) => setSettings({ visibleDetails: { ...settings.visibleDetails, [f.key]: e.target.checked } })}
                  className="accent-brand-600"
                />
                {f.label}
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ExportEstimate({ estimate }) {
  return (
    <div className="card p-4">
      <h3 className="font-semibold text-sm text-ink-900 mb-2">Export Estimate</h3>
      <dl className="text-sm space-y-1">
        <div className="flex justify-between"><dt className="text-ink-500">Width</dt><dd className="font-medium">{estimate.widthPx}px ({estimate.widthMm}mm)</dd></div>
        <div className="flex justify-between"><dt className="text-ink-500">Height</dt><dd className="font-medium">{estimate.heightPx}px ({estimate.heightMm.toFixed(0)}mm)</dd></div>
        <div className="flex justify-between"><dt className="text-ink-500">Rows</dt><dd className="font-medium">{estimate.rows}</dd></div>
        <div className="flex justify-between"><dt className="text-ink-500">Est. file size</dt><dd className="font-medium">~{Math.max(1, Math.round((estimate.widthPx * estimate.heightPx * 0.18) / 1024 / 1024))} MB</dd></div>
      </dl>
    </div>
  );
}

function LivePreview({ students, settings, activeFrame }) {
  const [frameUrl, setFrameUrl] = useState(null);
  useEffect(() => {
    if (activeFrame?.imageBlobId) getBlobUrl(activeFrame.imageBlobId).then(setFrameUrl);
    else setFrameUrl(null);
  }, [activeFrame?.imageBlobId]);

  const v = settings.visibleDetails;
  return (
    <div className="card p-4">
      <h3 className="font-semibold text-sm text-ink-900 mb-3">Live Preview</h3>
      <div className="rounded-lg border border-ink-200 p-3" style={{ backgroundColor: settings.backgroundColor }}>
        <div
          className="grid gap-2 mx-auto"
          style={{ gridTemplateColumns: `repeat(${settings.columns}, 1fr)`, maxWidth: 380 }}
        >
          {students.length === 0 ? (
            <p className="col-span-full text-center text-xs text-ink-400 py-8">Select students to preview</p>
          ) : (
            students.map((s) => <PreviewCard key={s.id} student={s} settings={settings} frameUrl={frameUrl} />)
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewCard({ student, settings, frameUrl }) {
  const url = useStudentPhoto(student);
  const v = settings.visibleDetails;
  const detailStyle = { fontSize: 8, textAlign: settings.textAlign };
  const entries = getDetailEntries(student, settings);
  return (
    <div className="relative" style={{ borderRadius: settings.cornerRadius }}>
      {frameUrl && v.photo && (
        <img src={frameUrl} alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
      )}
      {v.photo && (
        <div style={{ border: `${settings.photoBorderThickness}px solid #000`, borderRadius: settings.cornerRadius, overflow: 'hidden' }} className="aspect-[3/4] bg-ink-100">
          {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[8px] text-ink-400">No Photo</div>}
        </div>
      )}
      <div style={{ border: `${settings.detailsBorderThickness}px solid #000`, borderRadius: settings.cornerRadius, padding: 2, fontFamily: settings.fontFamily, background: '#fff' }}>
        {entries.map((e, i) => (
          <div
            key={i}
            style={e.isName ? { ...detailStyle, fontSize: settings.nameFontSize * 0.7, fontWeight: 700, color: '#111' } : detailStyle}
            className={e.isName ? '' : 'text-ink-600'}
          >
            {e.text || ''}
          </div>
        ))}
      </div>
    </div>
  );
}
