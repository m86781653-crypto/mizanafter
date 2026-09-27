-- Reconstruct the role catalog before later governance migrations consume it.
-- This closes the clean-room migration ordering gap discovered by the database contract.
create table if not exists public.mizan_role_catalog (
  role_code text primary key,
  name_ar text not null,
  description_ar text not null,
  is_legacy boolean not null default false
);

alter table public.mizan_role_catalog enable row level security;
revoke all on public.mizan_role_catalog from anon, authenticated;

insert into public.mizan_role_catalog(role_code,name_ar,description_ar,is_legacy)
values
('platform_admin','مدير المنصة','إدارة تقنية عليا للمنصة',false),
('central_governance','الحوكمة المركزية','الحوكمة والإشراف المركزي وإدارة المستأجرين الفرعيين',false),
('project_manager','مدير المشروع','الإدارة التشغيلية للمستأجر الفرعي',false),
('meter_reader','قارئ العدادات','التقاط قراءات العدادات',false),
('collection_officer','المحصل','تسجيل التحصيلات',false),
('tenant_manager','مدير المستأجر','دور انتقالي قديم',true),
('operations_officer','مسؤول العمليات','دور تشغيلي',true),
('maintenance_officer','مسؤول الصيانة','دور تشغيلي',true),
('technician','فني','دور تشغيلي',true),
('data_exception_officer','مسؤول استثناءات البيانات','دور تشغيلي',true),
('viewer','عرض فقط','قراءة فقط',true),
('collector','محصل قديم','دور قديم',true),
('maintenance_tech','فني صيانة قديم','دور قديم',true),
('read_only','قراءة فقط قديم','دور قديم',true),
('super_admin','مدير شامل قديم','دور قديم',true)
on conflict (role_code) do nothing;
