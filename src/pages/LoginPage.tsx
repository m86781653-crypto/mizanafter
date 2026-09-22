import { useState } from 'react';
import { Scale, Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    if (error) {
      setError(error === 'Invalid login credentials' ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة' : error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-primary-950 p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary-400/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-8 animate-scale-in">
          <div className="flex flex-col items-center mb-8">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 text-white shadow-lg mb-4">
              <Scale size={36} />
            </div>
            <h1 className="text-2xl font-bold text-neutral-900">ميزان AI</h1>
            <p className="text-sm text-neutral-500 mt-1">منصة إدارة واستدامة خدمات المياه</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">البريد الإلكتروني</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl border border-neutral-300 text-neutral-800 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-smooth disabled:opacity-60"
                placeholder="name@example.com"
                dir="ltr"
                style={{ textAlign: 'right' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">كلمة المرور</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full px-4 py-3 pl-12 rounded-xl border border-neutral-300 text-neutral-800 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-smooth disabled:opacity-60"
                  placeholder="••••••••"
                  dir="ltr"
                  style={{ textAlign: 'right' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-smooth"
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-error-50 text-error-700 text-sm animate-fade-in">
                <AlertCircle size={18} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 active:bg-primary-800 transition-smooth disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              <LogIn size={20} />
              {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-neutral-200 text-center">
            <p className="text-xs text-neutral-400">نظام إنتاجي - جميع العمليات مسجلة ومؤمنة</p>
          </div>
        </div>

        <p className="text-center text-xs text-primary-300/70 mt-6">ميزان AI v1.0 - جميع الحقوق محفوظة</p>
      </div>
    </div>
  );
}
