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

    const { data: aiResult, error: aiError } = await supabase.functions.invoke('mizan-copilot', {
      body: { project_id: currentProject.id, question: query },
    });

    if (!aiError && aiResult?.answer) {
      return { role: 'assistant', content: aiResult.answer };
    }

    console.error('MIZAN Copilot request failed:', aiError);
    return {
      role: 'assistant',
      content: 'تعذر الوصول إلى مساعد ميزان الخادمي. لم يتم استخدام بديل يحسب المؤشرات محلياً حتى لا تظهر بيانات متعارضة مع مصادر الحقيقة التشغيلية.',
    };
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
              الاستجابات التحليلية تمر عبر خدمة خادمية مقيدة بالمشروع، وأي قرار أو تغيير يبقى تحت صلاحيات المستخدم ولا ينفذه المساعد تلقائياً.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
