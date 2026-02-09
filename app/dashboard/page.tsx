'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, LogOut, Play, Clock, Search, Settings, Zap, Menu, X, Sword, ChevronDown, Flame, CheckCircle } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import Leaderboard from '@/components/Leaderboard';
import Pagination from '@/components/Pagination';
import ScrollToTopButton from '@/components/ScrollToTopButton';
import Footer from '@/components/Footer';
import LoadingScreen from '@/components/LoadingScreen';
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
}

export default function DashboardPage() {
  const { theme } = useTheme();
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isGameModesExpanded, setIsGameModesExpanded] = useState(false);
  const [isLeaderboardExpanded, setIsLeaderboardExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [screenSize, setScreenSize] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  
  const CATEGORIES_PER_PAGE = useMemo(() => {
    switch (screenSize) {
      case 'mobile':
        return 9; // 3 columns × 3 rows
      case 'tablet':
        return 12; // 4 columns × 3 rows
      case 'desktop':
      default:
        return 14; // 5+ columns × 3 rows
    }
  }, [screenSize]);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Detect screen size
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
      // Get authenticated user
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Fetch user stats from API
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

        // Fetch categories
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
  }, []); // Empty dependency array: fetch only once on mount

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  // Filter categories based on search query
  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-card border-b border-theme">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo/Brand */}
            <Link href="/dashboard" className="flex items-center gap-3 cursor-pointer">
              <Image
                src="/favicon.svg"
                alt="Ryurex Edu Logo"
                width={32}
                height={32}
                className="w-8 h-8"
              />
              <div className="flex flex-col">
                <div className="text-heading-3 text-primary-yellow leading-none">
                  Ryurex
                </div>
                <div className="text-label text-primary-yellow tracking-wide">
                  EDU
                </div>
              </div>
            </Link>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-4">
              <Link href="/settings">
                <button
                  className="flex items-center justify-center w-10 h-10 bg-primary-yellow rounded-lg hover:bg-primary-yellow-hover transition-colors cursor-pointer"
                >
                  <Settings className="w-5 h-5 text-black" />
                </button>
              </Link>
              <ThemeToggle />
              <button
                onClick={handleLogout}
                className="flex items-center justify-center w-10 h-10 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors cursor-pointer"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Menu - Theme Toggle + Menu Button */}
            <div className="md:hidden flex items-center gap-3">
              <ThemeToggle />
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 hover:bg-theme rounded-lg transition-colors cursor-pointer"
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
            className="md:hidden overflow-hidden"
          >
            <div className="px-4 py-4 space-y-3 border-t border-theme">
              <Link href="/settings">
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-label font-medium text-foreground hover:text-primary-yellow transition-colors cursor-pointer rounded-lg hover:bg-theme"
                >
                  <Settings className="w-4 h-4" />
                  <span>Settings</span>
                </button>
              </Link>
              <button
                onClick={() => {
                  handleLogout();
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors text-label font-medium cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </motion.div>
        </div>
      </nav>

      {/* Main Content - Add padding-top untuk navbar fixed */}
      <div className="flex-1 py-6 px-4 sm:px-6 lg:px-8 mt-16">
        <div className="max-w-7xl mx-auto">
          {/* Welcome Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div>
              <h1 className="text-heading-1 mb-2">
                Welcome back, <span className="text-primary-yellow">{displayName || userStats?.user.display_name || 'User'}</span>!
              </h1>
              <p className="text-muted-foreground text-body-lg">
                Ready to train your vocabulary today? Let&apos;s get started! 🚀
              </p>
            </div>
          </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-8">
          {[
            { icon: BookOpen, label: 'Words Learned', value: userStats?.stats.words_learned || 0, iconBg: 'bg-primary-yellow', iconColor: 'text-black' },
            { icon: Clock, label: 'Words Due Today', value: userStats?.stats.words_due_today || 0, iconBg: 'bg-primary-yellow', iconColor: 'text-black' },
            { icon: Zap, label: 'Total XP', value: userStats?.user.xp || 0, iconBg: 'bg-primary-yellow', iconColor: 'text-black' },
            { icon: Flame, label: 'Day Streak', value: userStats?.user.streak || 0, iconBg: 'bg-primary-yellow', iconColor: 'text-black' },
          ].map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              className="bg-card rounded-xl md:rounded-2xl p-3 md:p-6 shadow-lg"
            >
              <div className={`inline-flex items-center justify-center w-10 h-10 md:w-12 md:h-12 ${stat.iconBg} rounded-lg md:rounded-xl mb-2 md:mb-4`}>
                <stat.icon className={`w-5 h-5 md:w-6 md:h-6 ${stat.iconColor}`} />
              </div>
              <div className="text-heading-3 mb-1">{stat.value}</div>
              <div className="text-label text-muted-foreground">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Game Mode Selection - Compact Icon Bar */}
        <div className="mb-8 flex justify-center">
          {/* Card Background Container */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-card rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg"
          >
            {/* Icon Bar + Expand Button - Flex row */}
            <div className="flex justify-center items-center gap-4">
              {/* Icons */}
              <div className="flex gap-4">
                {[
                  { href: '/review-mode', icon: Play, bg: 'bg-primary-yellow', text: 'text-black' },
                  { href: '/pvp', icon: Sword, bg: 'bg-red-500/20', text: 'text-red-500' }
                ].map((mode, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                  >
                    <Link href={mode.href}>
                      <div className={`group relative ${mode.bg} rounded-xl md:rounded-2xl p-3 md:p-4 hover:shadow-lg transition-all cursor-pointer hover:scale-110`}>
                        <mode.icon className={`w-6 h-6 md:w-7 md:h-7 ${mode.text}`} />
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-foreground rounded-md text-label font-semibold text-background whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                          {index === 0 ? 'Review' : 'PvP'} Mode
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>

              {/* Expand/Collapse Button */}
              <motion.button
                onClick={() => setIsGameModesExpanded(!isGameModesExpanded)}
                animate={{ rotate: isGameModesExpanded ? 180 : 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-center justify-center w-10 h-10 rounded-lg border-2 border-primary-yellow/30 hover:border-primary-yellow/60 transition-colors text-primary-yellow hover:bg-primary-yellow/10 flex-shrink-0 cursor-pointer"
              >
                <ChevronDown className="w-5 h-5" />
              </motion.button>
            </div>
          </motion.div>
        </div>

        {/* Expandable Details Section */}
        <AnimatePresence>
          {isGameModesExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 32 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="flex justify-center">
                <div className="space-y-2 md:grid md:grid-cols-2 md:gap-6 md:max-w-4xl">
                {/* Review Mode */}
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <Link href="/review-mode">
                    <div className="group bg-card border-2 border-primary-yellow border-opacity-30 rounded-xl md:rounded-3xl p-3 md:p-8 hover:border-primary-yellow transition-colors cursor-pointer shadow-lg hover:shadow-xl md:min-h-[280px]">
                      <div className="flex md:flex-col gap-3 md:gap-0">
                        <div className="flex-shrink-0">
                          <div className="flex items-center justify-center w-12 h-12 md:w-16 md:h-16 bg-primary-yellow rounded-lg md:rounded-2xl md:mb-4">
                            <Play className="w-6 h-6 md:w-8 md:h-8 text-black" />
                          </div>
                        </div>
                        <div className="flex-1 md:flex-none min-w-0">
                          <h3 className="text-heading-3 mb-1 md:mb-2">Review Mode</h3>
                          <p className="hidden md:block text-body-lg text-muted-foreground mb-3 md:mb-4">
                            Quick daily vocabulary review practice
                          </p>
                          <div className="flex items-center space-x-1.5 md:space-x-2 text-label">
                            <div className="flex-shrink-0 w-5 h-5 md:w-6 md:h-6 bg-primary-yellow rounded-md flex items-center justify-center">
                              <Clock className="w-3 h-3 md:w-4 md:h-4 text-black" />
                            </div>
                            <span className="text-primary-yellow font-semibold truncate">
                              {userStats?.stats.words_due_today || 0} words
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>

                {/* PvP Mode */}
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <Link href="/pvp">
                    <div className="group bg-card border-2 border-red-500 border-opacity-30 rounded-xl md:rounded-3xl p-3 md:p-8 hover:border-red-500 transition-colors cursor-pointer shadow-lg hover:shadow-xl md:min-h-[280px]">
                      <div className="flex md:flex-col gap-3 md:gap-0">
                        <div className="flex-shrink-0">
                          <div className="flex items-center justify-center w-12 h-12 md:w-16 md:h-16 bg-red-500/20 rounded-lg md:rounded-2xl md:mb-4">
                            <Sword className="w-6 h-6 md:w-8 md:h-8 text-red-500" />
                          </div>
                        </div>
                        <div className="flex-1 md:flex-none min-w-0">
                          <h3 className="text-heading-3 mb-1 md:mb-2">PvP Mode</h3>
                          <p className="hidden md:block text-body-lg text-muted-foreground mb-3 md:mb-4">
                            Challenge friends in head-to-head vocabulary battles
                          </p>
                          <div className="flex items-center space-x-1.5 md:space-x-2 text-label">
                            <div className="flex-shrink-0 w-5 h-5 md:w-6 md:h-6 bg-red-500/20 rounded-md flex items-center justify-center">
                              <Sword className="w-3 h-3 md:w-4 md:h-4 text-red-500" />
                            </div>
                            <span className="text-red-500 font-semibold">
                              Competitive
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              </div>
            </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Leaderboard Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-12 mb-12"
        >
          {/* Header with Toggle */}
          <div className="flex justify-center mb-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="bg-card rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg w-full md:max-w-3xl"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-heading-2">Leaderboard</h2>
                <motion.button
                  onClick={() => setIsLeaderboardExpanded(!isLeaderboardExpanded)}
                  animate={{ rotate: isLeaderboardExpanded ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center justify-center w-10 h-10 rounded-lg border-2 border-primary-yellow/30 hover:border-primary-yellow/60 transition-colors text-primary-yellow hover:bg-primary-yellow/10 flex-shrink-0 cursor-pointer"
                >
                  <ChevronDown className="w-5 h-5" />
                </motion.button>
              </div>
            </motion.div>
          </div>

          {/* Expandable Leaderboard Content */}
          <AnimatePresence>
            {isLeaderboardExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 32 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden flex justify-center"
              >
                <div className="w-full md:max-w-3xl">
                  <Leaderboard />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Category Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-12"
        >
          {/* Section Title */}
          <div className="mb-4 md:mb-6">
            <h2 className="text-heading-2 mb-1 md:mb-2">Browse by Category</h2>
            <p className="text-body-lg text-muted-foreground">Choose a category to practice specific vocabulary</p>
          </div>

          {/* Search Bar */}
          <div className="relative mb-4 md:mb-6">
            <Search className="absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1); // Reset to page 1 when searching
              }}
              className="w-full pl-10 md:pl-12 pr-4 py-2 md:py-4 text-body-lg bg-card rounded-xl md:rounded-2xl text-foreground placeholder:text-muted-foreground focus:outline-none transition-colors shadow-lg"
            />
          </div>

          {/* Category Grid */}
          {(() => {
            // Calculate pagination
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
                        transition={{ delay: 0.8 + index * 0.05 }}
                      >
                        <Link href={`/category-menu/${encodeURIComponent(category.name)}`}>
                          <div className="group bg-card rounded-xl hover:border-primary-yellow transition-all cursor-pointer h-full flex flex-col overflow-hidden shadow-lg">
                        {/* Image Container - Full width with rounded top corners */}
                            <div className="relative w-full aspect-square bg-gradient-to-br from-primary-yellow-light to-secondary-purple-light flex items-center justify-center">
                              <Image 
                                src={`/images/categories/${category.name.toLowerCase()}.svg`}
                                alt={category.name}
                                fill
                                className="object-cover"
                                onError={(e) => {
                                  // Fallback to default image if category image doesn't exist
                                  e.currentTarget.src = '/images/categories/default.svg';
                                }}
                        />
                        
                        {/* Completion Badge - Top Right Corner */}
                        {progressPercentage === 100 && (
                          <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                            className="absolute top-2 right-2 bg-green-500 rounded-full p-1 shadow-lg"
                          >
                            <CheckCircle className="w-6 h-6 text-white" />
                          </motion.div>
                        )}
                      </div>
                      
                      {/* Content Section */}
                      <div className="p-2 md:p-2 flex flex-col flex-grow">
                        {/* Category Name */}
                        <h3 className="text-body-sm md:text-heading-3 text-center mb-1 md:mb-2 group-hover:text-primary-yellow transition-colors line-clamp-2">
                          {formatCategoryName(category.name)}
                        </h3>

                        {/* Progress Bar */}
                        <div className="mb-1 md:mb-2 space-y-0.5">
                          <div className="w-full bg-input border border-input rounded-full h-1.5 md:h-2 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${progressPercentage}%` }}
                              transition={{ duration: 0.8, ease: 'easeOut' }}
                              className="h-full bg-primary-yellow"
                            />
                          </div>
                          <p className="text-xs md:text-label text-muted-foreground text-center">
                            {learnedCount}/{totalWords}
                        </p>
                      </div>
                      
                      {/* Play Button */}
                      <button className="w-full py-1 md:py-1.5 text-xs md:text-label bg-primary-yellow text-black rounded-lg font-semibold flex items-center justify-center gap-1 hover:bg-primary-yellow-hover transition-colors group-hover:scale-105 cursor-pointer">
                        <Play className="w-3 h-3 md:w-4 md:h-4" />
                        Play
                      </button>
                    </div>
                  </div>
                </Link>
              </motion.div>
              );
            })}
            </div>

            {/* Pagination Controls */}
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
                <p className="text-muted-foreground text-body-lg">No categories found matching &quot;{searchQuery}&quot;</p>
              </div>
            )}
          </div>
            );
          })()}
        </motion.div>

        </div>
      </div>

      {/* Scroll to Top Button */}
      <ScrollToTopButton />

      {/* Full-width Footer */}
      <Footer />
    </div>
  );
}
