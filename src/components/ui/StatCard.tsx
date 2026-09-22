import { type LucideIcon } from 'lucide-react';
import { type ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: ReactNode;
  icon: LucideIcon;
  color?: string;
  subtitle?: string;
  trend?: { value: string; positive: boolean };
}

export function StatCard({ title, value, icon: Icon, color = 'primary', subtitle, trend }: StatCardProps) {
  const colorMap: Record<string, string> = {
    primary: 'bg-primary-50 text-primary-700',
    accent: 'bg-accent-50 text-accent-700',
    success: 'bg-success-50 text-success-700',
    warning: 'bg-warning-50 text-warning-700',
    error: 'bg-error-50 text-error-700',
    neutral: 'bg-neutral-100 text-neutral-600',
  };

  return (
    <div className="card-hover p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-neutral-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-neutral-900 mt-2">{value}</p>
          {subtitle && <p className="text-xs text-neutral-400 mt-1">{subtitle}</p>}
          {trend && (
            <p className={`text-xs font-medium mt-2 ${trend.positive ? 'text-success-600' : 'text-error-600'}`}>
              {trend.value}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-xl ${colorMap[color]}`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}
