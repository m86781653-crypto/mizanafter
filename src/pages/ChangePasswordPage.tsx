import { useState } from 'react';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, KeyRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export function ChangePasswordPage() {
  const { signOut } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const validate = (): string | null => {
    if (!currentPassword) return 'كلمة المرور الحالية مطلوبة';
    if (newPassword.length < 8) return 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل';
    if (!/[A-Z]/.test(newPassword)) return 'كلمة المرور يجب أن تحتوي على حرف كبير واحد على الأقل';
    if (!/[a-z]/.test(newPassword)) return 'كلمة المرور يجب أن تحتوي على حرف صغير واحد على الأقل';
    if (!/[0-9]/.test(newPassword)) return 'كلمة المرور يجب أن تحتوي على رقم واحد على الأقل';
    if (newPassword !== confirmPassword) return 'كلمتا المرور غير متطابقتين';
    if (newPassword === currentPassword) return 'كلمة المرور الجديدة يجب أن تكون مختلفة عن الحالية';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const v = validate();
    if (v) { setError(v); return; }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    // Clear the must_change_password flag
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({ must_change_password: false }).eq('id', user.id);
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="max-w-md mx-auto animate-fade-in">
        <div className="card p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-success-100 text-success-600 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={36} />
          </div>
          <h2 className="text-xl font-bold text-neutral-900 mb-2">تم تغيير كلمة المرور بنجاح</h2>
          <p className="text-sm text-neutral-500 mb-6">يمكنك الآن الاستمرار في استخدام النظام بكلمة المرور الجديدة</p>
          <button onClick={() => signOut()} className="btn-primary w-full">
            تسجيل الخروج وإعادة الدخول
          </button>
        </div>
      </div>
    );
  }

  const PasswordField = ({
    label, value, onChange, show, toggle, fieldName,
  }: {
    label: string; value: string; onChange: (v: string) => void;
    show: boolean; toggle: () => void; fieldName: string;
  }) => (
    <div>
      <label className="block text-sm font-medium text-neutral-700 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          className="w-full px-4 py-3 pl-12 rounded-xl border border-neutral-300 text-neutral-800 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-smooth"
          dir="ltr"
          style={{ textAlign: 'right' }}
          autoComplete={fieldName}
        />
        <button
          type="button"
          onClick={toggle}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-smooth"
        >
          {show ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-md mx-auto animate-fade-in">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-warning-50 text-warning-600">
            <KeyRound size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">تغيير كلمة المرور</h1>
            <p className="text-sm text-neutral-500 mt-0.5">يجب تغيير كلمة المرور الافتراضية قبل المتابعة</p>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-warning-50 text-warning-700 text-sm mb-5">
          <AlertCircle size={18} className="shrink-0" />
          <span>لأمان حسابك، يرجى اختيار كلمة مرور قوية</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <PasswordField
            label="كلمة المرور الحالية" value={currentPassword}
            onChange={setCurrentPassword} show={showCurrent}
            toggle={() => setShowCurrent(!showCurrent)} fieldName="current-password"
          />
          <PasswordField
            label="كلمة المرور الجديدة" value={newPassword}
            onChange={setNewPassword} show={showNew}
            toggle={() => setShowNew(!showNew)} fieldName="new-password"
          />
          <PasswordField
            label="تأكيد كلمة المرور الجديدة" value={confirmPassword}
            onChange={setConfirmPassword} show={showConfirm}
            toggle={() => setShowConfirm(!showConfirm)} fieldName="confirm-password"
          />

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-error-50 text-error-700 text-sm animate-fade-in">
              <AlertCircle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="text-xs text-neutral-400 space-y-1">
            <p className="font-medium text-neutral-500">متطلبات كلمة المرور:</p>
            <ul className="space-y-0.5">
              <li className={newPassword.length >= 8 ? 'text-success-600' : ''}>- 8 أحرف على الأقل</li>
              <li className={/[A-Z]/.test(newPassword) ? 'text-success-600' : ''}>- حرف كبير واحد على الأقل</li>
              <li className={/[a-z]/.test(newPassword) ? 'text-success-600' : ''}>- حرف صغير واحد على الأقل</li>
              <li className={/[0-9]/.test(newPassword) ? 'text-success-600' : ''}>- رقم واحد على الأقل</li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 active:bg-primary-800 transition-smooth disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Lock size={20} />
            {loading ? 'جاري التغيير...' : 'تغيير كلمة المرور'}
          </button>
        </form>
      </div>
    </div>
  );
}
