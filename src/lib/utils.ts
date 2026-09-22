export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(n);
}

export function formatCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(n) + ' ر.ي';
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Intl.DateTimeFormat('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(d));
  } catch {
    return '—';
  }
}

export function formatDateShort(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Intl.DateTimeFormat('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d));
  } catch {
    return '—';
  }
}

export function formatDateTime(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Intl.DateTimeFormat('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d));
  } catch {
    return '—';
  }
}

export function formatRelativeTime(d: string | null | undefined): string {
  if (!d) return '—';
  const date = new Date(d);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'الآن';
  if (diffMins < 60) return `قبل ${diffMins} دقيقة`;
  if (diffHours < 24) return `قبل ${diffHours} ساعة`;
  if (diffDays < 30) return `قبل ${diffDays} يوم`;
  return formatDateShort(d);
}

export const customerTypeLabels: Record<string, string> = {
  residential: 'منزلي',
  commercial: 'تجاري',
  government: 'حكومي',
  school: 'مدرسة',
  health_center: 'مركز صحي',
  mosque: 'مسجد',
  institution: 'مؤسسة',
  other: 'أخرى',
};

export const projectStatusLabels: Record<string, string> = {
  active: 'نشط',
  inactive: 'غير نشط',
  suspended: 'موقف',
  under_construction: 'قيد الإنشاء',
};

export const meterStatusLabels: Record<string, string> = {
  active: 'نشط',
  inactive: 'غير نشط',
  faulty: 'تالف',
  replaced: 'مستبدل',
};

export const readingStatusLabels: Record<string, string> = {
  pending: 'قيد المراجعة',
  approved: 'معتمدة',
  rejected: 'مرفوضة',
  anomaly: 'شاذة',
};

export const syncStatusLabels: Record<string, string> = {
  synced: 'متزامن',
  pending: 'بانتظار المزامنة',
  failed: 'فشل',
  conflict: 'تعارض',
};

export const invoiceStatusLabels: Record<string, string> = {
  unpaid: 'غير مدفوعة',
  paid: 'مدفوعة',
  overdue: 'متأخرة',
  partial: 'مدفوعة جزئياً',
  void: 'ملغاة',
};

export const faultStatusLabels: Record<string, string> = {
  reported: 'تم الإبلاغ',
  verified: 'تم التحقق',
  assigned: 'تم التعيين',
  in_progress: 'قيد المعالجة',
  resolved: 'تم الحل',
  closed: 'مغلقة',
};

export const workOrderStatusLabels: Record<string, string> = {
  open: 'مفتوح',
  in_progress: 'قيد التنفيذ',
  completed: 'مكتمل',
  cancelled: 'ملغي',
  on_hold: 'موقف',
};

export const severityLabels: Record<string, string> = {
  low: 'منخفض',
  medium: 'متوسط',
  high: 'عالٍ',
  critical: 'حرج',
};

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    active: 'bg-success-100 text-success-700',
    operational: 'bg-success-100 text-success-700',
    approved: 'bg-success-100 text-success-700',
    paid: 'bg-success-100 text-success-700',
    resolved: 'bg-success-100 text-success-700',
    closed: 'bg-success-100 text-success-700',
    completed: 'bg-success-100 text-success-700',
    synced: 'bg-success-100 text-success-700',
    pending: 'bg-warning-100 text-warning-700',
    unpaid: 'bg-warning-100 text-warning-700',
    overdue: 'bg-error-100 text-error-700',
    in_progress: 'bg-primary-100 text-primary-700',
    assigned: 'bg-primary-100 text-primary-700',
    open: 'bg-primary-100 text-primary-700',
    reported: 'bg-warning-100 text-warning-700',
    verified: 'bg-primary-100 text-primary-700',
    anomaly: 'bg-error-100 text-error-700',
    faulty: 'bg-error-100 text-error-700',
    rejected: 'bg-error-100 text-error-700',
    failed: 'bg-error-100 text-error-700',
    conflict: 'bg-error-100 text-error-700',
    critical: 'bg-error-100 text-error-700',
    high: 'bg-error-100 text-error-700',
    medium: 'bg-warning-100 text-warning-700',
    low: 'bg-neutral-100 text-neutral-600',
    suspended: 'bg-error-100 text-error-700',
    inactive: 'bg-neutral-100 text-neutral-600',
  };
  return map[status] || 'bg-neutral-100 text-neutral-600';
}

export function generateNumber(prefix: string, count: number): string {
  return `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;
}
