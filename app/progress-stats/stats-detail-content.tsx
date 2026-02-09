'use client';

import { useEffect, useState } from 'react';
import { AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BookOpen, Star, PenTool, Target, Flame, Sparkles, TrendingUp, Calendar } from 'lucide-react';
import LoadingScreen from '@/components/LoadingScreen';
import Footer from '@/components/Footer';
import { useTheme } from '@/context/ThemeContext';

interface DailyData {
  day: string;
  words_learned_today: number;
  words_reviewed_today: number;
  correct_answers: number;
  total_answers: number;
  accuracy_percent: number;
  cumulative_total: number;
}

interface UserMetrics {
  total_words_learned: number;
  new_words_today: number;
  studied_today: number;
  total_correct_answers: number;
  total_attempts: number;
  overall_accuracy_percent: number;
  current_streak: number;
  total_categories_learned: number;
  average_fluency: number;
}

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  unit?: string;
  color: string;
}

// Reusable Stat Card Component
function StatCard({ title, value, icon, unit = '', color }: StatCardProps) {
  return (
    <div className={`bg-card rounded-xl p-4 md:p-5 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs md:text-sm text-muted-foreground font-medium mb-1 truncate">{title}</p>
          <p className="text-xl md:text-2xl font-bold text-foreground truncate">
            {value}
            {unit && <span className="text-xs md:text-sm ml-1 text-muted-foreground">{unit}</span>}
          </p>
        </div>
        <div className="flex-shrink-0">{icon}</div>
      </div>
    </div>
  );
}

// Timeframe Filter Button Component
interface TimeframeButtonProps {
  label: string;
  days: number;
  isActive: boolean;
  onClick: () => void;
}

function TimeframeButton({ label, days, isActive, onClick }: TimeframeButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-3 md:px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 whitespace-nowrap shadow-md cursor-pointer ${
        isActive
          ? 'bg-primary-yellow text-black font-semibold border-2 border-primary-yellow'
          : 'bg-card text-foreground border-2 border-primary-yellow/30 hover:border-primary-yellow/60 hover:shadow-lg'
      }`}
    >
      {label}
    </button>
  );
}

export function StatsDetailContent() {
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [metrics, setMetrics] = useState<UserMetrics | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState(7);
  const [chartType, setChartType] = useState<'cumulative' | 'daily' | 'accuracy' | 'reviewed'>('cumulative');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch daily stats
  useEffect(() => {
    async function fetchDailyStats() {
      try {
        const response = await fetch(`/api/userStats/daily?days=${selectedTimeframe}`);
        if (!response.ok) throw new Error('Failed to fetch daily stats');
        
        const result = await response.json();
        if (result.success && result.data) {
          // Format dates for display and reverse order (oldest first)
          const formattedData = result.data
            .map((item: DailyData) => ({
              ...item,
              day: new Date(item.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            }))
            .reverse(); // Reverse so oldest date is on left, newest on right
          setDailyData(formattedData);
        }
      } catch (err) {
        console.error('Error fetching daily stats:', err);
        setError('Failed to load daily statistics');
      }
    }

    fetchDailyStats();
  }, [selectedTimeframe]);

  // Fetch user metrics
  useEffect(() => {
    async function fetchMetrics() {
      try {
        const response = await fetch('/api/userStats/metrics');
        if (!response.ok) throw new Error('Failed to fetch metrics');
        
        const result = await response.json();
        if (result.success && result.data) {
          setMetrics(result.data);
        }
      } catch (err) {
        console.error('Error fetching metrics:', err);
        setError('Failed to load metrics');
      } finally {
        setLoading(false);
      }
    }

    fetchMetrics();
  }, []);

  if (loading) return <LoadingScreen title="Loading your progress statistics" />;

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar Padding */}
      <div className="h-14" />
      
      {/* Main Content */}
      <div className="py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Learning Progress</h1>
            <p className="text-foreground/60">Track your vocabulary learning journey</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-red-500">
              {error}
            </div>
          )}

          {/* Stat Cards Grid */}
          {metrics && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3 md:gap-4 mb-8">
              <StatCard
                title="Total Words Learned"
                value={metrics.total_words_learned}
                icon={<BookOpen className="w-6 h-6 md:w-7 md:h-7 text-blue-500" />}
                color="border-blue-500/30 hover:border-blue-500/60"
              />
              <StatCard
                title="New Words Today"
                value={metrics.new_words_today}
                icon={<Star className="w-6 h-6 md:w-7 md:h-7 text-primary-yellow" />}
                color="border-primary-yellow/30 hover:border-primary-yellow/60"
              />
              <StatCard
                title="Studied Today"
                value={metrics.studied_today}
                icon={<PenTool className="w-6 h-6 md:w-7 md:h-7 text-green-500" />}
                color="border-green-500/30 hover:border-green-500/60"
              />
              <StatCard
                title="Accuracy"
                value={metrics.overall_accuracy_percent?.toFixed(1) || '0'}
                unit="%"
                icon={<Target className="w-6 h-6 md:w-7 md:h-7 text-purple-500" />}
                color="border-purple-500/30 hover:border-purple-500/60"
              />
              <StatCard
                title="Streak"
                value={metrics.current_streak}
                unit="days"
                icon={<Flame className="w-6 h-6 md:w-7 md:h-7 text-orange-500" />}
                color="border-orange-500/30 hover:border-orange-500/60"
              />
              <StatCard
                title="Avg. Fluency"
                value={metrics.average_fluency?.toFixed(1) || '0'}
                unit="/10"
                icon={<Sparkles className="w-6 h-6 md:w-7 md:h-7 text-pink-500" />}
                color="border-pink-500/30 hover:border-pink-500/60"
              />
            </div>
          )}

          {/* Timeframe Filter */}
          <div className="mb-8 flex gap-2 overflow-x-auto pb-2">
            <TimeframeButton
              label="7D"
              days={7}
              isActive={selectedTimeframe === 7}
              onClick={() => setSelectedTimeframe(7)}
            />
            <TimeframeButton
              label="1M"
              days={30}
              isActive={selectedTimeframe === 30}
              onClick={() => setSelectedTimeframe(30)}
            />
            <TimeframeButton
              label="3M"
              days={90}
              isActive={selectedTimeframe === 90}
              onClick={() => setSelectedTimeframe(90)}
            />
            <TimeframeButton
              label="6M"
              days={180}
              isActive={selectedTimeframe === 180}
              onClick={() => setSelectedTimeframe(180)}
            />
            <TimeframeButton
              label="1Y"
              days={365}
              isActive={selectedTimeframe === 365}
              onClick={() => setSelectedTimeframe(365)}
            />
          </div>

          {/* Chart Type Selector */}
          <div className="mb-6 flex gap-2 flex-wrap">
            <button
              onClick={() => setChartType('cumulative')}
              className={`px-3 md:px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 border-2 shadow-md cursor-pointer ${
                chartType === 'cumulative'
                  ? 'bg-primary-yellow text-black font-semibold border-primary-yellow'
                  : 'bg-card text-foreground border-primary-yellow/30 hover:border-primary-yellow/60 hover:shadow-lg'
              }`}
            >
              Cumulative Progress
            </button>
            <button
              onClick={() => setChartType('daily')}
              className={`px-3 md:px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 border-2 shadow-md cursor-pointer ${
                chartType === 'daily'
                  ? 'bg-primary-yellow text-black font-semibold border-primary-yellow'
                  : 'bg-card text-foreground border-primary-yellow/30 hover:border-primary-yellow/60 hover:shadow-lg'
              }`}
            >
              Daily Learning
            </button>
            <button
              onClick={() => setChartType('accuracy')}
              className={`px-3 md:px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 border-2 shadow-md cursor-pointer ${
                chartType === 'accuracy'
                  ? 'bg-primary-yellow text-black font-semibold border-primary-yellow'
                  : 'bg-card text-foreground border-primary-yellow/30 hover:border-primary-yellow/60 hover:shadow-lg'
              }`}
            >
              Daily Accuracy
            </button>
            <button
              onClick={() => setChartType('reviewed')}
              className={`px-3 md:px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 border-2 shadow-md cursor-pointer ${
                chartType === 'reviewed'
                  ? 'bg-primary-yellow text-black font-semibold border-primary-yellow'
                  : 'bg-card text-foreground border-primary-yellow/30 hover:border-primary-yellow/60 hover:shadow-lg'
              }`}
            >
              Daily Reviewed
            </button>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {/* Chart 1: Cumulative Progress or Daily Learning */}
            <div className="bg-card rounded-xl p-4 md:p-6 backdrop-blur-sm shadow-lg transition-all">
              <h3 className="text-lg md:text-xl font-semibold text-foreground mb-4">
                {chartType === 'cumulative' ? 'Cumulative Words Learned' : chartType === 'reviewed' ? 'Daily New Words' : 'Daily New Words'}
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                {chartType === 'cumulative' ? (
                  <AreaChart data={dailyData}>
                    <defs>
                      <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                    <XAxis dataKey="day" stroke="currentColor" style={{ fontSize: '12px' }} />
                    <YAxis stroke="currentColor" style={{ fontSize: '12px' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--card-bg)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        color: 'var(--foreground)',
                        padding: '8px 12px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="cumulative_total"
                      stroke="#f59e0b"
                      fillOpacity={1}
                      fill="url(#colorCumulative)"
                      name="Total Words"
                    />
                  </AreaChart>
                ) : (
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                    <XAxis dataKey="day" stroke="currentColor" style={{ fontSize: '12px' }} />
                    <YAxis stroke="currentColor" style={{ fontSize: '12px' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--card-bg)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        color: 'var(--foreground)',
                        padding: '8px 12px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                      }}
                    />
                    <Bar dataKey="words_learned_today" fill="#f59e0b" name="New Words" />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>

            {/* Chart 2: Accuracy Rate */}
            <div className="bg-card rounded-xl p-4 md:p-6 backdrop-blur-sm shadow-lg transition-all">
              <h3 className="text-lg md:text-xl font-semibold text-foreground mb-4">
                {chartType === 'accuracy' ? 'Daily Accuracy Rate' : chartType === 'reviewed' ? 'Words Reviewed' : 'Words Reviewed'}
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                {chartType === 'accuracy' ? (
                  <LineChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                    <XAxis dataKey="day" stroke="currentColor" style={{ fontSize: '12px' }} />
                    <YAxis stroke="currentColor" style={{ fontSize: '12px' }} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--card-bg)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        color: 'var(--foreground)',
                        padding: '8px 12px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="accuracy_percent"
                      stroke="#10b981"
                      name="Accuracy %"
                      strokeWidth={2}
                      dot={{ fill: '#10b981', r: 4 }}
                    />
                  </LineChart>
                ) : (
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                    <XAxis dataKey="day" stroke="currentColor" style={{ fontSize: '12px' }} />
                    <YAxis stroke="currentColor" style={{ fontSize: '12px' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--card-bg)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        color: 'var(--foreground)',
                        padding: '8px 12px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                      }}
                    />
                    <Bar dataKey="words_reviewed_today" fill="#8b5cf6" name="Reviewed Words" />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Additional Info */}
          <div className="mt-8 bg-card rounded-xl p-4 md:p-6 backdrop-blur-sm shadow-lg transition-all">
            <h3 className="text-lg font-semibold text-foreground mb-4">Summary Statistics</h3>
            {metrics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-3">
                  <Target className="w-5 h-5 text-primary-yellow" />
                  <div>
                    <p className="text-xs md:text-sm text-foreground/70">Total Attempts</p>
                    <p className="text-lg md:text-xl font-bold text-foreground">{metrics.total_attempts}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  <div>
                    <p className="text-xs md:text-sm text-foreground/70">Correct Answers</p>
                    <p className="text-lg md:text-xl font-bold text-foreground">{metrics.total_correct_answers}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Flame className="w-5 h-5 text-orange-400" />
                  <div>
                    <p className="text-xs md:text-sm text-foreground/70">Total Categories</p>
                    <p className="text-lg md:text-xl font-bold text-foreground">{metrics.total_categories_learned}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-purple-400" />
                  <div>
                    <p className="text-xs md:text-sm text-foreground/70">Avg. Fluency</p>
                    <p className="text-lg md:text-xl font-bold text-foreground">{(metrics.average_fluency || 0).toFixed(1)}/10</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}
