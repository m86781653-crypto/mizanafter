import { useState } from 'react';
import { LockKeyhole, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل.');
      return;
    }
    if (password !== confirmation) {
      setError('كلمتا المرور غير متطابقتين.');
      return;
    }
    setLoading(true);
    const result = await updatePassword(password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSuccess(true);
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4" dir="rtl">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 rounded-2xl bg-primary-600 text-white shadow-lg mb-4"><LockKeyhole size={32}/></div>
          <h1 className="text-2xl font-bold text-neutral-900">إعادة تعيين كلمة المرور</h1>
          <p className="text-sm text-neutral-500 mt-2 text-center">أنشئ كلمة مرور جديدة لحسابك في ميزان AI.</p>
        </div>

        {success ? (
          <div className="space-y-5">
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-success-50 text-success-700 text-sm">
              <CheckCircle2 size={18} className="shrink-0"/>
              <span>تم تحديث كلمة المرور بنجاح.</span>
            </div>
            <button type="button" onClick={() => { window.location.hash=''; window.location.reload(); }} className="w-full px-4 py-3 rounded-xl bg-primary-600 text-white font-semibold">
              العودة إلى تسجيل الدخول
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">كلمة المرور الجديدة</label>
              <div className="relative">
                <input type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} required disabled={loading} minLength={8} className="w-full px-4 py-3 pl-12 rounded-xl border border-neutral-300 text-neutral-800 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200 disabled:opacity-60" dir="ltr"/>
                <button type="button" onClick={()=>setShowPassword(v=>!v)} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" aria-label={showPassword?'إخفاء كلمة المرور':'إظهار كلمة المرور'}>{showPassword?<EyeOff size={20}/>:<Eye size={20}/>}</button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">تأكيد كلمة المرور</label>
              <div className="relative">
                <input type={showConfirmation?'text':'password'} value={confirmation} onChange={e=>setConfirmation(e.target.value)} required disabled={loading} minLength={8} className="w-full px-4 py-3 pl-12 rounded-xl border border-neutral-300 text-neutral-800 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200 disabled:opacity-60" dir="ltr"/>
                <button type="button" onClick={()=>setShowConfirmation(v=>!v)} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" aria-label={showConfirmation?'إخفاء كلمة المرور':'إظهار كلمة المرور'}>{showConfirmation?<EyeOff size={20}/>:<Eye size={20}/>}</button>
              </div>
            </div>
            {error && <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-error-50 text-error-700 text-sm"><AlertCircle size={18} className="shrink-0"/><span>{error}</span></div>}
            <button type="submit" disabled={loading || !password || !confirmation} className="w-full px-4 py-3 rounded-xl bg-primary-600 text-white font-semibold disabled:opacity-50">
              {loading ? 'جاري تحديث كلمة المرور...' : 'تحديث كلمة المرور'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
