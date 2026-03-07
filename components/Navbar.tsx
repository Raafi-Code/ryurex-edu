'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LogOut, Menu, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import ThemeToggle from '@/components/ThemeToggle';

export default function Navbar() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };

    getUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-xl border-b border-theme">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 cursor-pointer">
            <Image src="/R Icon No BG.png" width={32} height={32} alt="" className="rounded-sm dark:bg-white/90" aria-hidden="true" />
            <span className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">RyuLearn</span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-4">
            <ThemeToggle />
            
            {user ? (
              <>
                <Link href="/dashboard">
                  <button className="flex items-center justify-center h-10 px-4 bg-primary-yellow text-black rounded-lg hover:bg-primary-yellow-hover transition-colors cursor-pointer font-semibold text-sm">
                    Dashboard
                  </button>
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-10 h-10 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors flex items-center justify-center cursor-pointer"
                  aria-label="Logout"
                >
                  <LogOut className="w-5 h-5 text-red-400" />
                </button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <button className="px-4 py-2 text-sm font-medium bg-card-dark border border-theme rounded-lg hover:border-primary-yellow/50 transition-colors cursor-pointer">
                    Login
                  </button>
                </Link>
                <Link href="/signup">
                  <button className="px-6 py-2 text-sm font-medium bg-primary-yellow text-black rounded-lg hover:bg-primary-yellow-hover transition-colors cursor-pointer">
                    Sign Up
                  </button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-3">
            <ThemeToggle />
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 cursor-pointer"
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <motion.div
          initial={false}
          animate={isMobileMenuOpen ? { height: 'auto' } : { height: 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden md:hidden"
        >
          <div className="pb-4 flex flex-col gap-3">
            {user ? (
              <>
                <Link href="/dashboard">
                  <button className="w-full px-4 py-2 text-sm font-medium bg-primary-yellow text-black rounded-lg hover:bg-primary-yellow-hover transition-colors cursor-pointer">
                    Dashboard
                  </button>
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2 text-sm font-medium bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors cursor-pointer"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <button className="w-full px-4 py-2 text-sm font-medium rounded-lg hover:bg-card-dark transition-colors cursor-pointer">
                    Login
                  </button>
                </Link>
                <Link href="/signup">
                  <button className="w-full px-4 py-2 text-sm font-medium bg-primary-yellow text-black rounded-lg hover:bg-primary-yellow-hover transition-colors cursor-pointer">
                    Sign Up
                  </button>
                </Link>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </nav>
  );
}

