import { type LucideIcon } from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  { id: 'dashboard', label: 'لوحة القيادة', icon: null as any },
  { id: 'projects', label: 'المشاريع', icon: null as any },
  { id: 'infrastructure', label: 'البنية التحتية', icon: null as any },
  { id: 'customers', label: 'المشتركين والعدادات', icon: null as any },
  { id: 'readings', label: 'قراءة العدادات', icon: null as any },
  { id: 'billing', label: 'الفوترة والتحصيل', icon: null as any },
  { id: 'maintenance', label: 'الصيانة والأعطال', icon: null as any },
  { id: 'reports', label: 'التقارير والتحليلات', icon: null as any },
  { id: 'copilot', label: 'مساعد ميزان', icon: null as any },
  { id: 'settings', label: 'الإعدادات', icon: null as any },
];
