import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface UseQueryResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useQuery<T>(
  table: string,
  filters?: Record<string, string | null>,
  order?: { column: string; ascending?: boolean },
  limit?: number
): UseQueryResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    let query = supabase.from(table).select('*');
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value !== null && value !== undefined) {
          query = query.eq(key, value);
        }
      }
    }
    if (order) {
      query = query.order(order.column, { ascending: order.ascending ?? false });
    }
    if (limit) {
      query = query.limit(limit);
    }
    const { data: result, error: err } = await query;
    if (err) {
      setError(err.message);
      setData([]);
    } else {
      setData((result || []) as T[]);
    }
    setLoading(false);
  }, [table, JSON.stringify(filters), order?.column, order?.ascending, limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export function useMultiQuery<T extends Record<string, unknown[]>>(
  queries: { key: string; table: string; filters?: Record<string, string | null>; order?: { column: string; ascending?: boolean }; limit?: number }[]
) {
  const [data, setData] = useState<T>({} as T);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const results = await Promise.all(
      queries.map(async (q) => {
        let query = supabase.from(q.table).select('*');
        if (q.filters) {
          for (const [key, value] of Object.entries(q.filters)) {
            if (value !== null && value !== undefined) {
              query = query.eq(key, value);
            }
          }
        }
        if (q.order) {
          query = query.order(q.order.column, { ascending: q.order.ascending ?? false });
        }
        if (q.limit) {
          query = query.limit(q.limit);
        }
        const { data: result, error: err } = await query;
        return { key: q.key, data: result || [], error: err?.message || null };
      })
    );
    const obj: Record<string, unknown[]> = {};
    let firstError: string | null = null;
    for (const r of results) {
      obj[r.key] = r.data;
      if (r.error && !firstError) firstError = r.error;
    }
    setData(obj as T);
    setError(firstError);
    setLoading(false);
  }, [JSON.stringify(queries.map(q => ({ k: q.key, t: q.table, f: q.filters, o: q.order?.column, l: q.limit })))]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { data, loading, error, refetch: fetchAll };
}

export function LoadingSpinner({ label = 'جاري التحميل...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-neutral-500">{label}</p>
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="text-center max-w-sm">
        <div className="w-12 h-12 rounded-full bg-error-100 text-error-600 flex items-center justify-center mx-auto mb-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <p className="text-sm text-neutral-700 font-medium mb-1">حدث خطأ أثناء تحميل البيانات</p>
        <p className="text-xs text-neutral-400 mb-4">{message}</p>
        {onRetry && (
          <button onClick={onRetry} className="btn-secondary text-sm">إعادة المحاولة</button>
        )}
      </div>
    </div>
  );
}
