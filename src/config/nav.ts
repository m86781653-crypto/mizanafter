import { BarChart3, Building2, Bot, Droplets, Gauge, Receipt, Settings, Users, Wrench, type LucideIcon } from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  { id: 'dashboard', label: 'لوحة القيادة', icon: BarChart3 },
  { id: 'projects', label: 'المشاريع', icon: Building2 },
  { id: 'infrastructure', label: 'البنية التحتية', icon: Droplets },
  { id: 'customers', label: 'المشتركين والعدادات', icon: Users },
  { id: 'readings', label: 'قراءة العدادات', icon: Gauge },
  { id: 'billing', label: 'الفوترة والتحصيل', icon: Receipt },
  { id: 'maintenance', label: 'الصيانة والأعطال', icon: Wrench },
  { id: 'reports', label: 'التقارير والتحليلات', icon: BarChart3 },
  { id: 'copilot', label: 'مساعد ميزان', icon: Bot },
  { id: 'settings', label: 'الإعدادات', icon: Settings },
];
