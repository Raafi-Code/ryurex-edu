'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  LogOut,
  Play,
  Clock,
  Search,
  Settings,
  Zap,
  Menu,
  X,
  Sword,
  ChevronDown,
  Flame,
  CheckCircle,
  TrendingUp,
  Cog,
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import Leaderboard from '@/components/Leaderboard';
import Pagination from '@/components/Pagination';
import ScrollToTopButton from '@/components/ScrollToTopButton';
import Footer from '@/components/Footer';
import LoadingScreen from '@/components/LoadingScreen';
import TypewriterText from '@/components/TypewriterText';
import Image from 'next/image';
import { useTheme } from '@/context/ThemeContext';

// Helper function to convert 'a1-oxford' to 'A1 Oxford'
const formatCategoryName = (category: string): string => {
  return category
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

interface UserStats {
  user: {
    id: string;
    username: string;
    email: string;
    xp: number;
    streak: number;
    display_name?: string;
  };
  stats: {
    words_due_today: number;
    sentences_due_today: number;
    words_learned: number;
  };
}

interface Category {
  name: string;
  count: number;
  learned_count: number;
  icon: string;
  image_url?: string | null;
}

export default function DashboardPage() {
  const { theme } = useTheme();
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [screenSize, setScreenSize] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  const CATEGORIES_PER_PAGE = useMemo(() => {
    switch (screenSize) {
      case 'mobile':
        return 9;
      case 'tablet':
        return 12;
      case 'desktop':
      default:
        return 14;
    }
  }, [screenSize]);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setScreenSize('mobile');
      } else if (width < 1024) {
        setScreenSize('tablet');
      } else {
        setScreenSize('desktop');
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        try {
          const response = await fetch('/api/userStats');
          if (response.ok) {
            const data = await response.json();
            if (isMounted) {
              setUserStats(data);
              setDisplayName(data.user.display_name || data.user.username || '');
            }
          }
        } catch (error) {
          console.error('Error fetching user stats:', error);
        }

        try {
          const response = await fetch('/api/categories');
          if (response.ok) {
            const data = await response.json();
            if (isMounted) setCategories(data.categories);
          }
        } catch (error) {
          console.error('Error fetching categories:', error);
        }
      }

      if (isMounted) setLoading(false);
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* ── Navbar ── */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link href="/dashboard" className="flex items-center gap-3 cursor-pointer">
              <Image
                src="/R Icon No BG.png"
                alt="RyuLearn Logo"
                width={32}
                height={32}
                className="w-8 h-8 rounded-sm dark:bg-white/90"
              />
              <span className="text-lg font-bold text-foreground tracking-tight">
                RyuLearn
              </span>
            </Link>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-3">
              <Link href="/settings">
                <button className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary-yellow/10 hover:bg-primary-yellow/20 text-primary-yellow transition-colors cursor-pointer">
                  <Settings className="w-5 h-5" />
                </button>
              </Link>
              <ThemeToggle />
              <button
                onClick={handleLogout}
                className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Menu */}
            <div className="md:hidden flex items-center gap-3">
              <ThemeToggle />
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 hover:bg-muted rounded-lg transition-colors cursor-pointer"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>

          {/* Mobile Dropdown */}
          <motion.div
            initial={false}
            animate={isMobileMenuOpen ? { height: 'auto' } : { height: 0 }}
            transition={{ duration: 0.3 }}
            className="md:hidden overflow-hidden"
          >
            <div className="px-2 py-4 space-y-2 border-t border-border">
              <Link href="/settings">
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-foreground hover:text-primary-yellow rounded-lg hover:bg-muted transition-colors cursor-pointer"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </button>
              </Link>
              <button
                onClick={() => {
                  handleLogout();
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors text-sm font-medium cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </motion.div>
        </div>
      </nav>

      {/* ── Main Content ── */}
      <div className="flex-1 py-6 px-4 sm:px-6 lg:px-8 mt-16">
        <div className="max-w-7xl mx-auto">

          {/* ── Welcome Section ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-heading-1 mb-1">
              Welcome back, <span className="text-primary-yellow">{displayName || userStats?.user.display_name || 'User'}</span>!
            </h1>
            <p className="text-muted-foreground text-body-lg">
              Ready to train your vocabulary today? Let&apos;s get started! 🚀
            </p>
          </motion.div>

          {/* ── Stats Grid ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
            {[
              { icon: BookOpen, label: 'Words Learned', value: userStats?.stats.words_learned || 0, gradient: 'from-primary-yellow/20 to-primary-yellow/5' },
              { icon: Clock, label: 'Words Due Today', value: userStats?.stats.words_due_today || 0, gradient: 'from-secondary-purple/20 to-secondary-purple/5' },
              { icon: Zap, label: 'Total XP', value: userStats?.user.xp || 0, gradient: 'from-primary-yellow/20 to-primary-yellow/5' },
              { icon: Flame, label: 'Day Streak', value: userStats?.user.streak || 0, gradient: 'from-orange-500/20 to-orange-500/5' },
            ].map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + index * 0.08 }}
                className={`group relative bg-card rounded-2xl p-4 md:p-6 shadow-lg border border-border/50 hover:border-primary-yellow/40 hover:scale-[1.02] transition-all duration-300 overflow-hidden`}
              >
                {/* Gradient Glow */}
                <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl`} />

                <div className="relative z-10">
                  <div className="inline-flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-primary-yellow rounded-xl mb-3 md:mb-4">
                    <stat.icon className="w-5 h-5 md:w-6 md:h-6 text-black" />
                  </div>
                  <div className="text-2xl md:text-3xl font-bold mb-1">{stat.value}</div>
                  <div className="text-xs md:text-sm text-muted-foreground font-medium">{stat.label}</div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* ── Game Modes Section ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mb-8"
          >
            <h2 className="text-heading-3 mb-4">Quick Access</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
              {/* Review Mode */}
              <Link href="/game-modes/spaced-repetition">
                <div className="group bg-card border border-border/50 rounded-2xl p-4 md:p-6 hover:border-primary-yellow/60 hover:shadow-[0_0_30px_rgba(254,232,1,0.08)] transition-all duration-300 cursor-pointer h-full">
                  <div className="flex sm:flex-col items-center sm:items-start gap-4 sm:gap-0">
                    <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 md:w-14 md:h-14 bg-primary-yellow rounded-xl sm:mb-4">
                      <Play className="w-6 h-6 md:w-7 md:h-7 text-black" />
                    </div>
                    <div className="flex-1 sm:flex-none min-w-0">
                      <h3 className="text-base md:text-lg font-bold mb-0.5 group-hover:text-primary-yellow transition-colors">
                        Review Mode
                      </h3>
                      <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">
                        Spaced repetition — practice your due words today
                      </p>
                      <div className="flex items-center gap-1.5 mt-2">
                        <div className="w-5 h-5 bg-primary-yellow/20 rounded flex items-center justify-center">
                          <Clock className="w-3 h-3 text-primary-yellow" />
                        </div>
                        <span className="text-xs font-semibold text-primary-yellow">
                          {userStats?.stats.words_due_today || 0} words due
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>

              {/* PvP Mode */}
              <Link href="/pvp">
                <div className="group bg-card border border-border/50 rounded-2xl p-4 md:p-6 hover:border-red-500/60 hover:shadow-[0_0_30px_rgba(239,68,68,0.08)] transition-all duration-300 cursor-pointer h-full">
                  <div className="flex sm:flex-col items-center sm:items-start gap-4 sm:gap-0">
                    <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 md:w-14 md:h-14 bg-red-500/20 rounded-xl sm:mb-4">
                      <Sword className="w-6 h-6 md:w-7 md:h-7 text-red-400" />
                    </div>
                    <div className="flex-1 sm:flex-none min-w-0">
                      <h3 className="text-base md:text-lg font-bold mb-0.5 group-hover:text-red-400 transition-colors">
                        PvP Mode
                      </h3>
                      <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">
                        Head-to-head vocabulary battles with friends
                      </p>
                      <div className="flex items-center gap-1.5 mt-2">
                        <div className="w-5 h-5 bg-red-500/20 rounded flex items-center justify-center">
                          <Sword className="w-3 h-3 text-red-400" />
                        </div>
                        <span className="text-xs font-semibold text-red-400">Competitive</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>

              {/* Progress Stats */}
              <Link href="/progress-stats">
                <div className="group bg-card border border-border/50 rounded-2xl p-4 md:p-6 hover:border-green-500/60 hover:shadow-[0_0_30px_rgba(34,197,94,0.08)] transition-all duration-300 cursor-pointer h-full">
                  <div className="flex sm:flex-col items-center sm:items-start gap-4 sm:gap-0">
                    <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 md:w-14 md:h-14 bg-green-500/20 rounded-xl sm:mb-4">
                      <TrendingUp className="w-6 h-6 md:w-7 md:h-7 text-green-400" />
                    </div>
                    <div className="flex-1 sm:flex-none min-w-0">
                      <h3 className="text-base md:text-lg font-bold mb-0.5 group-hover:text-green-400 transition-colors">
                        Progress Stats
                      </h3>
                      <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">
                        Track your learning progress and analytics
                      </p>
                      <div className="flex items-center gap-1.5 mt-2">
                        <div className="w-5 h-5 bg-green-500/20 rounded flex items-center justify-center">
                          <TrendingUp className="w-3 h-3 text-green-400" />
                        </div>
                        <span className="text-xs font-semibold text-green-400">Analytics</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          </motion.div>

          {/* ── Typewriter Banner ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="relative overflow-hidden rounded-2xl mb-8"
          >
            <div className="relative bg-gradient-to-r from-primary-yellow via-primary-yellow to-primary-yellow-hover py-10 md:py-14 px-6 md:px-12 flex items-center justify-center">
              {/* Left Gear — Desktop */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                className="hidden lg:flex absolute left-6 text-black/15"
              >
                <Cog className="w-14 h-14" />
              </motion.div>

              {/* Center Content */}
              <div className="relative z-10 max-w-3xl">
                <TypewriterText
                  texts={[
                    'Keep learning, keep growing!',
                    'Reach your dream to go abroad!',
                    'Keep Adaptable like MAHORAGA!!!',
                    'Hi I am Rafi, the developer of this website.',
                    "Hi I am Chisato as Rafi's assistant.",
                  ]}
                  speed={80}
                  loopDelay={3000}
                  className="text-2xl md:text-4xl lg:text-5xl font-bold text-black text-center font-mono"
                  cursorVisible={true}
                />
              </div>

              {/* Right Gear — Desktop */}
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                className="hidden lg:flex absolute right-6 text-black/15"
              >
                <Cog className="w-14 h-14" />
              </motion.div>
            </div>
          </motion.div>

          {/* ── Leaderboard Section ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mb-12"
          >
            <h2 className="text-heading-2 mb-4">Leaderboard</h2>
            <div className="bg-card rounded-2xl shadow-lg border border-border/50 overflow-hidden">
              <Leaderboard />
            </div>
          </motion.div>

          {/* ── Category Section ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mb-8"
          >
            <div className="mb-4 md:mb-6">
              <h2 className="text-heading-2 mb-1 md:mb-2">Browse by Category</h2>
              <p className="text-body-lg text-muted-foreground">
                Choose a category to practice specific vocabulary
              </p>
            </div>

            {/* Search Bar */}
            <div className="relative mb-4 md:mb-6">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search categories..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-11 md:pl-12 pr-4 py-3 md:py-4 text-sm md:text-base bg-card/80 backdrop-blur-sm rounded-xl border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary-yellow/50 focus:ring-1 focus:ring-primary-yellow/20 transition-all shadow-lg"
              />
            </div>

            {/* Category Grid */}
            {(() => {
              const totalPages = Math.ceil(filteredCategories.length / CATEGORIES_PER_PAGE);
              const startIdx = (currentPage - 1) * CATEGORIES_PER_PAGE;
              const paginatedCategories = filteredCategories.slice(startIdx, startIdx + CATEGORIES_PER_PAGE);

              return (
                <div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2 md:gap-3">
                    {paginatedCategories.map((category, index) => {
                      const learnedCount = category.learned_count || 0;
                      const totalWords = category.count;
                      const progressPercentage = totalWords > 0 ? (learnedCount / totalWords) * 100 : 0;

                      return (
                        <motion.div
                          key={category.name}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.8 + index * 0.04 }}
                        >
                          <Link href={`/category-menu/${encodeURIComponent(category.name)}`}>
                            <div className="group bg-card border border-border/50 rounded-xl hover:border-primary-yellow/50 hover:shadow-lg transition-all duration-300 cursor-pointer h-full flex flex-col overflow-hidden">
                              {/* Image */}
                              <div className="relative w-full aspect-square bg-gradient-to-br from-primary-yellow/10 to-secondary-purple/10 flex items-center justify-center">
                                <Image
                                  src={category.image_url || `/images/categories/${category.name.toLowerCase()}.svg`}
                                  alt={category.name}
                                  fill
                                  className="object-cover"
                                  onError={(e) => {
                                    e.currentTarget.src = '/images/categories/default.svg';
                                  }}
                                />

                                {/* Completion Badge */}
                                {progressPercentage === 100 && (
                                  <motion.div
                                    initial={{ scale: 0, rotate: -180 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                                    className="absolute top-1.5 right-1.5 bg-green-500 rounded-full p-0.5 shadow-lg"
                                  >
                                    <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-white" />
                                  </motion.div>
                                )}
                              </div>

                              {/* Content */}
                              <div className="p-2 flex flex-col flex-grow">
                                <h3 className="text-xs md:text-sm font-semibold text-center mb-1 group-hover:text-primary-yellow transition-colors line-clamp-2">
                                  {formatCategoryName(category.name)}
                                </h3>

                                {/* Progress Bar */}
                                <div className="mb-1.5 space-y-0.5">
                                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${progressPercentage}%` }}
                                      transition={{ duration: 0.8, ease: 'easeOut' }}
                                      className="h-full bg-primary-yellow rounded-full"
                                    />
                                  </div>
                                  <p className="text-[10px] md:text-xs text-muted-foreground text-center">
                                    {learnedCount}/{totalWords}
                                  </p>
                                </div>

                                {/* Play Button */}
                                <button className="w-full py-1 md:py-1.5 text-[10px] md:text-xs bg-primary-yellow text-black rounded-lg font-semibold flex items-center justify-center gap-1 hover:bg-primary-yellow-hover transition-colors group-hover:scale-105 cursor-pointer">
                                  <Play className="w-3 h-3" />
                                  Play
                                </button>
                              </div>
                            </div>
                          </Link>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex justify-center mt-8">
                      <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                      />
                    </div>
                  )}

                  {/* Empty State */}
                  {filteredCategories.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground text-body-lg">
                        No categories found matching &quot;{searchQuery}&quot;
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}
          </motion.div>
        </div>
      </div>

      {/* Scroll to Top */}
      <ScrollToTopButton />

      {/* Footer */}
      <Footer fullContent={true} />
    </div>
  );
}
