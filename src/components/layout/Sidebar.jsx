import { NavLink } from 'react-router-dom';
import {
  Users,
  LayoutGrid,
  ClipboardList,
  Trophy,
  Images,
  Frame,
  Settings as SettingsIcon,
  PanelLeftClose,
  PanelLeftOpen,
  GraduationCap,
} from 'lucide-react';
import { APP_NAME } from '@/constants';
import { classNames } from '@/utils';

const NAV = [
  { to: '/app/students', label: 'Student Details', icon: Users },
  { to: '/app/categories', label: 'Categories and Items', icon: LayoutGrid },
  { to: '/app/participation', label: 'Participation Entry', icon: ClipboardList },
  { to: '/app/results', label: 'Results Entry', icon: Trophy },
  { to: '/app/collage', label: 'Create Collage', icon: Images },
  { to: '/app/frames', label: 'Frame Template', icon: Frame },
  { to: '/app/settings', label: 'Settings', icon: SettingsIcon },
];

export default function Sidebar({ collapsed, onToggle }) {
  return (
    <aside
      className={classNames(
        'hidden md:flex flex-col bg-white border-r border-ink-100 transition-all duration-200 shrink-0',
        collapsed ? 'w-[68px]' : 'w-64'
      )}
    >
      <div className="flex items-center gap-2 px-4 h-16 border-b border-ink-100">
        <div className="w-9 h-9 rounded-lg bg-brand-600 text-white flex items-center justify-center shrink-0">
          <GraduationCap size={20} />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="font-display font-bold text-sm text-ink-900 leading-tight">
              {APP_NAME}
            </p>
          </div>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={item.label}
            className={({ isActive }) =>
              classNames(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
                collapsed && 'justify-center'
              )
            }
          >
            <item.icon size={20} className="shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-ink-100 p-2">
        <button
          onClick={onToggle}
          className="btn-ghost w-full"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          {!collapsed && <span className="text-sm">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
