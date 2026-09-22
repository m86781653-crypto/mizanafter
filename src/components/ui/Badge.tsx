import { statusColor } from '@/lib/utils';

interface BadgeProps {
  status: string;
  label: string;
}

export function Badge({ status, label }: BadgeProps) {
  return (
    <span className={`badge ${statusColor(status)}`}>
      {label}
    </span>
  );
}
