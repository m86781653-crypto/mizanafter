-- Restore the permission catalog before the central governance migration consumes it.
create table if not exists public.mizan_permissions (
  permission_code text primary key,
  name_ar text not null,
  description_ar text not null
);

alter table public.mizan_permissions enable row level security;
revoke all on public.mizan_permissions from anon, authenticated;

insert into public.mizan_permissions(permission_code,name_ar,description_ar) values
('audit.read','قراءة التدقيق','قراءة سجلات التدقيق'),
('audit.write_system','كتابة تدقيق النظام','كتابة سجلات النظام'),
('billing.manage','إدارة الفوترة','إدارة التعريفات والفواتير'),
('collection.record','تسجيل التحصيل','تسجيل المدفوعات'),
('collection.approve','اعتماد التحصيل','مراجعة واعتماد المدفوعات'),
('customer.manage','إدارة المشتركين','إدارة بيانات المشتركين والعدادات'),
('data.exception','استثناءات البيانات','معالجة استثناءات البيانات'),
('maintenance.execute','تنفيذ الصيانة','تنفيذ أوامر الصيانة'),
('maintenance.manage','إدارة الصيانة','إدارة الأعطال وأوامر الصيانة'),
('meter.capture','التقاط القراءة','التقاط قراءات العدادات'),
('meter.exception','استثناء القراءة','معالجة استثناءات القراءات'),
('project.manage','إدارة المشروع','إدارة بيانات المشروع'),
('project.read','قراءة المشروع','قراءة بيانات المشروع'),
('governance.tenant.manage','إدارة المستأجرين','إنشاء وإدارة المستأجرين الفرعيين'),
('governance.portfolio.read','قراءة المحفظة','قراءة محفظة المشاريع'),
('governance.financing.read','قراءة التمويل','قراءة بيانات التمويل'),
('governance.users.provision','تهيئة المستخدمين','تهيئة الحسابات التشغيلية'),
('governance.control.read','قراءة الرقابة','قراءة بيانات الرقابة المركزية')
on conflict(permission_code) do nothing;
