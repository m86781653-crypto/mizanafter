import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useProject } from '@/context/ProjectContext';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatCard } from '@/components/ui/StatCard';
import { LoadingSpinner, ErrorState } from '@/lib/hooks';
import { formatNumber, formatCurrency, formatDate, invoiceStatusLabels } from '@/lib/utils';
import { Receipt, Wallet, Plus, TrendingUp, AlertTriangle, CheckCircle, Loader2, Search, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { Invoice, Payment, Customer, Meter, Tariff, TariffTier } from '@/types';

type Tab = 'invoices' | 'payments' | 'tariffs';

const paymentApprovalStatusLabels: Record<string, string> = { pending: 'بانتظار اعتماد المدير', approved: 'معتمد', rejected: 'مرفوض / مُعاد' };

const paymentMethodLabels: Record<string, string> = {
  cash: 'نقدي', wallet: 'محفظة إلكترونية', bank: 'حوالة بنكية', other: 'أخرى',
};

export function BillingPage() {
  const { currentProject } = useProject();
  const { profile } = useAuth();
  const canEdit = profile?.role === 'platform_admin' || profile?.role === 'tenant_manager' || profile?.role === 'collection_officer';
  const canApprove = profile?.role === 'platform_admin' || profile?.role === 'tenant_manager';
  const [tab, setTab] = useState<Tab>('invoices');
  const [invoices, setInvoices] = useState<(Invoice & { customers?: Customer })[]>([]);
  const [payments, setPayments] = useState<(Payment & { customers?: Customer; invoices?: Invoice })[]>([]);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [tiers, setTiers] = useState<Record<string, TariffTier[]>>({});
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showTariffForm, setShowTariffForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Record<string, string>>({});
  const [paymentForm, setPaymentForm] = useState<Record<string, string>>({});
  const [tariffForm, setTariffForm] = useState<{ name_ar: string; customer_type: string; fixed_fee: string; tiers: { from_m3: string; to_m3: string; price_per_m3: string }[] }>({
    name_ar: '', customer_type: 'residential', fixed_fee: '500', tiers: [{ from_m3: '0', to_m3: '10', price_per_m3: '100' }]
  });

  const fetchData = useCallback(async () => {
    if (!currentProject) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    const pid = currentProject.id;
    try {
      const [inv, pay, tar, cus, met] = await Promise.all([
        supabase.from('invoices').select('*, customers(name_ar, customer_number, phone)').eq('project_id', pid).order('issue_date', { ascending: false }),
        supabase.from('payments').select('*, customers(name_ar, customer_number), invoices(invoice_number, grand_total)').eq('project_id', pid).order('payment_date', { ascending: false }),
        supabase.from('tariffs').select('*').eq('project_id', pid).order('effective_from', { ascending: false }),
        supabase.from('customers').select('*').eq('project_id', pid).eq('status', 'active').order('name_ar'),
        supabase.from('meters').select('*').eq('project_id', pid).eq('status', 'active').order('meter_number'),
      ]);
      if (inv.error) throw inv.error;
      setInvoices((inv.data as any[]) || []);
      setPayments((pay.data as any[]) || []);
      setTariffs(tar.data as Tariff[] || []);
      setCustomers(cus.data as Customer[] || []);
      setMeters(met.data as Meter[] || []);

      if (tar.data && tar.data.length > 0) {
        const tierResults: Record<string, TariffTier[]> = {};
        await Promise.all(tar.data.map(async (t: any) => {
          const { data: td } = await supabase.from('tariff_tiers').select('*').eq('tariff_id', t.id).order('from_m3');
          tierResults[t.id] = td as TariffTier[] || [];
        }));
        setTiers(tierResults);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تحميل البيانات');
    }
    setLoading(false);
  }, [currentProject]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalRevenue = invoices.reduce((s, i) => s + Number(i.grand_total), 0);
  const collected = payments.filter(p => p.approval_status === 'approved').reduce((s, p) => s + Number(p.amount), 0);
  const outstanding = invoices.filter(i => i.status !== 'paid').reduce((s, i) => s + Number(i.balance), 0);

  const filteredInvoices = invoices.filter(i =>
    !search || i.invoice_number.includes(search) || (i.customers?.name_ar || '').includes(search)
  );

  const handleCreateInvoice = async () => {
    if (!currentProject || !form.customer_id) return;
    setSaving(true);
    setFormError(null);
    const pid = currentProject.id;

    const customer = customers.find(c => c.id === form.customer_id);
    const meter = meters.find(m => m.customer_id === form.customer_id);
    if (!customer) { setFormError('المشترك غير موجود'); setSaving(false); return; }
    if (!meter) { setFormError('لا يوجد عداد نشط لهذا المشترك'); setSaving(false); return; }

    const prev = Number(meter.last_reading);
    const current = parseFloat(form.current_reading);
    if (isNaN(current)) { setFormError('القراءة الحالية غير صحيحة'); setSaving(false); return; }
    if (current < prev) { setFormError(`القراءة الحالية أقل من السابقة (${prev})`); setSaving(false); return; }

    const consumption = current - prev;
    const tariff = tariffs.find(t => t.customer_type === customer.customer_type && t.is_active);
    if (!tariff) { setFormError('لا توجد تعرفة نشطة لنوع هذا المشترك'); setSaving(false); return; }

    const tariffTiers = tiers[tariff.id] || [];
    const fixedFee = tariff ? Number(tariff.fixed_fee) : 0;

    let consumptionFee = 0;
    let remaining = consumption;
    for (const tier of tariffTiers) {
      if (remaining <= 0) break;
      const from = Number(tier.from_m3);
      const to = tier.to_m3 ? Number(tier.to_m3) : Infinity;
      const tierRange = to - from;
      const usedInTier = Math.min(remaining, tierRange);
      consumptionFee += usedInTier * Number(tier.price_per_m3);
      remaining -= usedInTier;
    }

    const total = fixedFee + consumptionFee;
    const today = new Date();
    const dueDate = new Date(today.getTime() + 15 * 86400000);

    // Get invoice number from DB sequence
    const { data: seqData } = await supabase.rpc('next_seq_number', { seq_name: 'INV' });
    const invoiceNumber = seqData || `INV-${today.getFullYear()}-${Date.now()}`;

    const { data, error: insErr } = await supabase.from('invoices').insert({
      project_id: pid,
      customer_id: customer.id,
      meter_id: meter.id,
      invoice_number: invoiceNumber,
      billing_period_start: form.period_start || new Date(today.getTime() - 30 * 86400000).toISOString().split('T')[0],
      billing_period_end: form.period_end || today.toISOString().split('T')[0],
      previous_reading: prev,
      current_reading: current,
      consumption_m3: consumption,
      fixed_fee: fixedFee,
      consumption_fee: consumptionFee,
      total_amount: total,
      grand_total: total,
      balance: total,
      status: 'unpaid',
      due_date: dueDate.toISOString().split('T')[0],
    }).select('*, customers(name_ar, customer_number, phone)').single();

    if (insErr) { setFormError(insErr.message); setSaving(false); return; }

    if (data) {
      await supabase.from('meters').update({ last_reading: current, last_reading_date: new Date().toISOString() }).eq('id', meter.id);
      setInvoices([data as any, ...invoices]);
      setShowForm(false);
      setForm({});
    }
    setSaving(false);
  };

  const handleRecordPayment = async () => {
    if (!currentProject || !paymentForm.invoice_id) { setSaving(false); return; }
    setSaving(true);
    setFormError(null);

    const invoice = invoices.find(i => i.id === paymentForm.invoice_id);
    if (!invoice) { setFormError('الفاتورة غير موجودة'); setSaving(false); return; }

    const amount = parseFloat(paymentForm.amount);
    if (isNaN(amount) || amount <= 0) { setFormError('المبلغ غير صحيح'); setSaving(false); return; }
    if (amount > Number(invoice.balance)) { setFormError(`المبلغ يتجاوز المتبقي (${formatCurrency(invoice.balance)})`); setSaving(false); return; }

    const { data, error: rpcError } = await supabase.rpc('mizan_record_payment', {
      p_invoice_id: invoice.id,
      p_amount: amount,
      p_payment_method: paymentForm.payment_method || 'cash',
      p_reference_number: paymentForm.reference_number || null,
      p_notes: paymentForm.notes || null,
    });

    if (rpcError) {
      setFormError(rpcError.message);
      setSaving(false);
      return;
    }

    if (data) {
      await fetchData();
      setShowPaymentForm(false);
      setPaymentForm({});
    }
    setSaving(false);
  };

  const handleReviewPayment = async (paymentId: string, decision: 'approved' | 'rejected') => {
    const reason = decision === 'rejected'
      ? window.prompt('سبب رفض/إرجاع التحصيل:')?.trim()
      : null;

    if (decision === 'rejected' && !reason) return;
    if (decision === 'approved' && !window.confirm('تأكيد اعتماد هذا التحصيل؟')) return;

    setSaving(true);
    setError(null);

    const { error: reviewError } = await supabase.rpc('mizan_review_payment', {
      p_payment_id: paymentId,
      p_decision: decision,
      p_reason: reason || null,
    });

    if (reviewError) {
      setError(reviewError.message);
      setSaving(false);
      return;
    }

    await fetchData();
    setSaving(false);
  };

  const handleSaveTariff = async () => {
    if (!currentProject || !tariffForm.name_ar) { setSaving(false); return; }
    setSaving(true);
    setFormError(null);
    const { data: tar, error: tarErr } = await supabase.from('tariffs').insert({
      project_id: currentProject.id,
      name_ar: tariffForm.name_ar,
      customer_type: tariffForm.customer_type,
      fixed_fee: parseFloat(tariffForm.fixed_fee) || 0,
      is_active: true,
      version: 1,
    }).select().single();

    if (tarErr) { setFormError(tarErr.message); setSaving(false); return; }

    if (tar && tariffForm.tiers.length > 0) {
      const { error: tierErr } = await supabase.from('tariff_tiers').insert(
        tariffForm.tiers.map(t => ({
          tariff_id: tar.id,
          from_m3: parseFloat(t.from_m3) || 0,
          to_m3: t.to_m3 ? parseFloat(t.to_m3) : null,
          price_per_m3: parseFloat(t.price_per_m3) || 0,
        }))
      );
      if (tierErr) { setFormError(tierErr.message); setSaving(false); return; }
    }

    // Update local state instead of reload
    setTariffs([tar as Tariff, ...tariffs]);
    setTiers({ ...tiers, [tar.id]: tariffForm.tiers.map((t, idx) => ({
      id: `temp-${idx}`, tariff_id: tar.id,
      from_m3: parseFloat(t.from_m3) || 0,
      to_m3: t.to_m3 ? parseFloat(t.to_m3) : null,
      price_per_m3: parseFloat(t.price_per_m3) || 0,
    })) });
    setShowTariffForm(false);
    setTariffForm({ name_ar: '', customer_type: 'residential', fixed_fee: '500', tiers: [{ from_m3: '0', to_m3: '10', price_per_m3: '100' }] });
    setSaving(false);
  };

  const handleDeletePayment = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا التحصيل؟')) return;
    const { error: delErr } = await supabase.from('payments').delete().eq('id', id);
    if (delErr) { setError(delErr.message); return; }
    setPayments(payments.filter(p => p.id !== id));
  };

  if (!currentProject) return <div className="text-center py-20 text-neutral-400">اختر مشروعاً للبدء</div>;
  if (loading) return <LoadingSpinner label="جاري تحميل بيانات الفوترة..." />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  const tabs = [
    { id: 'invoices' as Tab, label: 'الفواتير', icon: Receipt, count: invoices.length },
    { id: 'payments' as Tab, label: 'التحصيل', icon: Wallet, count: payments.length },
    { id: 'tariffs' as Tab, label: 'التعريفات', icon: TrendingUp, count: tariffs.length },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">الفوترة والتحصيل</h1>
          <p className="text-sm text-neutral-500 mt-1">{currentProject.name_ar}</p>
        </div>
        {canEdit && tab === 'invoices' && <button onClick={() => { setForm({}); setFormError(null); setShowForm(true); }} className="btn-primary"><Plus size={18} /> فاتورة جديدة</button>}
        {canEdit && tab === 'payments' && <button onClick={() => { setPaymentForm({}); setFormError(null); setShowPaymentForm(true); }} className="btn-primary"><Plus size={18} /> تسجيل تحصيل</button>}
        {canEdit && tab === 'tariffs' && <button onClick={() => { setFormError(null); setShowTariffForm(true); }} className="btn-primary"><Plus size={18} /> تعرفة جديدة</button>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="إجمالي الإيرادات" value={formatCurrency(totalRevenue)} icon={Receipt} color="primary" />
        <StatCard title="المحصّل" value={formatCurrency(collected)} icon={CheckCircle} color="success" />
        <StatCard title="المتأخرات" value={formatCurrency(outstanding)} icon={AlertTriangle} color={outstanding > 0 ? 'error' : 'neutral'} />
        <StatCard title="بانتظار الاعتماد" value={formatCurrency(payments.filter(p => p.approval_status === 'pending').reduce((s, p) => s + Number(p.amount), 0))} icon={Loader2} color="neutral" />
      </div>

      <div className="flex gap-1 bg-neutral-100 p-1 rounded-xl w-fit">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-white text-primary-700 shadow-sm' : 'text-neutral-500'}`}>
              <Icon size={16} /> {t.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-primary-100 text-primary-700' : 'bg-neutral-200'}`}>{t.count}</span>
            </button>
          );
        })}
      </div>

      {tab === 'invoices' && (
        <>
          <div className="relative max-w-md">
            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input className="input-field pr-10" placeholder="بحث برقم الفاتورة أو اسم المشترك..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {filteredInvoices.length === 0 ? (
            <div className="card"><EmptyState icon={Receipt} title="لا توجد فواتير" description="أنشئ أول فاتورة لبدء دورة الفوترة" action={canEdit ? { label: 'فاتورة جديدة', onClick: () => { setForm({}); setFormError(null); setShowForm(true); } } : undefined} /></div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-right text-xs text-neutral-400 border-b border-neutral-200 bg-neutral-50">
                    <th className="px-4 py-3 font-medium">رقم الفاتورة</th>
                    <th className="px-4 py-3 font-medium">المشترك</th>
                    <th className="px-4 py-3 font-medium">الاستهلاك</th>
                    <th className="px-4 py-3 font-medium">الرسوم الثابتة</th>
                    <th className="px-4 py-3 font-medium">رسوم الاستهلاك</th>
                    <th className="px-4 py-3 font-medium">الإجمالي</th>
                    <th className="px-4 py-3 font-medium">المتبقي</th>
                    <th className="px-4 py-3 font-medium">الحالة</th>
                    <th className="px-4 py-3 font-medium">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-neutral-50 transition-smooth">
                      <td className="px-4 py-3 font-medium text-neutral-800">{inv.invoice_number}</td>
                      <td className="px-4 py-3 text-neutral-600">{inv.customers?.name_ar || '—'}</td>
                      <td className="px-4 py-3 text-neutral-600">{formatNumber(inv.consumption_m3)} م³</td>
                      <td className="px-4 py-3 text-neutral-600">{formatCurrency(inv.fixed_fee)}</td>
                      <td className="px-4 py-3 text-neutral-600">{formatCurrency(inv.consumption_fee)}</td>
                      <td className="px-4 py-3 font-semibold text-neutral-800">{formatCurrency(inv.grand_total)}</td>
                      <td className="px-4 py-3 font-semibold text-neutral-800">{formatCurrency(inv.balance)}</td>
                      <td className="px-4 py-3"><Badge status={inv.status} label={invoiceStatusLabels[inv.status] || inv.status} /></td>
                      <td className="px-4 py-3">
                        {canEdit && inv.status !== 'paid' && (
                          <button onClick={() => { setPaymentForm({ invoice_id: inv.id, amount: inv.balance.toString(), payment_method: 'cash' }); setFormError(null); setShowPaymentForm(true); }} className="text-primary-600 hover:text-primary-700 text-xs font-medium">
                            تحصيل
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'payments' && (
        payments.length === 0 ? (
          <div className="card"><EmptyState icon={Wallet} title="لا توجد مدفوعات مسجلة" description="سجل أول تحصيل لبدء تتبع الإيرادات" action={canEdit ? { label: 'تسجيل تحصيل', onClick: () => { setPaymentForm({}); setFormError(null); setShowPaymentForm(true); } } : undefined} /></div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-xs text-neutral-400 border-b border-neutral-200 bg-neutral-50">
                  <th className="px-4 py-3 font-medium">رقم الإيصال</th>
                  <th className="px-4 py-3 font-medium">المشترك</th>
                  <th className="px-4 py-3 font-medium">الفاتورة</th>
                  <th className="px-4 py-3 font-medium">المبلغ</th>
                  <th className="px-4 py-3 font-medium">طريقة الدفع</th>
                  <th className="px-4 py-3 font-medium">المحصل</th>
                  <th className="px-4 py-3 font-medium">التاريخ</th>
                  {canEdit && <th className="px-4 py-3 font-medium"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-50 transition-smooth">
                    <td className="px-4 py-3 font-medium text-neutral-800">{p.receipt_number}</td>
                    <td className="px-4 py-3 text-neutral-600">{p.customers?.name_ar || '—'}</td>
                    <td className="px-4 py-3 text-neutral-600">{p.invoices?.invoice_number || '—'}</td>
                    <td className="px-4 py-3 font-semibold text-success-700">{formatCurrency(p.amount)}</td>
                    <td className="px-4 py-3 text-neutral-600">{paymentMethodLabels[p.payment_method] || p.payment_method}</td>
                    <td className="px-4 py-3 text-neutral-600">{p.collector_name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-neutral-400">{formatDate(p.payment_date)}</td>
                    {canEdit && (
                      <td className="px-4 py-3">
                        <button onClick={() => handleDeletePayment(p.id)} className="text-error-500 hover:text-error-700 transition-smooth">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'tariffs' && (
        tariffs.length === 0 ? (
          <div className="card"><EmptyState icon={TrendingUp} title="لا توجد تعريفات" description="أنشئ أول تعرفة لاحتساب الفواتير" action={canEdit ? { label: 'تعرفة جديدة', onClick: () => { setFormError(null); setShowTariffForm(true); } } : undefined} /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tariffs.map((t) => (
              <div key={t.id} className="card-hover p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-primary-50 text-primary-700"><TrendingUp size={20} /></div>
                  <div className="flex items-center gap-2">
                    <span className="badge bg-neutral-100 text-neutral-600">إصدار {t.version}</span>
                    {t.is_active && <Badge status="active" label="سارية" />}
                  </div>
                </div>
                <h3 className="font-bold text-neutral-900">{t.name_ar}</h3>
                <p className="text-sm text-neutral-500">النوع: {t.customer_type === 'residential' ? 'منزلي' : t.customer_type === 'commercial' ? 'تجاري' : t.customer_type}</p>
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-400">الرسوم الثابتة</span>
                    <span className="font-semibold text-neutral-700">{formatCurrency(t.fixed_fee)}</span>
                  </div>
                  <div className="border-t border-neutral-100 pt-2">
                    <p className="text-xs text-neutral-400 mb-2">شرائح الاستهلاك:</p>
                    {(tiers[t.id] || []).map((tier) => (
                      <div key={tier.id} className="flex justify-between text-sm py-1">
                        <span className="text-neutral-600">
                          {formatNumber(tier.from_m3)} - {tier.to_m3 ? formatNumber(tier.to_m3) : 'ما فوق'} م³
                        </span>
                        <span className="font-medium text-neutral-700">{formatNumber(tier.price_per_m3)} ر.ي/م³</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Invoice Form Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="إنشاء فاتورة جديدة" size="lg">
        <div className="space-y-4">
          {formError && <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-error-50 text-error-700 text-sm"><AlertCircle size={16} /><span>{formError}</span></div>}
          <div>
            <label className="label-field">المشترك *</label>
            <select className="input-field" value={form.customer_id || ''} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
              <option value="">— اختر المشترك —</option>
              {customers.map((c) => {
                const meter = meters.find(m => m.customer_id === c.id);
                return <option key={c.id} value={c.id}>{c.customer_number} - {c.name_ar} {meter ? `(قراءة سابقة: ${meter.last_reading})` : ''}</option>;
              })}
            </select>
          </div>
          {form.customer_id && (() => {
            const meter = meters.find(m => m.customer_id === form.customer_id);
            const customer = customers.find(c => c.id === form.customer_id);
            const tariff = tariffs.find(t => t.customer_type === customer?.customer_type && t.is_active);
            return meter ? (
              <div className="bg-neutral-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-neutral-400">العداد</span><span className="font-medium text-neutral-700">{meter.meter_number}</span></div>
                <div className="flex justify-between"><span className="text-neutral-400">القراءة السابقة</span><span className="font-medium text-neutral-700">{formatNumber(meter.last_reading)}</span></div>
                <div className="flex justify-between"><span className="text-neutral-400">التعرفة</span><span className="font-medium text-neutral-700">{tariff?.name_ar || 'لا توجد تعرفة'}</span></div>
              </div>
            ) : <p className="text-warning-600 text-sm">لا يوجد عداد نشط لهذا المشترك</p>;
          })()}
          <div>
            <label className="label-field">القراءة الحالية *</label>
            <input type="number" className="input-field text-lg font-semibold" value={form.current_reading || ''} onChange={(e) => setForm({ ...form, current_reading: e.target.value })} placeholder="القراءة الجديدة" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">بداية الفترة</label>
              <input type="date" className="input-field" value={form.period_start || ''} onChange={(e) => setForm({ ...form, period_start: e.target.value })} />
            </div>
            <div>
              <label className="label-field">نهاية الفترة</label>
              <input type="date" className="input-field" value={form.period_end || ''} onChange={(e) => setForm({ ...form, period_end: e.target.value })} />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">إلغاء</button>
          <button onClick={handleCreateInvoice} disabled={saving || !form.customer_id || !form.current_reading} className="btn-primary flex-1">
            {saving ? <><Loader2 size={16} className="animate-spin" /> جاري الإنشاء...</> : 'إنشاء الفاتورة'}
          </button>
        </div>
      </Modal>

      {/* Payment Form Modal */}
      <Modal open={showPaymentForm} onClose={() => setShowPaymentForm(false)} title="تسجيل تحصيل" size="md">
        <div className="space-y-4">
          {formError && <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-error-50 text-error-700 text-sm"><AlertCircle size={16} /><span>{formError}</span></div>}
          <div>
            <label className="label-field">الفاتورة *</label>
            <select className="input-field" value={paymentForm.invoice_id || ''} onChange={(e) => {
              const inv = invoices.find(i => i.id === e.target.value);
              setPaymentForm({ ...paymentForm, invoice_id: e.target.value, amount: inv?.balance.toString() || '' });
            }}>
              <option value="">— اختر الفاتورة —</option>
              {invoices.filter(i => i.status !== 'paid').map((inv) => (
                <option key={inv.id} value={inv.id}>{inv.invoice_number} - {inv.customers?.name_ar} - متبقي: {formatCurrency(inv.balance)}</option>
              ))}
            </select>
          </div>
          {paymentForm.invoice_id && (() => {
            const inv = invoices.find(i => i.id === paymentForm.invoice_id);
            return inv ? (
              <div className="bg-neutral-50 rounded-xl p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-neutral-400">الإجمالي</span><span className="font-medium">{formatCurrency(inv.grand_total)}</span></div>
                <div className="flex justify-between"><span className="text-neutral-400">المدفوع</span><span className="font-medium">{formatCurrency(inv.amount_paid)}</span></div>
                <div className="flex justify-between"><span className="text-neutral-400">المتبقي</span><span className="font-bold text-error-700">{formatCurrency(inv.balance)}</span></div>
              </div>
            ) : null;
          })()}
          <div>
            <label className="label-field">المبلغ *</label>
            <input type="number" className="input-field text-lg font-semibold" value={paymentForm.amount || ''} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
          </div>
          <div>
            <label className="label-field">طريقة الدفع</label>
            <select className="input-field" value={paymentForm.payment_method || 'cash'} onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}>
              <option value="cash">نقدي</option>
              <option value="wallet">محفظة إلكترونية</option>
              <option value="bank">حوالة بنكية</option>
              <option value="other">أخرى</option>
            </select>
          </div>
          <div>
            <label className="label-field">اسم المحصل</label>
            <input className="input-field" value={paymentForm.collector_name || ''} onChange={(e) => setPaymentForm({ ...paymentForm, collector_name: e.target.value })} placeholder="المحصل" />
          </div>
          <div>
            <label className="label-field">مرجع</label>
            <input className="input-field" value={paymentForm.reference_number || ''} onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })} placeholder="رقم العملية" />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={() => setShowPaymentForm(false)} className="btn-secondary flex-1">إلغاء</button>
          <button onClick={handleRecordPayment} disabled={saving || !paymentForm.invoice_id || !paymentForm.amount} className="btn-primary flex-1">
            {saving ? <><Loader2 size={16} className="animate-spin" /> جاري الحفظ...</> : 'تسجيل التحصيل'}
          </button>
        </div>
      </Modal>

      {/* Tariff Form Modal */}
      <Modal open={showTariffForm} onClose={() => setShowTariffForm(false)} title="إنشاء تعرفة جديدة" size="lg">
        <div className="space-y-4">
          {formError && <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-error-50 text-error-700 text-sm"><AlertCircle size={16} /><span>{formError}</span></div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">اسم التعرفة *</label>
              <input className="input-field" value={tariffForm.name_ar} onChange={(e) => setTariffForm({ ...tariffForm, name_ar: e.target.value })} placeholder="تعرفة سكنية" />
            </div>
            <div>
              <label className="label-field">نوع المشترك</label>
              <select className="input-field" value={tariffForm.customer_type} onChange={(e) => setTariffForm({ ...tariffForm, customer_type: e.target.value })}>
                <option value="residential">منزلي</option>
                <option value="commercial">تجاري</option>
                <option value="government">حكومي</option>
                <option value="school">مدرسة</option>
                <option value="mosque">مسجد</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label-field">الرسوم الثابتة (ر.ي)</label>
            <input type="number" className="input-field" value={tariffForm.fixed_fee} onChange={(e) => setTariffForm({ ...tariffForm, fixed_fee: e.target.value })} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-neutral-700">شرائح الاستهلاك</label>
              <button onClick={() => {
                const lastTier = tariffForm.tiers[tariffForm.tiers.length - 1];
                const nextFrom = lastTier?.to_m3 || '0';
                setTariffForm({ ...tariffForm, tiers: [...tariffForm.tiers, { from_m3: nextFrom, to_m3: '', price_per_m3: '0' }] });
              }} className="text-primary-600 text-sm font-medium">إضافة شريحة</button>
            </div>
            <div className="space-y-2">
              {tariffForm.tiers.map((tier, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                  <input type="number" className="input-field text-sm" placeholder="من م³" value={tier.from_m3} onChange={(e) => { const t = [...tariffForm.tiers]; t[idx] = { ...t[idx], from_m3: e.target.value }; setTariffForm({ ...tariffForm, tiers: t }); }} />
                  <input type="number" className="input-field text-sm" placeholder="إلى م³" value={tier.to_m3} onChange={(e) => { const t = [...tariffForm.tiers]; t[idx] = { ...t[idx], to_m3: e.target.value }; setTariffForm({ ...tariffForm, tiers: t }); }} />
                  <input type="number" className="input-field text-sm" placeholder="ر.ي/م³" value={tier.price_per_m3} onChange={(e) => { const t = [...tariffForm.tiers]; t[idx] = { ...t[idx], price_per_m3: e.target.value }; setTariffForm({ ...tariffForm, tiers: t }); }} />
                  {tariffForm.tiers.length > 1 && (
                    <button onClick={() => setTariffForm({ ...tariffForm, tiers: tariffForm.tiers.filter((_, i) => i !== idx) })} className="text-error-500 hover:text-error-700 p-1">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={() => setShowTariffForm(false)} className="btn-secondary flex-1">إلغاء</button>
          <button onClick={handleSaveTariff} disabled={saving || !tariffForm.name_ar} className="btn-primary flex-1">
            {saving ? <><Loader2 size={16} className="animate-spin" /> جاري الحفظ...</> : 'حفظ التعرفة'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
