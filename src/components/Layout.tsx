import { useState, type ReactNode } from 'react';
import {
  LayoutDashboard, Building2, Droplets, Users, Gauge,
  Receipt, Wrench, BarChart3, Bot, Settings,
  Menu, X, Bell, Search, ChevronDown, Scale,
} from 'lucide-react';
import { useProject } from '@/context/ProjectContext';
import { formatRelativeTime } from '@/lib/utils';
import type { Notification } from '@/types';
import { supabase } from '@/lib/supabase';
import { useEffect } from 'react';

interface LayoutProps {
  activePage: string;
  onNavigate: (page: string) => void;
  children: ReactNode;
}

const navConfig = [
  { id: 'dashboard', label: 'لوحة القيادة', icon: LayoutDashboard },
  { id: 'projects', label: 'المشاريع', icon: Building2 },
  { id: 'infrastructure', label: 'البنية التحتية', icon: Droplets },
  { id: 'customers', label: 'المشتركين والعدادات', icon: Users },
  { id: 'readings', label: 'قراءة العدادات', icon: Gauge },
  { id: 'billing', label: 'الفوترة والتحصيل', icon: Receipt },
  { id: 'maintenance', label: 'الصيانة والأعطال', icon: Wrench },
  { id: 'reports', label: 'التقارير والتحليلات', icon: BarChart3 },
  { id: 'copilot', label: 'مساعد ميزان', icon: Bot },
  { id: 'settings', label: 'الإعدادات', icon: Settings },
];

export function Layout({ activePage, onNavigate, children }: LayoutProps) {
  const { currentProject, projects, setCurrentProjectId, loading } = useProject();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (currentProject) {
      (async () => {
        const { data } = await supabase
          .from('notifications')
          .select('*')
          .eq('project_id', currentProject.id)
          .order('created_at', { ascending: false })
          .limit(10);
        setNotifications((data || []) as Notification[]);
      })();
    }
  }, [currentProject]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleNavigate = (page: string) => {
    onNavigate(page);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      {/* Sidebar - Desktop */}
      <aside className={`fixed lg:sticky top-0 right-0 z-40 h-screen w-72 bg-primary-900 text-white flex-col transition-transform duration-300 lg:flex ${
        sidebarOpen ? 'flex translate-x-0' : 'hidden lg:flex translate-x-full lg:translate-x-0'
      }`}>
        <div className="flex items-center gap-3 px-6 py-5 border-b border-primary-800/50">
          <div className="p-2 rounded-xl bg-accent-500/20 text-accent-300">
            <Scale size={24} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">ميزان AI</h1>
            <p className="text-xs text-primary-300">إدارة خدمات المياه</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="mr-auto lg:hidden p-1.5 rounded-lg hover:bg-primary-800 transition-smooth"
            aria-label="إغلاق القائمة"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navConfig.map((item) => {
            const Icon = item.icon;
            const active = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'bg-primary-700 text-white shadow-lg'
                    : 'text-primary-200 hover:bg-primary-800/60 hover:text-white'
                }`}
              >
                <Icon size={20} className={active ? 'text-accent-300' : ''} />
                <span>{item.label}</span>
                {active && <span className="mr-auto w-1.5 h-1.5 rounded-full bg-accent-400 animate-pulse-soft" />}
              </button>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-primary-800/50">
          <div className="bg-primary-800/40 rounded-xl p-3">
            <p className="text-xs text-primary-300 font-medium">الإصدار 1.0.0</p>
            <p className="text-[10px] text-primary-400 mt-0.5">منصة إنتاجية - بيئة تجريبية</p>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-neutral-900/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-neutral-200 px-4 lg:px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-neutral-100 transition-smooth"
            aria-label="فتح القائمة"
          >
            <Menu size={22} className="text-neutral-700" />
          </button>

          {/* Project Selector */}
          <div className="relative">
            <button
              onClick={() => setProjectMenuOpen(!projectMenuOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-100 transition-smooth min-w-0"
            >
              <div className="p-1.5 rounded-lg bg-primary-50 text-primary-700 shrink-0">
                <Building2 size={16} />
              </div>
              <div className="text-right min-w-0">
                <p className="text-xs text-neutral-500">المشروع الحالي</p>
                <p className="text-sm font-semibold text-neutral-800 truncate max-w-[140px] lg:max-w-none">
                  {loading ? '...' : currentProject?.name_ar || 'اختر مشروعاً'}
                </p>
              </div>
              <ChevronDown size={16} className={`text-neutral-400 transition-transform shrink-0 ${projectMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {projectMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setProjectMenuOpen(false)} />
                <div className="absolute top-full mt-2 right-0 z-40 bg-white rounded-xl shadow-elevated border border-neutral-200 w-72 py-2 animate-scale-in max-h-80 overflow-y-auto">
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setCurrentProjectId(p.id); setProjectMenuOpen(false); }}
                      className={`w-full text-right px-4 py-2.5 hover:bg-neutral-50 transition-smooth flex items-center justify-between gap-2 ${
                        currentProject?.id === p.id ? 'bg-primary-50 text-primary-700' : 'text-neutral-700'
                      }`}
                    >
                      <span className="text-sm font-medium truncate">{p.name_ar}</span>
                      <span className={`badge ${p.status === 'active' ? 'bg-success-100 text-success-700' : 'bg-neutral-100 text-neutral-600'}`}>
                        {p.status === 'active' ? 'نشط' : 'غير نشط'}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Search */}
          <div className="hidden md:flex relative flex-1 max-w-xs">
            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث..."
              className="w-full pr-10 pl-3 py-2 rounded-lg bg-neutral-100 border border-transparent text-sm text-neutral-700 placeholder-neutral-400 focus:bg-white focus:border-primary-300 outline-none transition-smooth"
            />
          </div>

          <div className="mr-auto flex items-center gap-2">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative p-2 rounded-lg hover:bg-neutral-100 transition-smooth text-neutral-600"
                aria-label="الإشعارات"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-error-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
                  <div className="absolute top-full mt-2 left-0 z-40 bg-white rounded-xl shadow-elevated border border-neutral-200 w-80 animate-scale-in max-h-96 overflow-y-auto">
                    <div className="px-4 py-3 border-b border-neutral-200">
                      <h3 className="font-bold text-neutral-900">الإشعارات</h3>
                    </div>
                    {notifications.length === 0 ? (
                      <p className="text-center text-sm text-neutral-400 py-8">لا توجد إشعارات</p>
                    ) : (
                      notifications.map((n) => (
                        <div key={n.id} className={`px-4 py-3 border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition-smooth ${!n.is_read ? 'bg-primary-50/40' : ''}`}>
                          <div className="flex items-start gap-2">
                            <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                              n.severity === 'high' ? 'bg-error-500' : n.severity === 'warning' ? 'bg-warning-500' : 'bg-primary-500'
                            }`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-neutral-800">{n.title_ar}</p>
                              <p className="text-xs text-neutral-500 mt-0.5">{n.body_ar}</p>
                              <p className="text-[10px] text-neutral-400 mt-1">{formatRelativeTime(n.created_at)}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {/* User Avatar */}
            <div className="flex items-center gap-2 pr-2">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-white flex items-center justify-center text-sm font-bold shrink-0">
                م
              </div>
              <div className="hidden lg:block">
                <p className="text-sm font-semibold text-neutral-800">المدير</p>
                <p className="text-xs text-neutral-400">مسؤول النظام</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
