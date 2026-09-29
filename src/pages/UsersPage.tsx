import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, RefreshCw, ShieldCheck, UserCog } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useProject } from '@/context/ProjectContext';
import { Modal } from '@/components/ui/Modal';

type ProjectUser = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: 'project_manager' | 'meter_reader' | 'collection_officer' | 'operations_maintenance';
  tenant_id: string;
  project_id: string;
  must_change_password: boolean;
};

const roleLabels: Record<ProjectUser['role'], string> = {
  project_manager: 'مدير المشروع',
  meter_reader: 'قارئ العدادات',
  collection_officer: 'المحصل',
  operations_maintenance: 'مسؤول التشغيل والصيانة',
};

const roleOrder: ProjectUser['role'][] = [
  'project_manager',
  'meter_reader',
  'collection_officer',
  'operations_maintenance',
];

export function UsersPage() {
  const { currentProject, isCentralTenant } = useProject();
  const [users, setUsers] = useState<ProjectUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProjectUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const loadUsers = useCallback(async () => {
    if (!currentProject || !isCentralTenant) {
      setUsers([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('mizan_list_project_users', {
        p_project_id: currentProject.id,
      });
      if (rpcError) throw rpcError;
      setUsers((data?.users || []) as ProjectUser[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل مستخدمي المشروع.');
    } finally {
      setLoading(false);
    }
  }, [currentProject, isCentralTenant]);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  const updateUser = async (user: ProjectUser, values: {
    full_name?: string;
    phone?: string | null;
    force_password_change?: boolean;
  }) => {
    setWorking(user.id);
    setError(null);
    setNotice(null);
    try {
      const { error: rpcError } = await supabase.rpc('mizan_manage_project_user_profile', {
        p_target_user_id: user.id,
        p_full_name: values.full_name ?? null,
        p_phone: values.phone ?? null,
        p_force_password_change: values.force_password_change ?? null,
      });
      if (rpcError) throw rpcError;
      setNotice('تم تحديث بيانات المستخدم وتسجيل العملية في سجل التدقيق.');
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'فشل تحديث المستخدم.');
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
    await updateUser(editing, {
      full_name: editName.trim(),
      phone: editPhone.trim() || null,
    });
    setEditing(null);
  };

  if (!isCentralTenant) return null;

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">مستخدمو المشروع</h1>
          <p className="text-sm text-neutral-500 mt-1">إدارة الهوية التشغيلية عبر RLS وRPCs المقيّدة، دون service_role.</p>
        </div>
        <button onClick={() => void loadUsers()} className="btn-secondary flex items-center gap-2" disabled={loading}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> تحديث
        </button>
      </div>

      {error && <div className="flex items-start gap-2 rounded-xl bg-error-50 text-error-700 px-4 py-3 text-sm"><AlertCircle size={18} className="mt-0.5 shrink-0" /><span>{error}</span></div>}
      {notice && <div className="flex items-start gap-2 rounded-xl bg-success-50 text-success-700 px-4 py-3 text-sm"><Check size={18} className="mt-0.5 shrink-0" /><span>{notice}</span></div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {roleOrder.map((role) => {
          const user = users.find((u) => u.role === role);
          return (
            <div key={role} className="card p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-primary-50 text-primary-700"><UserCog size={20} /></div>
                  <div>
                    <h2 className="font-bold text-neutral-900">{roleLabels[role]}</h2>
                    <p className="text-xs text-neutral-400">{user?.email || 'لا يوجد حساب مرتبط بعد'}</p>
                  </div>
                </div>
                {user && <span className="text-xs px-2 py-1 rounded-full bg-success-50 text-success-700">مهيأ</span>}
              </div>

              {!user ? (
                <p className="text-sm text-warning-700 bg-warning-50 rounded-lg p-3">
                  لا يوجد حساب مرتبط. استخدم رمز التهيئة الذي أنشأته الحوكمة، ثم افتح صفحة /onboarding.
                </p>
              ) : (
                <>
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between gap-3"><span className="text-neutral-400">الاسم</span><span>{user.full_name}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-neutral-400">الهاتف</span><span>{user.phone || '—'}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-neutral-400">تغيير كلمة المرور</span><span>{user.must_change_password ? 'مطلوب' : 'غير مطلوب'}</span></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => openEdit(user)} className="btn-secondary text-xs">تعديل البيانات</button>
                    {!user.must_change_password && (
                      <button
                        onClick={() => void updateUser(user, { force_password_change: true })}
                        className="btn-secondary text-xs flex items-center justify-center gap-1"
                        disabled={!!working}
                      >
                        <ShieldCheck size={14} /> فرض تغيير كلمة المرور
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-800">
        لا يحتفظ النظام بكلمات المرور ولا ينشئها نيابةً عن المستخدمين. إنشاء الحساب يتم عبر Supabase Auth من جهاز المستخدم، ثم يثبت ارتباطه بالمشروع بواسطة رمز التهيئة.
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="تعديل بيانات المستخدم">
        {editing && (
          <div className="space-y-4">
            <div><label className="label-field">الاسم الكامل *</label><input className="input-field" value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
            <div><label className="label-field">الهاتف</label><input className="input-field" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} dir="ltr" /></div>
            <div className="flex gap-3"><button onClick={() => setEditing(null)} className="btn-secondary flex-1">إلغاء</button><button onClick={() => void saveEdit()} className="btn-primary flex-1" disabled={!editName.trim() || !!working}>حفظ</button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
