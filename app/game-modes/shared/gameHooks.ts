import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Hook untuk mengecek autentikasi user
 * Jika tidak authenticated, redirect ke home
 */
export const useAuthCheck = (supabase: SupabaseClient) => {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/');
      }
    };

    checkAuth();
  }, [router, supabase]);
};

/**
 * Hook untuk load hint settings dari localStorage
 */
export const useHintSettings = () => {
  const getHintSettings = () => {
    if (typeof window === 'undefined') return false;
    const savedEnableHintButton = localStorage.getItem('enableHintButton');
    return savedEnableHintButton ? JSON.parse(savedEnableHintButton) : false;
  };

  return {
    enableHintButton: getHintSettings(),
  };
};
