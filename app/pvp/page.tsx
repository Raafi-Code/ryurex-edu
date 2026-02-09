'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, LogIn } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import ThemeToggle from '@/components/ThemeToggle';
import Footer from '@/components/Footer';

export default function PvPPage() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let isMounted = true;

    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (isMounted) {
        if (!user) {
          router.push('/login');
        } else {
          setUser(user);
        }
        setLoading(false);
      }
    };

    fetchUser();

    return () => {
      isMounted = false;
    };
  }, [supabase.auth, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-primary text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <div className="border-b border-text-secondary/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Back Button */}
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 text-text-secondary hover:text-primary-yellow hover:font-semibold transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Dashboard</span>
            </button>

            {/* Right Side Actions */}
            <div className="flex items-center space-x-3">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-2">
              <span className="text-red-400">PvP</span> Mode
            </h1>
            <p className="text-muted-foreground text-lg">
              Challenge your friends in real-time competitive vocabulary battles. Answer fast and accurately to win! 🔥
            </p>
          </motion.div>

          {/* PvP Options Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mx-auto">
            {/* Create Lobby Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="h-full"
            >
              <Link href="/pvp/create" className="h-full block">
                {/* Desktop Layout */}
                <div className="hidden md:flex group bg-card border-2 border-primary-yellow border-opacity-30 rounded-3xl p-8 hover:border-primary-yellow transition-all cursor-pointer shadow-lg h-full flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-center w-16 h-16 bg-primary-yellow rounded-2xl mb-6">
                      <Plus className="w-8 h-8 text-black" />
                    </div>
                    <h3 className="text-2xl font-bold mb-3">Create Lobby</h3>
                    <p className="text-muted-foreground mb-6">
                      Start a new game and invite your friends to join. You&apos;ll be the game host.
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-theme border-opacity-50">
                    <span className="text-sm text-primary-yellow font-semibold">Start a Battle →</span>
                  </div>
                </div>

                {/* Mobile Layout */}
                <div className="md:hidden group bg-card border-2 border-primary-yellow border-opacity-30 rounded-2xl p-4 hover:border-primary-yellow transition-all cursor-pointer shadow-lg h-full flex items-center gap-4">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center w-12 h-12 bg-primary-yellow rounded-xl">
                      <Plus className="w-6 h-6 text-black" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-foreground">Create Lobby</h3>
                    <p className="text-xs text-muted-foreground truncate">Start a new battle</p>
                  </div>
                  <div className="flex-shrink-0">
                    <span className="text-sm text-primary-yellow font-semibold">→</span>
                  </div>
                </div>
              </Link>
            </motion.div>

            {/* Join Game Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="h-full"
            >
              <Link href="/pvp/join" className="h-full block">
                {/* Desktop Layout */}
                <div className="hidden md:flex group bg-card border-2 border-secondary-purple border-opacity-30 rounded-3xl p-8 hover:border-secondary-purple transition-all cursor-pointer shadow-lg h-full flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-center w-16 h-16 bg-secondary-purple rounded-2xl mb-6">
                      <LogIn className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold mb-3">Join Game</h3>
                    <p className="text-muted-foreground mb-6">
                      Enter a game code to join an existing battle created by your friends.
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-theme border-opacity-50">
                    <span className="text-sm text-secondary-purple font-semibold">Join a Battle →</span>
                  </div>
                </div>

                {/* Mobile Layout */}
                <div className="md:hidden group bg-card border-2 border-secondary-purple border-opacity-30 rounded-2xl p-4 hover:border-secondary-purple transition-all cursor-pointer shadow-lg h-full flex items-center gap-4">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center w-12 h-12 bg-secondary-purple rounded-xl">
                      <LogIn className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-foreground">Join Game</h3>
                    <p className="text-xs text-muted-foreground truncate">Enter game code</p>
                  </div>
                  <div className="flex-shrink-0">
                    <span className="text-sm text-secondary-purple font-semibold">→</span>
                  </div>
                </div>
              </Link>
            </motion.div>
          </div>

          {/* Info Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-16 p-8 bg-card rounded-2xl border border-theme mx-auto"
          >
            <h2 className="text-2xl font-bold mb-4">How to Play</h2>
            <div className="space-y-3 text-muted-foreground">
              <p>
                ⚡ <span className="font-semibold text-foreground">Speed & Accuracy Matter:</span> Answer vocabulary questions as fast and accurately as possible to earn points.
              </p>
              <p>
                🏆 <span className="font-semibold text-foreground">Compete with Friends:</span> Challenge your friends in real-time and see who knows vocabulary the best.
              </p>
              <p>
                🎮 <span className="font-semibold text-foreground">Pure Fun:</span> This mode is just for fun! Your learning stats won&apos;t be affected by PvP results.
              </p>
              <p>
                💡 <span className="font-semibold text-foreground">Categories:</span> Choose which vocabulary category you want to compete in before starting the game.
              </p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}
