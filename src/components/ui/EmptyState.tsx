import { type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 rounded-2xl bg-neutral-100 text-neutral-400 mb-4">
        <Icon size={40} />
      </div>
      <h3 className="text-lg font-bold text-neutral-700">{title}</h3>
      {description && <p className="text-sm text-neutral-500 mt-1.5 max-w-sm">{description}</p>}
      {action && (
        <button onClick={action.onClick} className="btn-primary mt-5">
          {action.label}
        </button>
      )}
    </div>
  );
}
