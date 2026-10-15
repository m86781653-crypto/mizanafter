<!-- TEXT EXTRACTION MIRROR — NOT THE ORIGINAL DOCX BINARY -->
<!-- Source filename: MIZAN_Current_System_Baseline_v0.1.docx -->
<!-- Source location: owner-maintained ChatGPT Library; extracted on 2026-10-15 -->

# MIZAN_Current_System_Baseline_v0.1.docx — extracted text mirror

> **Provenance and limits:** This file is an extracted-text mirror of the owner-designated DOCX reference. It is provided so repository-based agents can read the reference. It is not the original DOCX binary, may not preserve all Word layout/table formatting, and must not be described as byte-identical. For decisions requiring exact formatting or table structure, consult the original DOCX.

<PARSED TEXT FOR PAGE: 1 / 3>

MIZAN AI — Current System Baseline
الحالة الفعلية المعروفة من المراجعات واالختبارات
0.1v :اإلصدار
الحالة: مرجع للحاضر — ال يحدد التصميم المستهدف
التاريخ: 3 أكتوبر 2026

<PARSED TEXT FOR PAGE: 2 / 3>

الغرض 0.
المستهدف. أي معلومة هنا تصف ما تم اكتشافه أو Model Product هذه الوثيقة تفصل الواقع الحالي للنظام عن
.إثباته حتى 3 أكتوبر ،2026 وال تعني أن الوضع الحالي هو التصميم الموصى به
النطاق المعروف 1.
 العمل مستودع: m86781653-crypto/mizanafter.
 االختبار فرع: e2e/isolated-cycle-20261002.
 آخر commit 425 :االختبار فرع علىa052af9a62f009d05959433fc9cbfe476f45a.
 main 6899 :عند كانf234fcc4206b7a87823cbf6c350d96765add.
.Production المستخدمة كانت محلية/معزولة ومؤقتة، وليست E2E بيئة 
ما تم إثباته في االختبار السابق 2.
الحالة المثبتة المجال
onboardingالسابق بنجاح عبر التهيئة و E2E وصل التهيئة
.والتجهيز
إنشاء عداد إنتاج، قراءة بداية، تشغيل، قراءة نهاية، إنتاج المياه
.م³ تم إثباتها 60 = 3m_production وحساب
مسار القراءة وصل فعلًيا إلى سجل القراءة وتمكن قراءة المشترك
.النظام من إصدار الفاتورة المرتبطة بالقراءة
ثم اعتماده، مع تحديث pending تم تسجيل دفع التحصيل
.رصيد/حالة الفاتورة وفق المسار المختبر
مسار عطل → أمر صيانة → تخصيص → تنفيذ → الصيانة
.السابق blocker إغالق وصل فعلًيا قبل
السابق بسبب صالحية E2E الوصول إليه فشل في التقرير التشغيلي
ثم تم إثبات إصالح هذا المسار في ،id_project_user_get
.اختبار موجه 29/29
مشكلة تم اكتشافها وإصالحها 3.
أثناء وصول المسار التشغيلي إلى id_project_user_get function for denied permission المشكلة السابقة كانت
كانت تستخدم readings_meter التقرير. التحليل كشف أن سياسات قراءة قديمة على
public.get_user_project_id()، على يعتمد الحالي التفويض مسار بينما private.mizan_is_platform_admin()
تم تعديل سياسة القراءة ذات الصلة في فرع االختبار، ثم اجتاز .(id_project(project_access_can_mizan.privateو
.اختبار موجه 29/29
من ضمنها تنفيذ المسار .passed assertions 29/29 — 111025775699 Job — 37063577646 Run :اختبار اإلثبات
.والوصول إلى مشروع تابع governance_central مع مستخدم authenticated role PostgreSQL المتأثر تحت
ما لم ُيثبت بعد 4.
السابق؛ لذلك السلسلة الكاملة بعد اإلصالح غير مثبتة blocker كامل جديد من البداية بعد إصالح E2E لم ُينفذ 
.حتى اآلن
.عملًيا بعد اإلصالح Realtime/لم ُيثبت توقيت انعكاس النتائج في الواجهات 
.لم ُيثبت عملًيا كل مسارات الرؤية لجميع األدوار 

<PARSED TEXT FOR PAGE: 3 / 3>

usage subscriber → distribution/tank → production بين traceable لم ُيثبت وجود سلسلة تشغيلية كاملة وم 
³m لكن مستوى الماء في الخزان بقي 50 ³،m 60 production في النموذج الحالي؛ االختبار السابق أثبت
.قبل/بعد، ولم ُيثبت انتقال تلقائي لإلنتاج إلى مخزون الخزان
ال يوجد في التعريفات الحالية دليل على أن إغالق دورة شهرية للمشروع شرط النتقال النتائج؛ الموجود 
.المثبت هو دورة تشغيل مضخة، مع فترات تقرير وفوترة منفصلة
 ملف e2e/cycle-e2e.mjs ليس discovery-neutral سلسلة على يحتوي بالكامل؛ Assertions قاًمسب محددة.
قيود البيئة واالختبار 5.
.فقط بحسب آخر تقرير متاح dispatch_workflow مضبوط على E2Eالتشغيل الكامل للـ 
.workflowمباشر لذلك الـ Dispatch األدوات المتاحة في سياق االختبار ال توفر 
.محلًيا بالطريقة المعتادة Supabase لتشغيل Docker البيئة المحلية الحالية ال تحتوي 
عندما كان ذلك runner محلًيا داخل Supabase مع Actions GitHub االختبارات المعزولة السابقة استخدمت 
.متاًحا
األدلة 6.
القيمة العنصر
Previous E2E Run 37054498738 — مسار عند توقف
mizan_operational_report بسبب permission denied for 
get_user_project_id.
Blocker Repair Run 37063577646 — success — 29 assertions.
Previous Job 110995753103.
Artifact mizan-isolated-e2e-evidence — آخر حسب محفوظ
.تقرير
Test Branch e2e/isolated-cycle-20261002.
Latest Test Commit 425a052af9a62f009d05959433fc9cbfe476f45a.
main 6899f234fcc4206b7a87823cbf6c350d96765add.
قاعدة استخدام هذه الوثيقة 7.
ال ُتستخدم لتبرير .Reference Masterهذه الوثيقة ُتستخدم كصورة للحاضر ولتحديد الفجوة بين الواقع الحالي والـ
.التصميم المستهدف لمجرد أن شيًئا موجود في الكود
