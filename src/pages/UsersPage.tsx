import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, Copy, KeyRound, MailCheck, RefreshCw, ShieldCheck, UserCog } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useProject } from '@/context/ProjectContext';
import { Modal } from '@/components/ui/Modal';

type ProjectUser = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: 'project_manager' | 'meter_reader' | 'collection_officer';
  tenant_id: string;
  project_id: string;
  must_change_password: boolean;
  email_confirmed: boolean;
  banned_until: string | null;
};

const roleLabels: Record<ProjectUser['role'], string> = {
  project_manager: 'مدير المشروع',
  meter_reader: 'قارئ العدادات',
  collection_officer: 'المحصل',
};

const roleOrder: ProjectUser['role'][] = ['project_manager', 'meter_reader', 'collection_officer'];

export function UsersPage() {
  const { currentProject, isCentralTenant } = useProject();
  const [users, setUsers] = useState<ProjectUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [credential, setCredential] = useState<{ email: string; password: string } | null>(null);
  const [editing, setEditing] = useState<ProjectUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [copied, setCopied] = useState(false);

  const loadUsers = useCallback(async () => {
    if (!currentProject || !isCentralTenant) {
      setUsers([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('admin-manage-project-user', {
        body: { action: 'list', project_id: currentProject.id },
      });
      if (fnError) throw new Error(fnError.message || 'تعذر تحميل مستخدمي المشروع.');
      setUsers((data?.users || []) as ProjectUser[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل مستخدمي المشروع.');
    } finally {
      setLoading(false);
    }
  }, [currentProject, isCentralTenant]);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  const runAction = async (action: string, user: ProjectUser, extra: Record<string, unknown> = {}) => {
    setWorking(user.id + action);
    setError(null);
    setNotice(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('admin-manage-project-user', {
        body: { action, target_user_id: user.id, ...extra },
      });
      if (fnError) throw new Error(fnError.message || 'فشل تنفيذ الإجراء.');
      if (action === 'reset_password' && data?.password) {
        setCredential({ email: user.email, password: data.password });
      } else {
        setNotice('تم تنفيذ الإجراء وتسجيله في سجل التدقيق.');
      }
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'فشل تنفيذ الإجراء.');
    } finally {
      setWorking(null);
    }
  };

  const openEdit = (user: ProjectUser) => {
    setEditing(user);
    setEditName(user.full_name);
    setEditPhone(user.phone || '');
    setError(null);
  };

  const saveEdit = async () => {
    if (!editing || !editName.trim()) return;
    await runAction('update_profile', editing, { full_name: editName.trim(), phone: editPhone.trim() || null });
    setEditing(null);
  };

  const copyCredential = async () => {
    if (!credential) return;
    await navigator.clipboard.writeText(`البريد: ${credential.email}\nكلمة المرور المؤقتة: ${credential.password}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  if (!isCentralTenant) return null;

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">مستخدمو المشروع</h1>
          <p className="text-sm text-neutral-500 mt-1">إدارة الهوية والحالة للحسابات التشغيلية الثلاثة دون تغيير ارتباط المشروع أو المستأجر.</p>
        </div>
        <button onClick={() => void loadUsers()} className="btn-secondary flex items-center gap-2" disabled={loading}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> تحديث
        </button>
      </div>

      {!currentProject && <div className="card p-6 text-sm text-neutral-600">اختر مشروعاً من شريط الحوكمة أولاً.</div>}
      {error && <div className="flex items-start gap-2 rounded-xl bg-error-50 text-error-700 px-4 py-3 text-sm"><AlertCircle size={18} className="mt-0.5 shrink-0" /><span>{error}</span></div>}
      {notice && <div className="flex items-start gap-2 rounded-xl bg-success-50 text-success-700 px-4 py-3 text-sm"><Check size={18} className="mt-0.5 shrink-0" /><span>{notice}</span></div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {roleOrder.map((role) => {
          const user = users.find((u) => u.role === role);
          return (
            <div key={role} className="card p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-primary-50 text-primary-700"><UserCog size={20} /></div>
                  <div>
                    <h2 className="font-bold text-neutral-900">{roleLabels[role]}</h2>
                    <p className="text-xs text-neutral-400">{user?.email || 'لا يوجد حساب مرتبط'}</p>
                  </div>
                </div>
                {user && <span className={`text-xs px-2 py-1 rounded-full ${user.banned_until ? 'bg-error-50 text-error-700' : 'bg-success-50 text-success-700'}`}>{user.banned_until ? 'موقوف' : 'نشط'}</span>}
              </div>

              {!user ? (
                <p className="text-sm text-warning-700 bg-warning-50 rounded-lg p-3">لا يوجد حساب لهذا الدور. يجب تهيئة الحساب من مسار provisioning المعتمد.</p>
              ) : (
                <>
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between gap-3"><span className="text-neutral-400">الاسم</span><span>{user.full_name}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-neutral-400">الهاتف</span><span>{user.phone || '—'}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-neutral-400">البريد مؤكد</span><span>{user.email_confirmed ? 'نعم' : 'لا'}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-neutral-400">تغيير كلمة المرور</span><span>{user.must_change_password ? 'مطلوب' : 'غير مطلوب'}</span></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => openEdit(user)} className="btn-secondary text-xs">تعديل البيانات</button>
                    <button onClick={() => void runAction('reset_password', user)} className="btn-primary text-xs" disabled={!!working}><KeyRound size={14} /> إعادة تعيين كلمة المرور</button>
                    {!user.email_confirmed && <button onClick={() => void runAction('confirm_email', user)} className="btn-secondary text-xs" disabled={!!working}><MailCheck size={14} /> تأكيد البريد</button>}
                    {user.banned_until && <button onClick={() => void runAction('reactivate', user)} className="btn-secondary text-xs" disabled={!!working}><ShieldCheck size={14} /> إعادة تفعيل الحساب</button>}
                    {!user.must_change_password && <button onClick={() => void runAction('force_password_change', user)} className="btn-secondary text-xs col-span-2" disabled={!!working}>فرض تغيير كلمة المرور عند الدخول القادم</button>}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-800">
        هذه الصفحة مخصصة لإدارة الهوية فقط. لا يمكن منها تغيير الدور أو المشروع أو المستأجر، ولا تمنح الحوكمة صلاحيات تشغيلية داخل المشروع. كل إجراء يسجل في سجل التدقيق.
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="تعديل بيانات المستخدم">
        {editing && <div className="space-y-4">
          <div><label className="label-field">الاسم الكامل *</label><input className="input-field" value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
          <div><label className="label-field">الهاتف</label><input className="input-field" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} dir="ltr" /></div>
          <div className="flex gap-3"><button onClick={() => setEditing(null)} className="btn-secondary flex-1">إلغاء</button><button onClick={() => void saveEdit()} className="btn-primary flex-1" disabled={!editName.trim() || !!working}>حفظ</button></div>
        </div>}
      </Modal>

      <Modal open={!!credential} onClose={() => setCredential(null)} title="بيانات الدخول الجديدة">
        {credential && <div className="space-y-4">
          <div className="rounded-xl bg-warning-50 text-warning-800 px-4 py-3 text-sm">تم تغيير كلمة المرور. سيُطلب من المستخدم تغييرها عند أول تسجيل دخول. لن تُحفظ كلمة المرور في سجل التدقيق.</div>
          <div className="rounded-xl border p-4 space-y-2"><div><span className="text-xs text-neutral-400">البريد</span><p dir="ltr">{credential.email}</p></div><div><span className="text-xs text-neutral-400">كلمة المرور المؤقتة</span><p dir="ltr" className="font-mono font-bold">{credential.password}</p></div></div>
          <button onClick={() => void copyCredential()} className="btn-primary w-full flex items-center justify-center gap-2">{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'تم النسخ' : 'نسخ بيانات الدخول'}</button>
        </div>}
      </Modal>
    </div>
  );
}
