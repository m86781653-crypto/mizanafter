import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useProject } from '@/context/ProjectContext';
import { Badge } from '@/components/ui/Badge';
import { formatDateTime, formatRelativeTime } from '@/lib/utils';
import { Settings, Shield, Database, Bot, Bell, FileText, Activity, History, Cpu, CheckCircle, AlertCircle } from 'lucide-react';
import type { AuditLog, AiLog, Notification } from '@/types';

type Tab = 'general' | 'audit' | 'ai_logs' | 'notifications' | 'system';

export function SettingsPage() {
  const { currentProject } = useProject();
  const [tab, setTab] = useState<Tab>('general');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [aiLogs, setAiLogs] = useState<AiLog[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    (async () => {
      const [a, ai, n] = await Promise.all([
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('ai_logs').select('*').order('created_at', { ascending: false }).limit(50),
        currentProject
          ? supabase.from('notifications').select('*').eq('project_id', currentProject.id).order('created_at', { ascending: false }).limit(30)
          : supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(30),
      ]);
      setAuditLogs(a.data as AuditLog[] || []);
      setAiLogs(ai.data as AiLog[] || []);
      setNotifications(n.data as Notification[] || []);
    })();
  }, [currentProject]);

  const markNotificationRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const tabs = [
    { id: 'general' as Tab, label: 'عام', icon: Settings },
    { id: 'audit' as Tab, label: 'سجل التدقيق', icon: History },
    { id: 'ai_logs' as Tab, label: 'سجل الذكاء الاصطناعي', icon: Cpu },
    { id: 'notifications' as Tab, label: 'الإشعارات', icon: Bell },
    { id: 'system' as Tab, label: 'حالة النظام', icon: Activity },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">الإعدادات والإدارة</h1>
        <p className="text-sm text-neutral-500 mt-1">إدارة النظام والمراقبة والتدقيق</p>
      </div>

      <div className="flex gap-1 bg-neutral-100 p-1 rounded-xl w-fit overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${tab === t.id ? 'bg-white text-primary-700 shadow-sm' : 'text-neutral-500'}`}>
              <Icon size={16} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4"><Shield size={20} className="text-primary-600" /><h3 className="font-bold text-neutral-800">إعدادات الأمان</h3></div>
            <div className="space-y-3">
              <ToggleRow label="المصادقة الثنائية (MFA)" desc="طبقة حماية إضافية لتسجيل الدخول" enabled={false} />
              <ToggleRow label="انتهاء الجلسة التلقائي" desc="تسجيل خروج بعد 30 دقيقة من عدم النشاط" enabled={true} />
              <ToggleRow label="تقييد الوصول بعنوان IP" desc="السماح بالوصول من عناوين محددة فقط" enabled={false} />
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4"><Bot size={20} className="text-accent-600" /><h3 className="font-bold text-neutral-800">إعدادات الذكاء الاصطناعي</h3></div>
            <div className="space-y-3">
              <ToggleRow label="استخراج القراءة بالذكاء الاصطناعي" desc="استخدام OCR/Vision لقراءة العدادات" enabled={true} />
              <ToggleRow label="كشف الشذوذ التلقائي" desc="تنبيه عند الاستهلاك غير الاعتيادي" enabled={true} />
              <div className="pt-2">
                <label className="label-field">حد الثقة الأدنى (%)</label>
                <input type="number" className="input-field" defaultValue="85" />
              </div>
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4"><Bell size={20} className="text-warning-600" /><h3 className="font-bold text-neutral-800">إعدادات الإشعارات</h3></div>
            <div className="space-y-3">
              <ToggleRow label="إشعارات الأعطال الحرجة" desc="تنبيه فوري عند الأعطال الحرجة" enabled={true} />
              <ToggleRow label="تنبيه الفواتير المتأخرة" desc="تذكير بالفواتير غير المدفوعة" enabled={true} />
              <ToggleRow label="رسائل SMS" desc="إرسال إشعارات عبر الرسائل القصيرة" enabled={false} />
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4"><FileText size={20} className="text-neutral-600" /><h3 className="font-bold text-neutral-800">معلومات النظام</h3></div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-neutral-400">الإصدار</span><span className="font-medium text-neutral-700">1.0.0</span></div>
              <div className="flex justify-between"><span className="text-neutral-400">قاعدة البيانات</span><span className="font-medium text-neutral-700">PostgreSQL + PostGIS</span></div>
              <div className="flex justify-between"><span className="text-neutral-400">المشروع الحالي</span><span className="font-medium text-neutral-700">{currentProject?.name_ar || '—'}</span></div>
            </div>
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="card overflow-x-auto">
          {auditLogs.length === 0 ? (
            <p className="text-center text-sm text-neutral-400 py-12">لا توجد سجلات تدقيق</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-xs text-neutral-400 border-b border-neutral-200 bg-neutral-50">
                  <th className="px-4 py-3 font-medium">العملية</th>
                  <th className="px-4 py-3 font-medium">الجدول</th>
                  <th className="px-4 py-3 font-medium">المستخدم</th>
                  <th className="px-4 py-3 font-medium">السبب</th>
                  <th className="px-4 py-3 font-medium">الوقت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-neutral-50 transition-smooth">
                    <td className="px-4 py-3"><span className={`badge ${log.action === 'insert' ? 'bg-success-100 text-success-700' : log.action === 'update' ? 'bg-warning-100 text-warning-700' : 'bg-error-100 text-error-700'}`}>{log.action === 'insert' ? 'إضافة' : log.action === 'update' ? 'تعديل' : 'حذف'}</span></td>
                    <td className="px-4 py-3 font-medium text-neutral-700">{log.table_name}</td>
                    <td className="px-4 py-3 text-neutral-600">{log.user_name || '—'}</td>
                    <td className="px-4 py-3 text-neutral-500 text-xs">{log.reason || '—'}</td>
                    <td className="px-4 py-3 text-xs text-neutral-400">{formatRelativeTime(log.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'ai_logs' && (
        <div className="card overflow-x-auto">
          {aiLogs.length === 0 ? (
            <p className="text-center text-sm text-neutral-400 py-12">لا توجد سجلات ذكاء اصطناعي</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-xs text-neutral-400 border-b border-neutral-200 bg-neutral-50">
                  <th className="px-4 py-3 font-medium">العملية</th>
                  <th className="px-4 py-3 font-medium">النموذج</th>
                  <th className="px-4 py-3 font-medium">الثقة</th>
                  <th className="px-4 py-3 font-medium">المدة (ms)</th>
                  <th className="px-4 py-3 font-medium">الحالة</th>
                  <th className="px-4 py-3 font-medium">الوقت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {aiLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-neutral-50 transition-smooth">
                    <td className="px-4 py-3 font-medium text-neutral-700">{log.operation}</td>
                    <td className="px-4 py-3 text-neutral-600">{log.model || '—'}</td>
                    <td className="px-4 py-3 text-neutral-600">{log.confidence != null ? `${log.confidence}%` : '—'}</td>
                    <td className="px-4 py-3 text-neutral-600">{log.duration_ms || '—'}</td>
                    <td className="px-4 py-3">{log.success ? <CheckCircle size={16} className="text-success-600" /> : <AlertCircle size={16} className="text-error-600" />}</td>
                    <td className="px-4 py-3 text-xs text-neutral-400">{formatRelativeTime(log.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'notifications' && (
        <div className="space-y-3">
          {notifications.length === 0 ? (
            <div className="card"><p className="text-center text-sm text-neutral-400 py-12">لا توجد إشعارات</p></div>
          ) : (
            notifications.map((n) => (
              <div key={n.id} className={`card-hover p-4 ${!n.is_read ? 'border-r-4 border-r-primary-500' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`p-2 rounded-lg shrink-0 ${n.severity === 'high' ? 'bg-error-50 text-error-600' : n.severity === 'warning' ? 'bg-warning-50 text-warning-600' : 'bg-primary-50 text-primary-600'}`}>
                      <Bell size={18} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-neutral-800 text-sm">{n.title_ar}</p>
                      {n.body_ar && <p className="text-sm text-neutral-500 mt-0.5">{n.body_ar}</p>}
                      <p className="text-xs text-neutral-400 mt-1">{formatRelativeTime(n.created_at)}</p>
                    </div>
                  </div>
                  {!n.is_read && <button onClick={() => markNotificationRead(n.id)} className="text-primary-600 text-xs font-medium shrink-0">تعليم كمقروء</button>}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'system' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3"><Database size={20} className="text-success-600" /><h3 className="font-bold text-neutral-800">قاعدة البيانات</h3></div>
            <div className="flex items-center gap-2"><CheckCircle size={18} className="text-success-600" /><span className="text-sm text-neutral-600">تعمل بشكل طبيعي</span></div>
            <p className="text-xs text-neutral-400 mt-2">PostgreSQL + PostGIS</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3"><Activity size={20} className="text-success-600" /><h3 className="font-bold text-neutral-800">واجهة API</h3></div>
            <div className="flex items-center gap-2"><CheckCircle size={18} className="text-success-600" /><span className="text-sm text-neutral-600">تعمل بشكل طبيعي</span></div>
            <p className="text-xs text-neutral-400 mt-2">Supabase REST API</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3"><Bot size={20} className="text-accent-600" /><h3 className="font-bold text-neutral-800">مزود الذكاء الاصطناعي</h3></div>
            <div className="flex items-center gap-2"><AlertCircle size={18} className="text-warning-600" /><span className="text-sm text-neutral-600">وضع المحاكاة</span></div>
            <p className="text-xs text-neutral-400 mt-2">لم يتم ربط مزود إنتاجي بعد</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3"><Bell size={20} className="text-warning-600" /><h3 className="font-bold text-neutral-800">خدمة الإشعارات</h3></div>
            <div className="flex items-center gap-2"><AlertCircle size={18} className="text-warning-600" /><span className="text-sm text-neutral-600">إشعارات داخل النظام فقط</span></div>
            <p className="text-xs text-neutral-400 mt-2">SMS و Push غير مفعّلان</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3"><Shield size={20} className="text-success-600" /><h3 className="font-bold text-neutral-800">الأمان (RLS)</h3></div>
            <div className="flex items-center gap-2"><CheckCircle size={18} className="text-success-600" /><span className="text-sm text-neutral-600">مفعّل على جميع الجداول</span></div>
            <p className="text-xs text-neutral-400 mt-2">Row Level Security</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3"><History size={20} className="text-primary-600" /><h3 className="font-bold text-neutral-800">سجل التدقيق</h3></div>
            <div className="flex items-center gap-2"><CheckCircle size={18} className="text-success-600" /><span className="text-sm text-neutral-600">{auditLogs.length} سجل مسجل</span></div>
            <p className="text-xs text-neutral-400 mt-2">تدقيق العمليات الحساسة</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleRow({ label, desc, enabled }: { label: string; desc: string; enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <p className="text-sm font-medium text-neutral-700">{label}</p>
        <p className="text-xs text-neutral-400">{desc}</p>
      </div>
      <button
        onClick={() => setOn(!on)}
        className={`relative w-11 h-6 rounded-full transition-smooth ${on ? 'bg-primary-600' : 'bg-neutral-300'}`}
        aria-label={label}
      >
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-smooth ${on ? 'left-0.5' : 'right-0.5'}`} />
      </button>
    </div>
  );
}
