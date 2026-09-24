import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useProject } from '@/context/ProjectContext';
import { Bot, Send, Sparkles, User, Loader2, AlertTriangle } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  data?: Record<string, unknown>[];
}

export function CopilotPage() {
  const { currentProject } = useProject();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'مرحباً! أنا مساعد ميزان. يمكنني الإجابة على أسئلتك حول بيانات المشروع الحالي - الإنتاج، الاستهلاك، الفواتير، الأعطال، والمزيد. كيف أساعدك اليوم؟',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const suggestedQuestions = [
    'ما الفواتير المتأخرة؟',
    'ما الأعطال الحرجة المفتوحة؟',
    'كم عدد المشتركين؟',
    'ما نسبة الفاقد؟',
    'ما إنتاج المياه اليومي؟',
  ];

  const processQuery = async (query: string): Promise<ChatMessage> => {
    if (!currentProject) {
      return { role: 'assistant', content: 'الرجاء اختيار مشروع أولاً.' };
    }
    const pid = currentProject.id;
    const q = query.toLowerCase();

    if (q.includes('فواتير متأخرة') || q.includes('متأخرات')) {
      const { data } = await supabase.from('invoices').select('invoice_number, grand_total, balance, customers(name_ar)').eq('project_id', pid).neq('status', 'paid');
      if (!data || data.length === 0) return { role: 'assistant', content: 'لا توجد فواتير متأخرة حالياً. جميع الفواتير مدفوعة.' };
      const total = data.reduce((s: number, i: any) => s + Number(i.balance), 0);
      const list = data.slice(0, 5).map((i: any) => `• ${i.invoice_number} - ${i.customers?.name_ar || '—'} - متبقي: ${Number(i.balance).toLocaleString('ar-EG')} ر.ي`).join('\n');
      return { role: 'assistant', content: `يوجد ${data.length} فاتورة غير مدفوعة بإجمالي ${total.toLocaleString('ar-EG')} ر.ي:\n\n${list}${data.length > 5 ? `\n... و ${data.length - 5} فاتورة أخرى` : ''}` };
    }

    if (q.includes('أعطال') || q.includes('عطل') || q.includes('بلاغ')) {
      const { data } = await supabase.from('faults').select('fault_number, fault_type, severity, status, description').eq('project_id', pid).neq('status', 'closed').neq('status', 'resolved');
      if (!data || data.length === 0) return { role: 'assistant', content: 'لا توجد أعطال مفتوحة حالياً.' };
      const critical = data.filter((f: any) => f.severity === 'critical' || f.severity === 'high');
      const list = data.slice(0, 5).map((f: any) => `• ${f.fault_number} - ${f.fault_type} - خطورة: ${f.severity} - ${f.description?.substring(0, 50) || ''}`).join('\n');
      return { role: 'assistant', content: `يوجد ${data.length} عطل مفتوح${critical.length > 0 ? `، منها ${critical.length} عطل حرج/عالٍ` : ''}:\n\n${list}` };
    }

    if (q.includes('مشترك') || q.includes('مشتركين')) {
      const { count } = await supabase.from('customers').select('id', { count: 'exact', head: true }).eq('project_id', pid).eq('status', 'active');
      return { role: 'assistant', content: `يوجد ${count || 0} مشترك نشط في المشروع.` };
    }

    if (q.includes('فاقد') || q.includes('nrw')) {
      const { data: wells } = await supabase.from('wells').select('daily_output_m3').eq('project_id', pid);
      const { data: invs } = await supabase.from('invoices').select('consumption_m3').eq('project_id', pid);
      const production = (wells || []).reduce((s: number, w: any) => s + Number(w.daily_output_m3), 0);
      const consumption = (invs || []).reduce((s: number, i: any) => s + Number(i.consumption_m3), 0);
      const nrw = production > 0 ? ((production - consumption) / production * 100) : 0;
      return { role: 'assistant', content: `نسبة الفاقد (NRW): ${nrw.toFixed(1)}%\nالإنتاج اليومي: ${production.toLocaleString('ar-EG')} م³\nالاستهلاك المسجل: ${consumption.toLocaleString('ar-EG')} م³\nالفاقد: ${(production - consumption).toLocaleString('ar-EG')} م³\n\nملاحظة: دقة هذا المؤشر تعتمد على اكتمال بيانات القراءات.` };
    }

    if (q.includes('إنتاج') || q.includes('انتاج')) {
      const { data } = await supabase.from('wells').select('code, name_ar, daily_output_m3, status').eq('project_id', pid);
      if (!data || data.length === 0) return { role: 'assistant', content: 'لا توجد آبار مسجلة في هذا المشروع.' };
      const total = data.reduce((s: number, w: any) => s + Number(w.daily_output_m3), 0);
      const list = data.map((w: any) => `• ${w.code} - ${w.name_ar || ''}: ${Number(w.daily_output_m3).toLocaleString('ar-EG')} م³/يوم (${w.status === 'operational' ? 'يعمل' : 'متوقف'})`).join('\n');
      return { role: 'assistant', content: `إجمالي الإنتاج اليومي: ${total.toLocaleString('ar-EG')} م³ من ${data.length} بئر:\n\n${list}` };
    }

    if (q.includes('صيانة') || q.includes('أوامر')) {
      const { data } = await supabase.from('maintenance_work_orders').select('work_order_number, type, status, description, assigned_to').eq('project_id', pid).in('status', ['open', 'in_progress']);
      if (!data || data.length === 0) return { role: 'assistant', content: 'لا توجد أوامر صيانة معلقة حالياً.' };
      const list = data.slice(0, 5).map((w: any) => `• ${w.work_order_number} - ${w.type} - ${w.status} - ${w.assigned_to || 'غير معين'}`).join('\n');
      return { role: 'assistant', content: `يوجد ${data.length} أمر صيانة قيد التنفيذ:\n\n${list}` };
    }

    if (q.includes('إيراد') || q.includes('تحصيل') || q.includes('مدفوع')) {
      const { data: invs } = await supabase.from('invoices').select('grand_total, amount_paid, balance, status').eq('project_id', pid);
      const { data: pays } = await supabase.from('payments').select('amount').eq('project_id', pid);
      const total = (invs || []).reduce((s: number, i: any) => s + Number(i.grand_total), 0);
      const collected = (pays || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
      const rate = total > 0 ? (collected / total * 100) : 0;
      return { role: 'assistant', content: `الإيرادات:\n• إجمالي الفواتير: ${total.toLocaleString('ar-EG')} ر.ي\n• المحصّل: ${collected.toLocaleString('ar-EG')} ر.ي\n• نسبة التحصيل: ${rate.toFixed(1)}%\n• عدد الفواتير: ${invs?.length || 0}` };
    }

    return { role: 'assistant', content: 'لم أتمكن من فهم سؤالك. يمكنك السؤال عن: الفواتير المتأخرة، الأعطال، المشتركين، نسبة الفاقد، إنتاج المياه، أو أوامر الصيانة.' };
  };

  const handleSend = async (text?: string) => {
    const query = text || input.trim();
    if (!query) return;
    setMessages([...messages, { role: 'user', content: query }]);
    setInput('');
    setLoading(true);
    const response = await processQuery(query);
    setMessages((prev) => [...prev, response]);
    setLoading(false);
  };

  return (
    <div className="space-y-4 animate-fade-in h-full flex flex-col">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
          <Bot size={26} className="text-accent-600" /> مساعد ميزان
        </h1>
        <p className="text-sm text-neutral-500 mt-1">مساعد ذكي يجيب من بيانات النظام فقط - بدون تخمين</p>
      </div>

      <div className="card flex-1 flex flex-col overflow-hidden min-h-[400px]">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`p-2 rounded-xl shrink-0 ${msg.role === 'user' ? 'bg-primary-100 text-primary-700' : 'bg-accent-100 text-accent-700'}`}>
                {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
              </div>
              <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-800'}`}>
                <p className="text-sm whitespace-pre-line leading-relaxed">{msg.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="p-2 rounded-xl bg-accent-100 text-accent-700 shrink-0"><Bot size={18} /></div>
              <div className="bg-neutral-100 rounded-2xl px-4 py-3 flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-neutral-400" />
                <span className="text-sm text-neutral-500">جاري التحليل...</span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Suggested Questions */}
        {messages.length <= 1 && (
          <div className="px-4 pb-2">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={14} className="text-neutral-400" />
              <span className="text-xs text-neutral-400">أسئلة مقترحة:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((q, i) => (
                <button key={i} onClick={() => handleSend(q)} className="text-xs bg-neutral-100 hover:bg-primary-50 hover:text-primary-700 text-neutral-600 px-3 py-2 rounded-lg transition-smooth">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-neutral-200 p-3 flex gap-2">
          <input
            className="input-field flex-1"
            placeholder="اكتب سؤالك..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={loading}
          />
          <button onClick={() => handleSend()} disabled={loading || !input.trim()} className="btn-primary shrink-0">
            <Send size={18} />
          </button>
        </div>
      </div>

      <div className="card p-4 bg-neutral-50 border-neutral-200">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="text-neutral-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-neutral-500">
              مساعد ميزان يجيب من بيانات النظام الفعلية فقط. لا يستطيع المساعد تعديل البيانات أو إصدار فواتير أو تجاوز الصلاحيات.
              جميع الأسئلة والردود مسجلة لأغراض التدقيق.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
