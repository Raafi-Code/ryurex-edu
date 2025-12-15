'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { Trophy, Home, RotateCcw, Target, Clock, CheckCircle2, Zap, TrendingDown } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

interface ResultData {
  hostName: string;
  joinedName: string;
  hostScore: number;
  joinedScore: number;
  winner: 'host' | 'joined' | 'tie';
  hostStats?: {
    correctAnswers: number;
    totalQuestions: number;
    avgTimeMs: number;
    totalTimeMs: number;
    fastestAnswerMs: number;
    slowestAnswerMs: number;
  } | null;
  joinedStats?: {
    correctAnswers: number;
    totalQuestions: number;
    avgTimeMs: number;
    totalTimeMs: number;
    fastestAnswerMs: number;
    slowestAnswerMs: number;
  } | null;
}

export default function PvPResultPage() {
  const router = useRouter();
  const params = useParams();
  const lobbyId = params.lobbyId as string;
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(true);
  const [resultData, setResultData] = useState<ResultData | null>(null);
  const [userRole, setUserRole] = useState<'host' | 'joined' | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [gameCode, setGameCode] = useState<string>('');

  // Fetch result data
  useEffect(() => {
    const fetchResult = async () => {
      try {
        // Get current user
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        if (!authUser) {
          router.push('/login');
          return;
        }

        // Fetch lobby data
        const { data: lobby, error: lobbyError } = await supabase
          .from('pvp_lobbies')
          .select('*')
          .eq('id', lobbyId)
          .single();

        if (lobbyError || !lobby) {
          console.error('Lobby not found:', lobbyError);
          router.push('/pvp');
          return;
        }

        // Store game code for redirect
        setGameCode(lobby.game_code);

        // Determine user role
        const role = authUser.id === lobby.host_user_id ? 'host' : 'joined';
        setUserRole(role);

        // Validate user is in this game
        if (role === 'joined' && authUser.id !== lobby.joined_user_id) {
          console.error('User not in this game');
          router.push('/pvp');
          return;
        }

        // Fetch player names
        const hostId = lobby.host_user_id;
        const joinedId = lobby.joined_user_id;

        // Get host name
        const { data: hostData } = await supabase
          .from('users')
          .select('display_name')
          .eq('id', hostId)
          .single();

        // Get joined name
        let joinedName = 'Unknown';
        if (joinedId) {
          const { data: joinedData } = await supabase
            .from('users')
            .select('display_name')
            .eq('id', joinedId)
            .single();
          joinedName = joinedData?.display_name || 'Unknown';
        }

        // Fetch game stats for both players from lobby table
        let hostStats = null;
        let joinedStats = null;

        // Get host stats from lobby
        if (lobby.host_total_questions > 0) {
          hostStats = {
            correctAnswers: lobby.host_correct_answers,
            totalQuestions: lobby.host_total_questions,
            avgTimeMs: lobby.host_avg_time_per_question_ms,
            totalTimeMs: lobby.host_total_time_ms || 0,
            fastestAnswerMs: lobby.host_fastest_answer_ms || 0,
            slowestAnswerMs: lobby.host_slowest_answer_ms || 0,
          };
        }

        // Get joined stats from lobby
        if (lobby.joined_total_questions > 0) {
          joinedStats = {
            correctAnswers: lobby.joined_correct_answers,
            totalQuestions: lobby.joined_total_questions,
            avgTimeMs: lobby.joined_avg_time_per_question_ms,
            totalTimeMs: lobby.joined_total_time_ms || 0,
            fastestAnswerMs: lobby.joined_fastest_answer_ms || 0,
            slowestAnswerMs: lobby.joined_slowest_answer_ms || 0,
          };
        }

        // Determine winner
        let winner: 'host' | 'joined' | 'tie' = 'tie';
        if (lobby.host_score > lobby.joined_score) {
          winner = 'host';
        } else if (lobby.joined_score > lobby.host_score) {
          winner = 'joined';
        }

        // Update lobby status to finished
        await supabase
          .from('pvp_lobbies')
          .update({ status: 'finished' })
          .eq('id', lobbyId);

        setResultData({
          hostName: hostData?.display_name || 'Host',
          joinedName,
          hostScore: lobby.host_score || 0,
          joinedScore: lobby.joined_score || 0,
          winner,
          hostStats,
          joinedStats,
        });

        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching result:', error);
        router.push('/pvp');
      }
    };

    fetchResult();
  }, [lobbyId, router, supabase]);

  const handlePlayAgain = async () => {
    try {
      setIsResetting(true);

      // Only host calls reset-game API
      if (userRole === 'host') {
        const response = await fetch('/api/pvp/reset-game', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lobbyId }),
        });

        if (!response.ok) {
          throw new Error('Failed to reset game');
        }
      }

      // Both player 1 and player 2 redirect back to lobby page using game code
      router.push(`/pvp/lobby/${gameCode}`);
    } catch (error) {
      console.error('Error resetting game:', error);
      alert('Failed to reset game. Please try again.');
      setIsResetting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="spinner-loading"
            />
          </div>
          <p className="text-text-secondary">Loading results...</p>
        </div>
      </div>
    );
  }

  if (!resultData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-primary text-2xl font-bold mb-2">Results not found</p>
          <button
            onClick={() => router.push('/pvp')}
            className="px-6 py-3 bg-primary-yellow text-black rounded-lg font-semibold hover:scale-105 transition-transform cursor-pointer"
          >
            Back to PvP Menu
          </button>
        </div>
      </div>
    );
  }

  const isUserWinner = 
    (userRole === 'host' && resultData.winner === 'host') ||
    (userRole === 'joined' && resultData.winner === 'joined');
  
  const isDraw = resultData.winner === 'tie';

  return (
    <div className="min-h-screen bg-background">
      {/* Header - Minimalist */}
      <div className="border-b border-text-secondary/10">
        <div className="max-w-full mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex-1" />
          <p className="text-text-secondary text-center text-label flex-1">
            Battle Complete - Final Results
          </p>
          <div className="flex-1 flex justify-end">
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Main Content - Match Style */}
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-8 sm:py-12">
        {/* Score Section - Highlighted with Yellow Background */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-primary-yellow rounded-2xl p-4 sm:p-5 mb-6"
        >
          <div className="flex items-center justify-between gap-3">
            {/* Host Score */}
            <div className="flex-1 text-center">
              <h2 className="text-heading-3 text-black mb-1 truncate font-black">
                {resultData.hostName}
              </h2>
              <div className="text-heading-1 font-black text-black">
                {resultData.hostScore}
              </div>
            </div>

            {/* VS Divider */}
            <div className="flex flex-col items-center gap-1">
              <p className="text-heading-2 font-black text-black">VS</p>
              {/* Result Indicator */}
              <div className="text-label font-bold px-1.5 py-0.5 rounded bg-black/10 text-black text-xs">
                {isDraw ? '🤝 Draw' : ''}
              </div>
            </div>

            {/* Joined Score */}
            <div className="flex-1 text-center">
              <h2 className="text-heading-3 text-black mb-1 truncate font-black">
                {resultData.joinedName}
              </h2>
              <div className="text-heading-1 font-black text-black">
                {resultData.joinedScore}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats Rows - Yellow Theme with Icons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-primary-yellow rounded-2xl overflow-hidden mb-8 space-y-0"
        >
          {/* Accuracy */}
          <div className="px-3 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between gap-1 sm:gap-2">
            <div className="flex-1 flex justify-start">
              <div className={`${
                (resultData.hostStats ? ((resultData.hostStats.correctAnswers / resultData.hostStats.totalQuestions) * 100) : 0) > 
                (resultData.joinedStats ? ((resultData.joinedStats.correctAnswers / resultData.joinedStats.totalQuestions) * 100) : 0)
                  ? 'bg-black/20 rounded px-2 py-1'
                  : ''
              }`}>
                <span className={`text-body-lg font-bold text-black`}>
                  {resultData.hostStats 
                    ? ((resultData.hostStats.correctAnswers / resultData.hostStats.totalQuestions) * 100).toFixed(1)
                    : '0'}%
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <Target className="w-4 sm:w-5 h-4 sm:h-5 text-black" />
              <span className="text-xs sm:text-sm font-semibold text-black">Accuracy</span>
            </div>
            <div className="flex-1 flex justify-end">
              <div className={`${
                (resultData.joinedStats ? ((resultData.joinedStats.correctAnswers / resultData.joinedStats.totalQuestions) * 100) : 0) > 
                (resultData.hostStats ? ((resultData.hostStats.correctAnswers / resultData.hostStats.totalQuestions) * 100) : 0)
                  ? 'bg-black/20 rounded px-2 py-1'
                  : ''
              }`}>
                <span className={`text-body-lg font-bold text-black`}>
                  {resultData.joinedStats
                    ? ((resultData.joinedStats.correctAnswers / resultData.joinedStats.totalQuestions) * 100).toFixed(1)
                    : '0'}%
                </span>
              </div>
            </div>
          </div>

          {/* Avg Time */}
          <div className="px-3 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between gap-1 sm:gap-2">
            <div className="flex-1 flex justify-start">
              <div className={`${
                (resultData.hostStats?.avgTimeMs ?? 0) < (resultData.joinedStats?.avgTimeMs ?? Infinity)
                  ? 'bg-black/20 rounded px-2 py-1'
                  : ''
              }`}>
                <span className={`text-body-lg font-bold text-black`}>
                  {resultData.hostStats?.avgTimeMs 
                    ? (resultData.hostStats.avgTimeMs / 1000).toFixed(1) 
                    : '0'}s
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <Clock className="w-4 sm:w-5 h-4 sm:h-5 text-black" />
              <span className="text-xs sm:text-sm font-semibold text-black">Avg Time</span>
            </div>
            <div className="flex-1 flex justify-end">
              <div className={`${
                (resultData.joinedStats?.avgTimeMs ?? Infinity) < (resultData.hostStats?.avgTimeMs ?? 0)
                  ? 'bg-black/20 rounded px-2 py-1'
                  : ''
              }`}>
                <span className={`text-body-lg font-bold text-black`}>
                  {resultData.joinedStats?.avgTimeMs 
                    ? (resultData.joinedStats.avgTimeMs / 1000).toFixed(1) 
                    : '0'}s
                </span>
              </div>
            </div>
          </div>

          {/* Answered */}
          <div className="px-3 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between gap-1 sm:gap-2">
            <div className="flex-1 flex justify-start">
              <div className={`${
                (resultData.hostStats?.correctAnswers ?? 0) > (resultData.joinedStats?.correctAnswers ?? 0)
                  ? 'bg-black/20 rounded px-2 py-1'
                  : ''
              }`}>
                <span className={`text-body-lg font-bold ${
                  (resultData.hostStats?.correctAnswers ?? 0) > (resultData.joinedStats?.correctAnswers ?? 0)
                    ? 'text-black'
                    : 'text-black'
                }`}>
                  {resultData.hostStats?.correctAnswers ?? 0}/{resultData.hostStats?.totalQuestions ?? 0}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <CheckCircle2 className="w-4 sm:w-5 h-4 sm:h-5 text-black" />
              <span className="text-xs sm:text-sm font-semibold text-black">Answered</span>
            </div>
            <div className="flex-1 flex justify-end">
              <div className={`${
                (resultData.joinedStats?.correctAnswers ?? 0) > (resultData.hostStats?.correctAnswers ?? 0)
                  ? 'bg-black/20 rounded px-2 py-1'
                  : ''
              }`}>
                <span className={`text-body-lg font-bold ${
                  (resultData.joinedStats?.correctAnswers ?? 0) > (resultData.hostStats?.correctAnswers ?? 0)
                    ? 'text-black'
                    : 'text-black'
                }`}>
                  {resultData.joinedStats?.correctAnswers ?? 0}/{resultData.joinedStats?.totalQuestions ?? 0}
                </span>
              </div>
            </div>
          </div>

          {/* Total Time */}
          <div className="px-3 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between gap-1 sm:gap-2">
            <div className="flex-1 flex justify-start">
              <div className={`${
                (resultData.hostStats?.totalTimeMs ?? 0) < (resultData.joinedStats?.totalTimeMs ?? Infinity)
                  ? 'bg-black/20 rounded px-2 py-1'
                  : ''
              }`}>
                <span className={`text-body-lg font-bold text-black`}>
                  {resultData.hostStats?.totalTimeMs 
                    ? (resultData.hostStats.totalTimeMs / 1000).toFixed(1) 
                    : '0'}s
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <Clock className="w-4 sm:w-5 h-4 sm:h-5 text-black" />
              <span className="text-xs sm:text-sm font-semibold text-black">Total Time</span>
            </div>
            <div className="flex-1 flex justify-end">
              <div className={`${
                (resultData.joinedStats?.totalTimeMs ?? Infinity) < (resultData.hostStats?.totalTimeMs ?? 0)
                  ? 'bg-black/20 rounded px-2 py-1'
                  : ''
              }`}>
                <span className={`text-body-lg font-bold text-black`}>
                  {resultData.joinedStats?.totalTimeMs 
                    ? (resultData.joinedStats.totalTimeMs / 1000).toFixed(1) 
                    : '0'}s
                </span>
              </div>
            </div>
          </div>

          {/* Fastest Answer */}
          <div className="px-3 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between gap-1 sm:gap-2">
            <div className="flex-1 flex justify-start">
              <div className={`${
                (resultData.hostStats?.fastestAnswerMs ?? Infinity) < (resultData.joinedStats?.fastestAnswerMs ?? Infinity)
                  ? 'bg-black/20 rounded px-2 py-1'
                  : ''
              }`}>
                <span className={`text-body-lg font-bold text-black`}>
                  {resultData.hostStats?.fastestAnswerMs 
                    ? (resultData.hostStats.fastestAnswerMs / 1000).toFixed(2) 
                    : '0'}s
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <Zap className="w-4 sm:w-5 h-4 sm:h-5 text-black" />
              <span className="text-xs sm:text-sm font-semibold text-black">Fastest</span>
            </div>
            <div className="flex-1 flex justify-end">
              <div className={`${
                (resultData.joinedStats?.fastestAnswerMs ?? Infinity) < (resultData.hostStats?.fastestAnswerMs ?? Infinity)
                  ? 'bg-black/20 rounded px-2 py-1'
                  : ''
              }`}>
                <span className={`text-body-lg font-bold text-black`}>
                  {resultData.joinedStats?.fastestAnswerMs 
                    ? (resultData.joinedStats.fastestAnswerMs / 1000).toFixed(2) 
                    : '0'}s
                </span>
              </div>
            </div>
          </div>

          {/* Slowest Answer */}
          <div className="px-3 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between gap-1 sm:gap-2">
            <div className="flex-1 flex justify-start">
              <div className={`${
                (resultData.hostStats?.slowestAnswerMs ?? 0) < (resultData.joinedStats?.slowestAnswerMs ?? Infinity)
                  ? 'bg-black/20 rounded px-2 py-1'
                  : ''
              }`}>
                <span className={`text-body-lg font-bold text-black`}>
                  {resultData.hostStats?.slowestAnswerMs 
                    ? (resultData.hostStats.slowestAnswerMs / 1000).toFixed(2) 
                    : '0'}s
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <TrendingDown className="w-4 sm:w-5 h-4 sm:h-5 text-black" />
              <span className="text-xs sm:text-sm font-semibold text-black">Slowest</span>
            </div>
            <div className="flex-1 flex justify-end">
              <div className={`${
                (resultData.joinedStats?.slowestAnswerMs ?? Infinity) < (resultData.hostStats?.slowestAnswerMs ?? 0)
                  ? 'bg-black/20 rounded px-2 py-1'
                  : ''
              }`}>
                <span className={`text-body-lg font-bold text-black`}>
                  {resultData.joinedStats?.slowestAnswerMs 
                    ? (resultData.joinedStats.slowestAnswerMs / 1000).toFixed(2) 
                    : '0'}s
                </span>
              </div>
            </div>
          </div>

          {/* Result Status - Full Width Bottom */}
          <div className={`w-full px-4 sm:px-6 py-4 text-center font-black text-heading-3 ${
            isDraw 
              ? 'bg-black/10 text-black' 
              : isUserWinner 
                ? 'bg-green-600 text-white' 
                : 'bg-red-600 text-white'
          }`}>
            {isDraw ? 'Draw' : isUserWinner ? 'Win' : 'Lose'}
          </div>
        </motion.div>

        {/* Divider Line */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.2 }}
          className="h-0.5 bg-gradient-to-r from-text-secondary/20 via-primary-yellow to-text-secondary/20 mb-8 origin-center"
        />

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center"
        >
          {/* Play Again */}
          <button
            onClick={handlePlayAgain}
            disabled={isResetting}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-secondary-purple text-white rounded-xl sm:rounded-2xl font-bold text-body-lg hover:bg-secondary-purple/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <RotateCcw className="w-5 h-5" />
            {isResetting ? 'Resetting...' : 'Play Again'}
          </button>

          {/* Back to Menu */}
          <button
            onClick={() => router.push('/pvp')}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-primary-yellow text-black rounded-xl sm:rounded-2xl font-bold text-body-lg hover:bg-primary-yellow-hover transition-all cursor-pointer"
          >
            <Home className="w-5 h-5" />
            Back to Menu
          </button>
        </motion.div>
      </div>
    </div>
  );
}
