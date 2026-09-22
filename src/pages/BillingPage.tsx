import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useProject } from '@/context/ProjectContext';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatCard } from '@/components/ui/StatCard';
import { formatNumber, formatCurrency, formatDate, invoiceStatusLabels } from '@/lib/utils';
import { Receipt, Wallet, Plus, TrendingUp, AlertTriangle, CheckCircle, Loader2, Search } from 'lucide-react';
import type { Invoice, Payment, Customer, Meter, Tariff, TariffTier } from '@/types';

type Tab = 'invoices' | 'payments' | 'tariffs';

export function BillingPage() {
  const { currentProject } = useProject();
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
  const [form, setForm] = useState<Record<string, string>>({});
  const [paymentForm, setPaymentForm] = useState<Record<string, string>>({});
  const [tariffForm, setTariffForm] = useState<{ name_ar: string; customer_type: string; fixed_fee: string; tiers: { from_m3: string; to_m3: string; price_per_m3: string }[] }>({
    name_ar: '', customer_type: 'residential', fixed_fee: '500', tiers: [{ from_m3: '0', to_m3: '10', price_per_m3: '100' }]
  });

  useEffect(() => {
    if (!currentProject) return;
    const pid = currentProject.id;
    (async () => {
      const [inv, pay, tar, cus, met] = await Promise.all([
        supabase.from('invoices').select('*, customers(name_ar, customer_number, phone)').eq('project_id', pid).order('issue_date', { ascending: false }),
        supabase.from('payments').select('*, customers(name_ar, customer_number), invoices(invoice_number, grand_total)').eq('project_id', pid).order('payment_date', { ascending: false }),
        supabase.from('tariffs').select('*').eq('project_id', pid).order('effective_from', { ascending: false }),
        supabase.from('customers').select('*').eq('project_id', pid).eq('status', 'active').order('name_ar'),
        supabase.from('meters').select('*').eq('project_id', pid).eq('status', 'active').order('meter_number'),
      ]);
      setInvoices((inv.data as any[]) || []);
      setPayments((pay.data as any[]) || []);
      setTariffs(tar.data as Tariff[] || []);
      setCustomers(cus.data as Customer[] || []);
      setMeters(met.data as Meter[] || []);

      // Fetch tiers for each tariff
      if (tar.data && tar.data.length > 0) {
        const tierResults: Record<string, TariffTier[]> = {};
        await Promise.all(tar.data.map(async (t: any) => {
          const { data: td } = await supabase.from('tariff_tiers').select('*').eq('tariff_id', t.id).order('from_m3');
          tierResults[t.id] = td as TariffTier[] || [];
        }));
        setTiers(tierResults);
      }
    })();
  }, [currentProject]);

  const totalRevenue = invoices.reduce((s, i) => s + Number(i.grand_total), 0);
  const collected = payments.reduce((s, p) => s + Number(p.amount), 0);
  const outstanding = invoices.filter(i => i.status !== 'paid').reduce((s, i) => s + Number(i.balance), 0);

  const filteredInvoices = invoices.filter(i =>
    !search || i.invoice_number.includes(search) || (i.customers?.name_ar || '').includes(search)
  );

  const handleCreateInvoice = async () => {
    if (!currentProject || !form.customer_id) { setSaving(false); return; }
    setSaving(true);
    const pid = currentProject.id;

    const customer = customers.find(c => c.id === form.customer_id);
    const meter = meters.find(m => m.customer_id === form.customer_id);
    if (!customer || !meter) { setSaving(false); return; }

    const prev = Number(meter.last_reading);
    const current = parseFloat(form.current_reading);
    if (isNaN(current) || current < prev) { setSaving(false); return; }

    const consumption = current - prev;
    const tariff = tariffs.find(t => t.customer_type === customer.customer_type && t.is_active);
    const tariffTiers = tariff ? tiers[tariff.id] || [] : [];
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
    const invoiceCount = invoices.length;
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(3, '0')}`;
    const today = new Date();
    const dueDate = new Date(today.getTime() + 15 * 86400000);

    const { data } = await supabase.from('invoices').insert({
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
    const pid = currentProject.id;
    const invoice = invoices.find(i => i.id === paymentForm.invoice_id);
    if (!invoice) { setSaving(false); return; }
    const amount = parseFloat(paymentForm.amount);
    if (isNaN(amount) || amount <= 0) { setSaving(false); return; }

    const receiptNumber = `RCP-${new Date().getFullYear()}-${String(payments.length + 1).padStart(3, '0')}`;

    const { data } = await supabase.from('payments').insert({
      project_id: pid,
      invoice_id: invoice.id,
      customer_id: invoice.customer_id,
      receipt_number: receiptNumber,
      amount: amount,
      payment_method: paymentForm.payment_method || 'cash',
      collector_name: paymentForm.collector_name || null,
      reference_number: paymentForm.reference_number || null,
      notes: paymentForm.notes || null,
    }).select('*, customers(name_ar, customer_number), invoices(invoice_number, grand_total)').single();

    if (data) {
      const newPaid = Number(invoice.amount_paid) + amount;
      const newBalance = Number(invoice.grand_total) - newPaid;
      const newStatus = newBalance <= 0 ? 'paid' : 'partial';
      await supabase.from('invoices').update({
        amount_paid: newPaid,
        balance: newBalance,
        status: newStatus,
      }).eq('id', invoice.id);

      setPayments([data as any, ...payments]);
      setInvoices(invoices.map(inv => inv.id === invoice.id ? {
        ...inv,
        amount_paid: newPaid,
        balance: newBalance,
        status: newStatus,
      } : inv));
      setShowPaymentForm(false);
      setPaymentForm({});
    }
    setSaving(false);
  };

  const handleSaveTariff = async () => {
    if (!currentProject || !tariffForm.name_ar) { setSaving(false); return; }
    setSaving(true);
    const { data: tar } = await supabase.from('tariffs').insert({
      project_id: currentProject.id,
      name_ar: tariffForm.name_ar,
      customer_type: tariffForm.customer_type,
      fixed_fee: parseFloat(tariffForm.fixed_fee) || 0,
      is_active: true,
      version: 1,
    }).select().single();

    if (tar && tariffForm.tiers.length > 0) {
      await supabase.from('tariff_tiers').insert(
        tariffForm.tiers.map(t => ({
          tariff_id: tar.id,
          from_m3: parseFloat(t.from_m3) || 0,
          to_m3: t.to_m3 ? parseFloat(t.to_m3) : null,
          price_per_m3: parseFloat(t.price_per_m3) || 0,
        }))
      );
    }
    setShowTariffForm(false);
    setTariffForm({ name_ar: '', customer_type: 'residential', fixed_fee: '500', tiers: [{ from_m3: '0', to_m3: '10', price_per_m3: '100' }] });
    setSaving(false);
    // Refresh
    window.location.reload();
  };

  if (!currentProject) return <div className="text-center py-20 text-neutral-400">اختر مشروعاً للبدء</div>;

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
        {tab === 'invoices' && <button onClick={() => { setForm({}); setShowForm(true); }} className="btn-primary"><Plus size={18} /> فاتورة جديدة</button>}
        {tab === 'payments' && <button onClick={() => { setPaymentForm({}); setShowPaymentForm(true); }} className="btn-primary"><Plus size={18} /> تسجيل تحصيل</button>}
        {tab === 'tariffs' && <button onClick={() => setShowTariffForm(true)} className="btn-primary"><Plus size={18} /> تعرفة جديدة</button>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="إجمالي الإيرادات" value={formatCurrency(totalRevenue)} icon={Receipt} color="primary" />
        <StatCard title="المحصّل" value={formatCurrency(collected)} icon={CheckCircle} color="success" />
        <StatCard title="المتأخرات" value={formatCurrency(outstanding)} icon={AlertTriangle} color={outstanding > 0 ? 'error' : 'neutral'} />
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
            <div className="card"><EmptyState icon={Receipt} title="لا توجد فواتير" description="أنشئ أول فاتورة لبدء دورة الفوترة" action={{ label: 'فاتورة جديدة', onClick: () => { setForm({}); setShowForm(true); } }} /></div>
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
                        {inv.status !== 'paid' && (
                          <button onClick={() => { setPaymentForm({ invoice_id: inv.id, amount: inv.balance.toString(), payment_method: 'cash' }); setShowPaymentForm(true); }} className="text-primary-600 hover:text-primary-700 text-xs font-medium">
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
          <div className="card"><EmptyState icon={Wallet} title="لا توجد مدفوعات مسجلة" description="سجل أول تحصيل لبدء تتبع الإيرادات" action={{ label: 'تسجيل تحصيل', onClick: () => { setPaymentForm({}); setShowPaymentForm(true); } }} /></div>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-50 transition-smooth">
                    <td className="px-4 py-3 font-medium text-neutral-800">{p.receipt_number}</td>
                    <td className="px-4 py-3 text-neutral-600">{p.customers?.name_ar || '—'}</td>
                    <td className="px-4 py-3 text-neutral-600">{p.invoices?.invoice_number || '—'}</td>
                    <td className="px-4 py-3 font-semibold text-success-700">{formatCurrency(p.amount)}</td>
                    <td className="px-4 py-3 text-neutral-600">{p.payment_method === 'cash' ? 'نقدي' : p.payment_method === 'wallet' ? 'محفظة' : p.payment_method}</td>
                    <td className="px-4 py-3 text-neutral-600">{p.collector_name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-neutral-400">{formatDate(p.payment_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'tariffs' && (
        tariffs.length === 0 ? (
          <div className="card"><EmptyState icon={TrendingUp} title="لا توجد تعريفات" description="أنشئ أول تعرفة لاحتساب الفواتير" action={{ label: 'تعرفة جديدة', onClick: () => setShowTariffForm(true) }} /></div>
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
                    {(tiers[t.id] || []).map((tier, idx) => (
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
              <button onClick={() => setTariffForm({ ...tariffForm, tiers: [...tariffForm.tiers, { from_m3: '0', to_m3: '', price_per_m3: '0' }] })} className="text-primary-600 text-sm font-medium">إضافة شريحة</button>
            </div>
            <div className="space-y-2">
              {tariffForm.tiers.map((tier, idx) => (
                <div key={idx} className="grid grid-cols-3 gap-2">
                  <input type="number" className="input-field text-sm" placeholder="من م³" value={tier.from_m3} onChange={(e) => { const t = [...tariffForm.tiers]; t[idx] = { ...t[idx], from_m3: e.target.value }; setTariffForm({ ...tariffForm, tiers: t }); }} />
                  <input type="number" className="input-field text-sm" placeholder="إلى م³" value={tier.to_m3} onChange={(e) => { const t = [...tariffForm.tiers]; t[idx] = { ...t[idx], to_m3: e.target.value }; setTariffForm({ ...tariffForm, tiers: t }); }} />
                  <input type="number" className="input-field text-sm" placeholder="ر.ي/م³" value={tier.price_per_m3} onChange={(e) => { const t = [...tariffForm.tiers]; t[idx] = { ...t[idx], price_per_m3: e.target.value }; setTariffForm({ ...tariffForm, tiers: t }); }} />
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
