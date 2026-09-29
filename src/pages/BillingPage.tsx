import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle, FileText, Loader2, Plus, Receipt, Search, TrendingUp, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useProject } from '@/context/ProjectContext';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { StatCard } from '@/components/ui/StatCard';
import { ErrorState, LoadingSpinner } from '@/lib/hooks';
import { formatCurrency, formatDate, formatNumber, invoiceStatusLabels } from '@/lib/utils';
import type { Customer, Invoice, Payment, Tariff, TariffTier } from '@/types';

type Tab = 'invoices' | 'payments' | 'tariffs';

const paymentApprovalStatusLabels: Record<string,string> = { pending:'بانتظار اعتماد المدير', approved:'معتمد', rejected:'مرفوض / مُعاد' };
const paymentMethodLabels: Record<string,string> = { cash:'نقدي', wallet:'محفظة إلكترونية', bank:'حوالة بنكية', other:'أخرى' };

export function BillingPage() {
  const { currentProject } = useProject();
  const { profile } = useAuth();
  const canRecordPayment = profile?.role === 'platform_admin' || profile?.role === 'tenant_manager' || profile?.role === 'collection_officer';
  const canApprove = profile?.role === 'platform_admin' || profile?.role === 'tenant_manager';
  const canManageTariff = profile?.role === 'platform_admin' || profile?.role === 'tenant_manager' || profile?.role === 'project_manager';
  const [tab,setTab] = useState<Tab>('invoices');
  const [invoices,setInvoices] = useState<(Invoice & {customers?:Customer})[]>([]);
  const [payments,setPayments] = useState<(Payment & {customers?:Customer;invoices?:Invoice})[]>([]);
  const [tariffs,setTariffs] = useState<Tariff[]>([]);
  const [tiers,setTiers] = useState<Record<string,TariffTier[]>>({});
  const [search,setSearch] = useState('');
  const [tenantName,setTenantName] = useState('');
  const [showPaymentForm,setShowPaymentForm] = useState(false);
  const [showTariffForm,setShowTariffForm] = useState(false);
  const [paymentForm,setPaymentForm] = useState<Record<string,string>>({});
  const [tariffForm,setTariffForm] = useState({name_ar:'',customer_type:'residential',fixed_fee:'0',base_liters_per_person_per_day:'50',base_price_per_m3:'0',reference_period_days:'30',tiers:[{from_m3:'0',to_m3:'',price_per_m3:''}]});
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [formError,setFormError]=useState<string|null>(null);

  const fetchData=useCallback(async()=>{
    if(!currentProject){setLoading(false);return;}
    setLoading(true);setError(null);
    try{
      const [inv,pay,tar,tenant] = await Promise.all([
        supabase.from('invoices').select('*, customers(name_ar,customer_number,phone)').eq('project_id',currentProject.id).order('issue_date',{ascending:false}),
        supabase.from('payments').select('*, customers(name_ar,customer_number), invoices(invoice_number,grand_total,balance)').eq('project_id',currentProject.id).order('payment_date',{ascending:false}),
        supabase.from('tariffs').select('*').eq('project_id',currentProject.id).order('effective_from',{ascending:false}),
        supabase.from('tenants').select('name_ar').eq('id',currentProject.tenant_id).maybeSingle(),
      ]);
      if(inv.error)throw inv.error;
      if(pay.error)throw pay.error;
      if(tar.error)throw tar.error;
      setInvoices((inv.data||[]) as any[]);
      setPayments((pay.data||[]) as any[]);
      setTariffs((tar.data||[]) as Tariff[]);
      setTenantName(tenant.data?.name_ar || currentProject.name_ar);
      const nextTiers:Record<string,TariffTier[]>={};
      await Promise.all((tar.data||[]).map(async(t:any)=>{
        const {data,error:e}=await supabase.from('tariff_tiers').select('*').eq('tariff_id',t.id).order('from_m3');
        if(e)throw e;
        nextTiers[t.id]=(data||[]) as TariffTier[];
      }));
      setTiers(nextTiers);
    }catch(e){setError(e instanceof Error?e.message:'فشل تحميل الفوترة');}
    finally{setLoading(false);}
  },[currentProject]);

  useEffect(()=>{void fetchData();},[fetchData]);

  useEffect(() => {
    if (!currentProject) return;
    const channel = supabase.channel(`mizan-billing-${currentProject.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meter_readings', filter: `project_id=eq.${currentProject.id}` }, () => { void fetchData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices', filter: `project_id=eq.${currentProject.id}` }, () => { void fetchData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `project_id=eq.${currentProject.id}` }, () => { void fetchData(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [currentProject, fetchData]);

  const filteredInvoices=useMemo(()=>{
    const q=search.trim().toLocaleLowerCase('ar');
    if(!q)return invoices;
    return invoices.filter(i=>i.invoice_number.toLocaleLowerCase().includes(q)||(i.customers?.name_ar||'').toLocaleLowerCase().includes(q)||(i.customers?.phone||'').includes(q));
  },[invoices,search]);

  const collected=payments.filter(p=>p.approval_status==='approved').reduce((s,p)=>s+Number(p.amount||0),0);
  const outstanding=invoices.reduce((s,i)=>s+Number(i.balance||0),0);
  const pendingPayments=payments.filter(p=>(p.approval_status??'pending')==='pending').reduce((s,p)=>s+Number(p.amount||0),0);

  const openPayment=(invoice:Invoice)=>{
    setPaymentForm({invoice_id:invoice.id,amount:String(invoice.balance),payment_method:'cash',reference_number:''});
    setFormError(null);setShowPaymentForm(true);
  };

  const recordPayment=async()=>{
    const invoice=invoices.find(i=>i.id===paymentForm.invoice_id);
    if(!invoice){setFormError('الفاتورة غير موجودة');return;}
    const amount=Number(paymentForm.amount);
    if(!Number.isFinite(amount)||amount<=0||amount>Number(invoice.balance)){setFormError('مبلغ التحصيل غير صالح أو يتجاوز المتبقي');return;}
    setSaving(true);setFormError(null);
    try{
      const {error:e}=await supabase.rpc('mizan_record_payment',{
        p_invoice_id:invoice.id,p_amount:amount,p_payment_method:paymentForm.payment_method||'cash',
        p_reference_number:paymentForm.reference_number||null,p_notes:null,p_client_payment_id:crypto.randomUUID()
      });
      if(e)throw e;
      toast('تم تسجيل التحصيل بانتظار اعتماد المدير.');
      setShowPaymentForm(false);setPaymentForm({});await fetchData();
    }catch(e){setFormError(e instanceof Error?e.message:'تعذر تسجيل التحصيل');}
    finally{setSaving(false);}
  };

  const reviewPayment=async(paymentId:string,decision:'approved'|'rejected')=>{
    const reason=decision==='rejected'?window.prompt('سبب الإرجاع مطلوب:')?.trim():null;
    if(decision==='rejected'&&!reason)return;
    if(decision==='approved'&&!window.confirm('تأكيد اعتماد التحصيل؟'))return;
    setSaving(true);setError(null);
    try{
      const {error:e}=await supabase.rpc('mizan_review_payment',{p_payment_id:paymentId,p_decision:decision,p_reason:reason||null});
      if(e)throw e;
      await fetchData();
    }catch(e){setError(e instanceof Error?e.message:'تعذر مراجعة التحصيل');}
    finally{setSaving(false);}
  };

  const saveTariff=async()=>{
    if(!currentProject||!tariffForm.name_ar.trim()){setFormError('اسم التعرفة مطلوب');return;}
    const baseLiters=Number(tariffForm.base_liters_per_person_per_day);
    const basePrice=Number(tariffForm.base_price_per_m3);
    const normalized=tariffForm.tiers.map(t=>({
      from_m3:Number(t.from_m3),
      to_m3:t.to_m3?Number(t.to_m3):null,
      price_per_m3:Number(t.price_per_m3)
    }));

    if(!Number.isFinite(baseLiters)||baseLiters<0){setFormError('قيمة الأساس للفرد غير صالحة');return;}
    if(!Number.isFinite(basePrice)||basePrice<0){setFormError('سعر المتر الأساسي غير صالح');return;}
    if(!Number.isInteger(Number(tariffForm.reference_period_days))||Number(tariffForm.reference_period_days)<=0){setFormError('الفترة المرجعية غير صالحة');return;}
    if(!normalized.length){setFormError('أضف شريحة تعرفة واحدة على الأقل');return;}
    for(let i=0;i<normalized.length;i++){
      const tier=normalized[i];
      if(!Number.isFinite(tier.from_m3)||tier.from_m3<0||!Number.isFinite(tier.price_per_m3)||tier.price_per_m3<0){
        setFormError('بيانات شرائح التعرفة غير صالحة');return;
      }
      if(tier.to_m3!==null&&(!Number.isFinite(tier.to_m3)||tier.to_m3<=tier.from_m3)){
        setFormError('نطاق شريحة التعرفة غير صالح');return;
      }
      if(i>0&&normalized[i].from_m3!==normalized[i-1].to_m3){
        setFormError('شرائح التعرفة يجب أن تكون متصلة بلا فجوات');return;
      }
    }
    if(normalized[0].from_m3!==0){setFormError('يجب أن تبدأ أول شريحة من 0 م³');return;}
    if(normalized[normalized.length-1].to_m3!==null){setFormError('يجب أن تنتهي شريحة التعرفة الزائدة بشريحة مفتوحة');return;}

    setSaving(true);setFormError(null);
    try{
      const {error:e}=await supabase.rpc('mizan_create_tariff_with_tiers',{
        p_project_id:currentProject.id,
        p_name_ar:tariffForm.name_ar.trim(),
        p_customer_type:tariffForm.customer_type,
        p_fixed_fee:Number(tariffForm.fixed_fee)||0,
        p_base_liters_per_person_per_day:baseLiters,
        p_base_price_per_m3:basePrice,
        p_reference_period_days:Number(tariffForm.reference_period_days)||30,
        p_tiers:normalized
      });
      if(e)throw e;
      setShowTariffForm(false);
      setTariffForm({name_ar:'',customer_type:'residential',fixed_fee:'0',base_liters_per_person_per_day:'50',base_price_per_m3:'0',reference_period_days:'30',tiers:[{from_m3:'0',to_m3:'',price_per_m3:''}]});
      await fetchData();
    }catch(e){setFormError(e instanceof Error?e.message:'تعذر حفظ التعرفة');}
    finally{setSaving(false);}
  };

  const printInvoice=async(invoice:Invoice)=>{
    const customer=invoices.find(i=>i.id===invoice.id)?.customers;
    const { data: meter } = invoice.meter_id ? await supabase.from('meters').select('serial_number,meter_number').eq('id',invoice.meter_id).maybeSingle() : { data: null };
    const w=window.open('','_blank','noopener,noreferrer');
    if(!w)return;
    const safe=(v:unknown)=>String(v??'—').replace(/[<>&]/g,(c)=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]!));
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${safe(tenantName)} - ${safe(invoice.invoice_number)}</title>
      <style>@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,Tahoma,sans-serif;color:#111;margin:0;font-size:12px}h1{font-size:21px;margin:0}h2{font-size:14px;margin:18px 0 8px;border-bottom:1px solid #ddd;padding-bottom:6px}.head{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:14px}.muted{color:#666}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.box{border:1px solid #ddd;border-radius:6px;padding:10px;margin-top:12px}.row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee}.total{font-size:16px;font-weight:bold;border-top:2px solid #111;border-bottom:0;margin-top:8px;padding-top:10px}.footer{margin-top:32px;border-top:1px solid #ddd;padding-top:10px;font-size:10px;color:#666}table{width:100%;border-collapse:collapse}td,th{padding:7px;border:1px solid #ddd;text-align:right}@media print{.no-print{display:none}}</style></head><body>
      <div class="head"><div><h1>${safe(tenantName)}</h1><div class="muted">${safe(currentProject?.name_ar)}</div><div class="muted">فاتورة مياه</div></div><div><b>${safe(invoice.invoice_number)}</b><br><span class="muted">${safe(formatDate(invoice.issue_date))}</span></div></div>
      <h2>بيانات المشترك</h2><div class="grid box"><div><b>الاسم:</b> ${safe(customer?.name_ar)}</div><div><b>رقم المشترك:</b> ${safe(customer?.customer_number)}</div><div><b>الهاتف:</b> ${safe(customer?.phone)}</div><div><b>الرقم التسلسلي الفعلي للعداد:</b> ${safe(meter?.serial_number)}</div></div>
      <h2>فترة الاستهلاك والقراءة</h2><table><tr><th>الفترة</th><th>الأيام</th><th>القراءة السابقة</th><th>القراءة الحالية</th><th>الاستهلاك</th></tr><tr><td>${safe(invoice.billing_period_start)} إلى ${safe(invoice.billing_period_end)}</td><td>${safe(formatNumber(invoice.billing_days))}</td><td>${safe(formatNumber(invoice.previous_reading))}</td><td>${safe(formatNumber(invoice.current_reading))}</td><td>${safe(formatNumber(invoice.consumption_m3))} م³</td></tr></table>
      <h2>تفاصيل الاستحقاق</h2><div class="box"><div class="row"><span>الحد الأساسي للفترة</span><b>${safe(formatNumber(invoice.allowance_m3))} م³</b></div><div class="row"><span>الكمية ضمن التعرفة الأساسية</span><b>${safe(formatNumber(invoice.included_consumption_m3))} م³</b></div><div class="row"><span>الكمية بالتعرفة الزائدة</span><b>${safe(formatNumber(invoice.tiered_consumption_m3))} م³</b></div><div class="row"><span>الرسوم الثابتة</span><b>${safe(formatCurrency(invoice.fixed_fee))}</b></div><div class="row"><span>رسوم الاستهلاك</span><b>${safe(formatCurrency(invoice.consumption_fee))}</b></div><div class="row"><span>المتأخرات السابقة</span><b>${safe(formatCurrency(invoice.previous_balance))}</b></div><div class="row total"><span>إجمالي المستحق</span><b>${safe(formatCurrency(invoice.grand_total))}</b></div><div class="row"><span>المدفوع</span><b>${safe(formatCurrency(invoice.amount_paid))}</b></div><div class="row"><span>الرصيد المتبقي</span><b>${safe(formatCurrency(invoice.balance))}</b></div></div>
      <div class="footer">تم إنشاء هذه الفاتورة آلياً من قراءة عداد مسجلة ومتحقق منها. الاعتماد المالي يتم عند التحصيل. التعرفة المستخدمة محفوظة مع الفاتورة لضمان إمكانية المراجعة اللاحقة.</div>
      <script>window.onload=()=>{window.focus();window.print()}</script></body></html>`);
    w.document.close();
  };

  if(!currentProject)return <div className="text-center py-20 text-neutral-400">اختر مشروعاً للبدء</div>;
  if(loading)return <LoadingSpinner label="جاري تحميل الفوترة والتحصيل..." />;
  if(error)return <ErrorState message={error} onRetry={fetchData}/>;

  const tabs=[{id:'invoices' as Tab,label:'الفواتير',icon:Receipt,count:invoices.length},{id:'payments' as Tab,label:'التحصيل',icon:Wallet,count:payments.length},...(canManageTariff?[{id:'tariffs' as Tab,label:'التعريفات',icon:TrendingUp,count:tariffs.length}]:[])];

  return <div className="space-y-6 animate-fade-in" dir="rtl">
    <div className="flex items-center justify-between flex-wrap gap-3"><div><h1 className="text-2xl font-bold">الفوترة والتحصيل</h1><p className="text-sm text-neutral-500 mt-1">{tenantName||currentProject.name_ar} · {currentProject.name_ar}</p></div>{canManageTariff&&tab==='tariffs'&&<button className="btn-primary" onClick={()=>{setFormError(null);setShowTariffForm(true)}}><Plus size={17}/> تعرفة جديدة</button>}</div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard title="إجمالي الفواتير" value={formatNumber(invoices.length)} icon={FileText} color="primary"/>
      <StatCard title="المبالغ المستحقة" value={formatCurrency(outstanding)} icon={Receipt} color={outstanding>0?'error':'success'}/>
      <StatCard title="المحصّل المعتمد" value={formatCurrency(collected)} icon={CheckCircle} color="success"/>
      <StatCard title="بانتظار الاعتماد" value={formatCurrency(pendingPayments)} icon={Loader2} color="warning"/>
    </div>
    <div className="flex gap-1 bg-neutral-100 p-1 rounded-xl w-fit">{tabs.map(t=><button key={t.id} onClick={()=>setTab(t.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm ${tab===t.id?'bg-white text-primary-700 shadow-sm':'text-neutral-500'}`}><t.icon size={16}/>{t.label}<span className="text-xs px-1.5 rounded-full bg-neutral-200">{t.count}</span></button>)}</div>

    {tab==='invoices'&&<><div className="relative max-w-lg"><Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"/><input className="input-field pr-10" placeholder="بحث برقم الفاتورة أو اسم المشترك أو الهاتف..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
      {filteredInvoices.length===0?<div className="card"><EmptyState icon={Receipt} title="لا توجد فواتير" description="تظهر الفاتورة تلقائياً بعد تسجيل قراءة العداد وحسابها وفق الفترة الفعلية." /></div>:
      <div className="card overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-right text-xs text-neutral-400 bg-neutral-50 border-b"><th className="px-4 py-3">الفاتورة</th><th className="px-4 py-3">المشترك</th><th className="px-4 py-3">الفترة</th><th className="px-4 py-3">الاستهلاك</th><th className="px-4 py-3">المتأخرات</th><th className="px-4 py-3">الإجمالي</th><th className="px-4 py-3">المتبقي</th><th className="px-4 py-3">الحالة</th><th className="px-4 py-3">إجراء</th></tr></thead><tbody className="divide-y">{filteredInvoices.map(inv=><tr key={inv.id}><td className="px-4 py-3 font-semibold">{inv.invoice_number}</td><td className="px-4 py-3">{inv.customers?.name_ar||'—'}</td><td className="px-4 py-3">{formatNumber(inv.billing_days)} يوم</td><td className="px-4 py-3">{formatNumber(inv.consumption_m3)} م³</td><td className="px-4 py-3">{formatCurrency(inv.previous_balance)}</td><td className="px-4 py-3 font-semibold">{formatCurrency(inv.grand_total)}</td><td className="px-4 py-3 font-semibold">{formatCurrency(inv.balance)}</td><td className="px-4 py-3"><Badge status={inv.status} label={invoiceStatusLabels[inv.status]||inv.status}/></td><td className="px-4 py-3"><div className="flex gap-2">{canRecordPayment&&inv.status!=='paid'&&<button className="text-primary-700 text-xs font-semibold" onClick={()=>openPayment(inv)}>تحصيل</button>}<button className="text-neutral-700 text-xs font-semibold" onClick={()=>printInvoice(inv)}>طباعة / PDF</button></div></td></tr>)}</tbody></table></div>}</>}

    {tab==='payments'&&(payments.length===0?<div className="card"><EmptyState icon={Wallet} title="لا توجد تحصيلات" description="تظهر التحصيلات هنا بعد تسجيلها من المحصل." /></div>:
      <div className="card overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-right text-xs text-neutral-400 bg-neutral-50 border-b"><th className="px-4 py-3">الإيصال</th><th className="px-4 py-3">المشترك</th><th className="px-4 py-3">المبلغ</th><th className="px-4 py-3">المحصل</th><th className="px-4 py-3">الحالة</th><th className="px-4 py-3">التاريخ</th>{canApprove&&<th className="px-4 py-3">المراجعة</th>}</tr></thead><tbody className="divide-y">{payments.map(p=><tr key={p.id}><td className="px-4 py-3 font-semibold">{p.receipt_number}</td><td className="px-4 py-3">{p.customers?.name_ar||'—'}</td><td className="px-4 py-3">{formatCurrency(p.amount)}</td><td className="px-4 py-3">{p.collector_name||'—'}</td><td className="px-4 py-3"><Badge status={p.approval_status??'pending'} label={paymentApprovalStatusLabels[p.approval_status??'pending']}/></td><td className="px-4 py-3 text-xs">{formatDate(p.payment_date)}</td>{canApprove&&p.approval_status==='pending'&&p.recorded_by!==profile?.id&&<td className="px-4 py-3"><div className="flex gap-2"><button disabled={saving} onClick={()=>reviewPayment(p.id,'approved')} className="text-success-700 text-xs">اعتماد</button><button disabled={saving} onClick={()=>reviewPayment(p.id,'rejected')} className="text-error-700 text-xs">إرجاع</button></div></td>}</tr>)}</tbody></table></div>)}

    {tab==='tariffs'&&<div className="grid grid-cols-1 md:grid-cols-2 gap-4">{tariffs.length===0?<div className="card md:col-span-2"><EmptyState icon={TrendingUp} title="لا توجد تعريفات" description="أنشئ التعرفة التي سيستخدمها النظام تلقائياً عند إصدار الفاتورة."/></div>:tariffs.map(t=><div className="card-hover p-5" key={t.id}><div className="flex justify-between"><div><h3 className="font-bold">{t.name_ar}</h3><p className="text-sm text-neutral-500">{t.customer_type==='residential'?'منزلي':t.customer_type}</p></div>{t.is_active&&<Badge status="active" label="سارية"/>}</div><div className="mt-4 text-sm space-y-2"><div className="flex justify-between"><span>الحد الأساسي للفرد/اليوم</span><b>{formatNumber(t.base_liters_per_person_per_day)} لتر</b></div><div className="flex justify-between"><span>سعر المتر الأساسي</span><b>{formatCurrency(t.base_price_per_m3)}</b></div><div className="flex justify-between"><span>الرسوم الثابتة / الفترة المرجعية</span><b>{formatCurrency(t.fixed_fee)} · {t.reference_period_days} يوم</b></div><div className="border-t pt-2"><p className="text-xs text-neutral-400 mb-1">شرائح ما بعد الحد الأساسي</p>{(tiers[t.id]||[]).map(x=><div key={x.id} className="flex justify-between"><span>{formatNumber(x.from_m3)} - {x.to_m3===null?'ما فوق':formatNumber(x.to_m3)} م³</span><b>{formatCurrency(x.price_per_m3)}/م³</b></div>)}</div></div></div>)}</div>}

    <Modal open={showPaymentForm} onClose={()=>setShowPaymentForm(false)} title="تسجيل تحصيل" size="md">
      {formError&&<div className="mb-4 p-3 rounded-lg bg-error-50 text-error-700 text-sm"><AlertCircle size={16} className="inline ml-1"/>{formError}</div>}
      <div className="space-y-4"><div className="bg-neutral-50 rounded-xl p-4 text-sm"><b>{invoices.find(i=>i.id===paymentForm.invoice_id)?.customers?.name_ar}</b><div className="mt-2">المتبقي: <strong>{formatCurrency(invoices.find(i=>i.id===paymentForm.invoice_id)?.balance||0)}</strong></div></div><div><label className="label-field">المبلغ *</label><input type="number" className="input-field text-lg font-bold" value={paymentForm.amount||''} onChange={e=>setPaymentForm({...paymentForm,amount:e.target.value})}/></div><div><label className="label-field">طريقة الدفع</label><select className="input-field" value={paymentForm.payment_method||'cash'} onChange={e=>setPaymentForm({...paymentForm,payment_method:e.target.value})}>{Object.entries(paymentMethodLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div><div><label className="label-field">مرجع العملية</label><input className="input-field" value={paymentForm.reference_number||''} onChange={e=>setPaymentForm({...paymentForm,reference_number:e.target.value})}/></div></div>
      <div className="flex gap-3 mt-6"><button className="btn-secondary flex-1" onClick={()=>setShowPaymentForm(false)}>إلغاء</button><button className="btn-primary flex-1" disabled={saving} onClick={recordPayment}>{saving?<><Loader2 size={16} className="animate-spin"/> جاري الحفظ...</>:'تسجيل التحصيل'}</button></div>
    </Modal>

    <Modal open={showTariffForm} onClose={()=>setShowTariffForm(false)} title="تعرفة جديدة" size="lg">
      {formError&&<div className="mb-4 p-3 rounded-lg bg-error-50 text-error-700 text-sm"><AlertCircle size={16} className="inline ml-1"/>{formError}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label className="label-field">اسم التعرفة *</label><input className="input-field" value={tariffForm.name_ar} onChange={e=>setTariffForm({...tariffForm,name_ar:e.target.value})}/></div>
        <div><label className="label-field">نوع المشترك</label><select className="input-field" value={tariffForm.customer_type} onChange={e=>setTariffForm({...tariffForm,customer_type:e.target.value})}><option value="residential">منزلي</option><option value="commercial">تجاري</option><option value="institutional">مؤسسي</option></select></div>
        <div><label className="label-field">الأساس للفرد/اليوم (لتر)</label><input type="number" min="0" className="input-field" value={tariffForm.base_liters_per_person_per_day} onChange={e=>setTariffForm({...tariffForm,base_liters_per_person_per_day:e.target.value})}/></div>
        <div><label className="label-field">سعر المتر ضمن الحد الأساسي</label><input type="number" min="0" className="input-field" value={tariffForm.base_price_per_m3} onChange={e=>setTariffForm({...tariffForm,base_price_per_m3:e.target.value})}/></div>
        <div><label className="label-field">رسوم ثابتة للفترة المرجعية</label><input type="number" min="0" className="input-field" value={tariffForm.fixed_fee} onChange={e=>setTariffForm({...tariffForm,fixed_fee:e.target.value})}/></div>
        <div><label className="label-field">أيام الفترة المرجعية</label><input type="number" min="1" className="input-field" value={tariffForm.reference_period_days} onChange={e=>setTariffForm({...tariffForm,reference_period_days:e.target.value})}/></div>
      </div>
      <div className="mt-5"><div className="flex items-center justify-between mb-2"><h3 className="font-bold">شرائح الاستهلاك بعد الحد الأساسي</h3><button className="btn-secondary text-xs" onClick={()=>setTariffForm({...tariffForm,tiers:[...tariffForm.tiers,{from_m3:tariffForm.tiers[tariffForm.tiers.length - 1]?.to_m3||'0',to_m3:'',price_per_m3:''}]})}><Plus size={14}/> شريحة</button></div>
        <div className="space-y-2">{tariffForm.tiers.map((t,i)=><div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2" key={i}><input className="input-field" type="number" min="0" placeholder="من" value={t.from_m3} onChange={e=>setTariffForm({...tariffForm,tiers:tariffForm.tiers.map((x,n)=>n===i?{...x,from_m3:e.target.value}:x)})}/><input className="input-field" type="number" min="0" placeholder="إلى (فارغ = مفتوح)" value={t.to_m3} onChange={e=>setTariffForm({...tariffForm,tiers:tariffForm.tiers.map((x,n)=>n===i?{...x,to_m3:e.target.value}:x)})}/><input className="input-field" type="number" min="0" placeholder="ر.ي/م³" value={t.price_per_m3} onChange={e=>setTariffForm({...tariffForm,tiers:tariffForm.tiers.map((x,n)=>n===i?{...x,price_per_m3:e.target.value}:x)})}/>{tariffForm.tiers.length>1&&<button className="text-error-600" onClick={()=>setTariffForm({...tariffForm,tiers:tariffForm.tiers.filter((_,n)=>n!==i)})}>حذف</button>}</div>)}</div>
      </div>
      <div className="mt-4 p-3 rounded-lg bg-primary-50 text-primary-800 text-sm">الشرائح والرسوم معرفة على فترة مرجعية قابلة للضبط. النظام يمدد أو يقلص الحدود والرسوم تلقائياً وفق عدد أيام القراءة الفعلية.</div>
      <div className="flex gap-3 mt-6"><button className="btn-secondary flex-1" onClick={()=>setShowTariffForm(false)}>إلغاء</button><button className="btn-primary flex-1" disabled={saving} onClick={saveTariff}>{saving?'جاري الحفظ...':'حفظ التعرفة'}</button></div>
    </Modal>
  </div>;
}
