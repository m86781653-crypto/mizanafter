import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AlertCircle, CheckCircle2, KeyRound, Scale } from 'lucide-react';

export function OnboardingPage() {
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!token.trim() || !normalizedEmail || !password) {
      setError('أدخل البريد الإلكتروني ورمز التهيئة وكلمة المرور.');
      return;
    }
    if (password.length < 8) {
      setError('يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.');
      return;
    }
    if (password !== confirm) {
      setError('تأكيد كلمة المرور غير مطابق.');
      return;
    }

    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: { onboarding_token: token.trim() },
          emailRedirectTo: window.location.origin + '/',
        },
      });
      if (signUpError) throw signUpError;

      if (data.session) {
        setNotice('تم إنشاء الحساب وربطه بالمشروع. سيتم نقلك الآن.');
        window.setTimeout(() => { window.location.href = '/'; }, 500);
      } else {
        setNotice('تم إنشاء الحساب. افتح رسالة تأكيد البريد، ثم سجّل الدخول. سيُربط الحساب تلقائياً برمز التهيئة.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إنشاء الحساب.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-primary-950 p-4" dir="rtl">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        <div className="flex flex-col items-center mb-7">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 text-white shadow-lg mb-4"><Scale size={34} /></div>
          <h1 className="text-2xl font-bold text-neutral-900">تهيئة حساب ميزان AI</h1>
          <p className="text-sm text-neutral-500 mt-1 text-center">أنشئ حسابك بنفسك دون استخدام service_role</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div><label className="label-field">البريد الإلكتروني</label><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" dir="ltr" /></div>
          <div><label className="label-field">رمز التهيئة</label><input required value={token} onChange={(e) => setToken(e.target.value)} className="input-field font-mono" dir="ltr" autoComplete="one-time-code" /></div>
          <div><label className="label-field">كلمة المرور الجديدة</label><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input-field" dir="ltr" /></div>
          <div><label className="label-field">تأكيد كلمة المرور</label><input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input-field" dir="ltr" /></div>
          {error && <div className="flex items-start gap-2 rounded-xl bg-error-50 text-error-700 px-4 py-3 text-sm"><AlertCircle size={18} className="mt-0.5 shrink-0" /><span>{error}</span></div>}
          {notice && <div className="flex items-start gap-2 rounded-xl bg-success-50 text-success-700 px-4 py-3 text-sm"><CheckCircle2 size={18} className="mt-0.5 shrink-0" /><span>{notice}</span></div>}
          <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2"><KeyRound size={18} />{loading ? 'جاري إنشاء الحساب...' : 'إنشاء الحساب'}</button>
        </form>
        <button onClick={() => { window.location.href = '/'; }} className="w-full mt-3 text-sm text-primary-700 hover:text-primary-900">العودة لتسجيل الدخول</button>
      </div>
    </div>
  );
}
