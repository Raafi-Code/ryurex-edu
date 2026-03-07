'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, LogOut } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import ThemeToggle from '@/components/ThemeToggle';

interface CompactNavbarProps {
  title?: string;
  showBackButton?: boolean;
}

export default function CompactNavbar({ title, showBackButton = true }: CompactNavbarProps) {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-theme">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          {/* Left side - Back button and title */}
          <div className="flex items-center gap-3">
            {showBackButton && (
              <button
                onClick={() => router.push('/dashboard')}
                className="p-1.5 hover:bg-background/50 rounded-lg transition-colors cursor-pointer"
                aria-label="Go back to dashboard"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            {title && (
              <h1 className="text-sm font-semibold text-text-primary truncate">
                {title}
              </h1>
            )}
          </div>

          {/* Right side - Theme toggle and logout */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
              aria-label="Logout"
            >
              <LogOut className="w-5 h-5 text-red-400" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
