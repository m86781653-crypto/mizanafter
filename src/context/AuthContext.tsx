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

export function AuthProvider({children}:{children:ReactNode}) {
  const [session,setSession]=useState<Session|null>(null);
  const [user,setUser]=useState<User|null>(null);
  const [profile,setProfile]=useState<Profile|null>(null);
  const [loading,setLoading]=useState(true);

  const fetchProfile=async(uid:string,userOverride?:User)=>{
    const currentUser=userOverride ?? user;
    let {data,error}=await supabase.from('profiles').select('*').eq('id',uid).maybeSingle();
    if(error)console.error('Failed to load profile:',error.message);
    if(!data && currentUser?.user_metadata?.onboarding_token){
      const {error:claimError}=await supabase.rpc('mizan_claim_subtenant_user_slot',{p_onboarding_token:currentUser.user_metadata.onboarding_token});
      if(!claimError){
        await supabase.auth.updateUser({data:{onboarding_token:null}});
        const refreshed=await supabase.from('profiles').select('*').eq('id',uid).maybeSingle();
        data=refreshed.data;
      }
    }
    return data as Profile|null;
  };

  const refreshProfile=async()=>{
    if(user)setProfile(await fetchProfile(user.id));
  };

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      setSession(session);
      setUser(session?.user??null);
      if(session?.user){
        (async()=>{
          setProfile(await fetchProfile(session.user.id,session.user));
          setLoading(false);
        })();
      }else setLoading(false);
    });
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,s)=>{
      (async()=>{
        setSession(s);
        setUser(s?.user??null);
        setProfile(s?.user?await fetchProfile(s.user.id,s.user):null);
        setLoading(false);
      })();
    });
    return()=>subscription.unsubscribe();
  },[]);

  const signIn=async(email:string,password:string)=>{
    const {error}=await supabase.auth.signInWithPassword({email,password});
    return {error:error?.message??null};
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
