import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile, UserRole } from '@/types';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email:string,password:string)=>Promise<{error:string|null}>;
  signOut: ()=>Promise<void>;
  refreshProfile: ()=>Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const roleLabels: Record<UserRole,string> = {
  platform_admin:'مدير المنصة',
  central_governance:'حوكمة هيئة مياه الريف',
  project_manager:'مدير المشروع',
  tenant_manager:'دور انتقالي',
  operations_officer:'مسؤول العمليات',
  meter_reader:'قارئ العدادات',
  collection_officer:'المحصل',
  maintenance_officer:'مسؤول الصيانة',
  technician:'فني',
  data_exception_officer:'مسؤول استثناءات البيانات',
  viewer:'عرض فقط',
};

const PROFILE_LOAD_TIMEOUT_MS = 10000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs = PROFILE_LOAD_TIMEOUT_MS): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('PROFILE_LOAD_TIMEOUT')), timeoutMs)),
  ]);
}

export function AuthProvider({children}:{children:ReactNode}) {
  const [session,setSession]=useState<Session|null>(null);
  const [user,setUser]=useState<User|null>(null);
  const [profile,setProfile]=useState<Profile|null>(null);
  const [loading,setLoading]=useState(true);

  const fetchProfile=async(uid:string,userOverride?:User)=>{
    const currentUser=userOverride ?? user;
    try {
      let {data,error}=await withTimeout(
        supabase.from('profiles').select('*').eq('id',uid).maybeSingle(),
      );
      if(error) {
        console.error('Failed to load profile:',error.message);
        return null;
      }
      if(!data && currentUser?.user_metadata?.onboarding_token){
        const {error:claimError}=await withTimeout(
          supabase.rpc('mizan_claim_subtenant_user_slot',{p_onboarding_token:currentUser.user_metadata.onboarding_token}),
        );
        if(!claimError){
          await withTimeout(supabase.auth.updateUser({data:{onboarding_token:null}}));
          const refreshed=await withTimeout(
            supabase.from('profiles').select('*').eq('id',uid).maybeSingle(),
          );
          data=refreshed.data;
        } else {
          console.error('Failed to claim onboarding slot:',claimError.message);
        }
      }
      return data as Profile|null;
    } catch(error) {
      console.error('Profile load failed:',error);
      return null;
    }
  };

  const refreshProfile=async()=>{
    if(user)setProfile(await fetchProfile(user.id));
  };

  useEffect(()=>{
    let mounted=true;

    const loadInitialSession=async()=>{
      try {
        const {data:{session}}=await supabase.auth.getSession();
        if(!mounted)return;
        setSession(session);
        setUser(session?.user??null);
        if(session?.user) setProfile(await fetchProfile(session.user.id,session.user));
      } catch(error) {
        console.error('Initial auth session load failed:',error);
      } finally {
        if(mounted)setLoading(false);
      }
    };

    void loadInitialSession();

    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,s)=>{
      if(!mounted)return;
      // Keep this callback synchronous. Supabase Auth can deadlock when
      // another Supabase request is awaited inside onAuthStateChange.
      setSession(s);
      setUser(s?.user??null);
      if(event === 'SIGNED_OUT') {
        setProfile(null);
        setLoading(false);
      } else if(event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        setLoading(false);
      }
    });

    return()=> {
      mounted=false;
      subscription.unsubscribe();
    };
  },[]);

  const signIn=async(email:string,password:string)=>{
    try {
      const {data,error}=await withTimeout(
        supabase.auth.signInWithPassword({email,password}),
        15000,
      );
      if(error)return {error:error.message};
      if(data.session?.user){
        setSession(data.session);
        setUser(data.session.user);
        const nextProfile=await fetchProfile(data.session.user.id,data.session.user);
        setProfile(nextProfile);
      }
      setLoading(false);
      return {error:null};
    } catch(error) {
      console.error('Sign-in failed:',error);
      setLoading(false);
      return {error:'تعذر إكمال تسجيل الدخول. يرجى المحاولة مرة أخرى.'};
    }
  };

  const signOut=async()=>{
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  return <AuthContext.Provider value={{session,user,profile,loading,signIn,signOut,refreshProfile}}>{children}</AuthContext.Provider>;
}

export function useAuth(){
  const ctx=useContext(AuthContext);
  if(!ctx)throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
