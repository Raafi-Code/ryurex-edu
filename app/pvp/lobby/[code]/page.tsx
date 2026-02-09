'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Copy, Check, LogOut, Users, Edit2 } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import ThemeToggle from '@/components/ThemeToggle';

interface Category {
  name: string;
  count: number;
  subcategoryCount: number;
  hasSentences: boolean;
}

interface LobbyData {
  id: string;
  game_code: string;
  host_user_id: string;
  joined_user_id: string | null;
  category: string;
  subcategory: number;
  num_questions: number;
  timer_duration: number;
  game_mode: string;
  status: string;
  host_approved: boolean | null;
  player2_ready: boolean;
  created_at: string;
}

interface UserProfile {
  id: string;
  display_name: string;
}

export default function LobbyPage() {
  const router = useRouter();
  const params = useParams();
  const gameCode = params.code as string;

  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [lobbyData, setLobbyData] = useState<LobbyData | null>(null);
  const [hostProfile, setHostProfile] = useState<UserProfile | null>(null);
  const [joinedProfile, setJoinedProfile] = useState<UserProfile | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showApprovalPopup, setShowApprovalPopup] = useState(false);
  const [isKicked, setIsKicked] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editForm, setEditForm] = useState({
    category: '',
    subcategoryMode: 'custom' as 'custom' | 'random',
    subcategory: 1,
    numQuestions: 1,
    timerDuration: 5,
    gameMode: 'vocab' as 'vocab' | 'ai',
  });
  const [maxQuestions, setMaxQuestions] = useState(0);
  const [subcategoryCount, setSubcategoryCount] = useState(0);
  const [sentenceAvailable, setSentenceAvailable] = useState<{ [key: string]: boolean }>({});
  const [touchStartX, setTouchStartX] = useState(0);

  const supabase = createClient();

  // Fetch user
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

    // Fetch categories for edit form
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/categories');
        if (response.ok) {
          const data = await response.json();
          setCategories(data.categories);
          
          const sentenceMap: { [key: string]: boolean } = {};
          for (const cat of data.categories) {
            sentenceMap[cat.name] = cat.hasSentences || false;
          }
          setSentenceAvailable(sentenceMap);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };

    fetchUser();
    fetchCategories();

    return () => {
      isMounted = false;
    };
  }, [supabase.auth, router]);

  // Fetch lobby data
  useEffect(() => {
    if (!user || !gameCode) return;

    let isMounted = true;
    let interval: NodeJS.Timeout | null = null;

    const fetchLobby = async () => {
      try {
        const { data, error } = await supabase
          .from('pvp_lobbies')
          .select('*')
          .eq('game_code', gameCode)
          .single();

        if (error) {
          console.error('Error fetching lobby:', error);
          return;
        }

        if (isMounted && data) {
          const wasStatusWaiting = lobbyData?.status === 'waiting';
          const isNowOpponentJoined = data.status === 'opponent_joined';
          const wasOpponentJoined = lobbyData?.status === 'opponent_joined';
          const isNowInProgress = data.status === 'in_progress';
          
          setLobbyData(data);
          setIsHost(data.host_user_id === user.id);
          setIsJoined(data.joined_user_id === user.id);

          // Initialize edit form with current lobby data
          if (data.host_user_id === user.id && !editForm.category) {
            setEditForm({
              category: data.category,
              subcategoryMode: data.subcategory === 0 ? 'random' : 'custom',
              subcategory: data.subcategory,
              numQuestions: data.num_questions,
              timerDuration: data.timer_duration,
              gameMode: data.game_mode,
            });
          }

          // Detect if game has started - redirect both players to game page
          if (isNowInProgress && (wasOpponentJoined || data.status === 'opponent_joined')) {
            router.push(`/pvp/game/${data.id}`);
            return;
          }

          // Detect if Player 2 was kicked
          if (!isHost && isJoined && !data.joined_user_id) {
            setIsKicked(true);
          }

          // Show approval popup when opponent joins (for host only)
          if (data.host_user_id === user.id && wasStatusWaiting && isNowOpponentJoined) {
            setShowApprovalPopup(true);
          }

          // Fetch user profiles
          const { data: hostData } = await supabase
            .from('users')
            .select('id, display_name')
            .eq('id', data.host_user_id)
            .single();

          if (isMounted && hostData) {
            setHostProfile(hostData);
          }

          if (data.joined_user_id) {
            const { data: joinedData } = await supabase
              .from('users')
              .select('id, display_name')
              .eq('id', data.joined_user_id)
              .single();

            if (isMounted && joinedData) {
              setJoinedProfile(joinedData);
            }
          } else {
            setJoinedProfile(null);
          }
        }
      } catch (error) {
        console.error('Error:', error);
      }
    };

    fetchLobby();

    // Poll every 1 second for faster updates
    interval = setInterval(fetchLobby, 1000);

    return () => {
      isMounted = false;
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, gameCode, supabase, lobbyData?.status]);

  const handleKickedOk = () => {
    router.push('/pvp/join');
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(gameCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAcceptOpponent = async () => {
    if (!lobbyData) return;

    try {
      const { error } = await supabase
        .from('pvp_lobbies')
        .update({
          host_approved: true,
          status: 'opponent_joined',
        })
        .eq('id', lobbyData.id);

      if (error) {
        console.error('Error accepting opponent:', error);
      } else {
        setShowApprovalPopup(false);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleRejectOpponent = async () => {
    if (!lobbyData) return;

    try {
      const { error } = await supabase
        .from('pvp_lobbies')
        .update({
          joined_user_id: null,
          host_approved: null,
          status: 'waiting',
        })
        .eq('id', lobbyData.id);

      if (error) {
        console.error('Error rejecting opponent:', error);
      } else {
        setShowApprovalPopup(false);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleKickPlayer = async () => {
    if (!lobbyData || !isHost || !lobbyData.joined_user_id) return;

    try {
      const { error } = await supabase
        .from('pvp_lobbies')
        .update({
          joined_user_id: null,
          host_approved: false,
          player2_ready: false,
          status: 'waiting',
        })
        .eq('id', lobbyData.id);

      if (error) {
        console.error('Error kicking player:', error);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleReady = async () => {
    if (!lobbyData || !isJoined) return;

    try {
      const { error } = await supabase
        .from('pvp_lobbies')
        .update({
          player2_ready: true,
        })
        .eq('id', lobbyData.id);

      if (error) {
        console.error('Error marking ready:', error);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleStartGame = async () => {
    if (!lobbyData) return;

    try {
      // Call API to generate questions (for AI mode) and start game
      const response = await fetch('/api/pvp/start-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lobbyId: lobbyData.id }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        alert(`Failed to start game: ${errorData.error || 'Unknown error'}`);
        return;
      }

      const data = await response.json();

      // Redirect to game page
      router.push(`/pvp/game/${lobbyData.id}`);
    } catch (error) {
      console.error('❌ Error in handleStartGame:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleLeaveLobby = async () => {
    if (!lobbyData) return;

    try {
      if (isHost) {
        // Host deletes lobby
        const { error } = await supabase
          .from('pvp_lobbies')
          .delete()
          .eq('id', lobbyData.id);

        if (error) console.error('Error deleting lobby:', error);
      } else if (isJoined) {
        // Player 2 leaves
        const { error } = await supabase
          .from('pvp_lobbies')
          .update({
            joined_user_id: null,
            host_approved: null,
            player2_ready: false,
            status: 'waiting',
          })
          .eq('id', lobbyData.id)
          .select()
          .single();

        if (error) console.error('Error leaving lobby:', error);
      }

      router.push('/pvp');
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Edit form handlers
  const handleOpenEditModal = () => {
    if (lobbyData) {
      setEditForm({
        category: lobbyData.category,
        subcategoryMode: lobbyData.subcategory === 0 ? 'random' : 'custom',
        subcategory: lobbyData.subcategory,
        numQuestions: lobbyData.num_questions,
        timerDuration: lobbyData.timer_duration,
        gameMode: (lobbyData.game_mode as 'vocab' | 'ai') || 'vocab',
      });
    }
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
  };

  const handleEditFormChange = (field: string, value: any) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  // Update max questions when category or subcategory mode changes
  useEffect(() => {
    if (!editForm.category) {
      setMaxQuestions(0);
      setSubcategoryCount(0);
      return;
    }

    const selectedCategory = categories.find(c => c.name === editForm.category);
    if (!selectedCategory) {
      setMaxQuestions(0);
      setSubcategoryCount(0);
      return;
    }

    setSubcategoryCount(selectedCategory.subcategoryCount);

    if (editForm.subcategoryMode === 'custom') {
      setMaxQuestions(10);
    } else {
      setMaxQuestions(selectedCategory.count);
    }

    if (editForm.numQuestions > maxQuestions) {
      handleEditFormChange('numQuestions', 1);
    }
  }, [editForm.category, editForm.subcategoryMode, categories, maxQuestions]);

  const handleSaveConfiguration = async () => {
    if (!lobbyData || !isHost) return;

    try {
      const { error } = await supabase
        .from('pvp_lobbies')
        .update({
          category: editForm.category,
          subcategory: editForm.subcategoryMode === 'random' ? 0 : editForm.subcategory,
          num_questions: editForm.numQuestions,
          timer_duration: editForm.timerDuration,
          game_mode: editForm.gameMode,
        })
        .eq('id', lobbyData.id);

      if (error) {
        console.error('Error updating configuration:', error);
      } else {
        setShowEditModal(false);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Swipe handlers for mode switch
  const handleModeSwipeStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleModeSwipeEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    const threshold = 50; // Minimum swipe distance

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        // Swiped left -> go to next option (custom -> random)
        if (editForm.subcategoryMode === 'custom') {
          handleEditFormChange('subcategoryMode', 'random');
        }
      } else {
        // Swiped right -> go to previous option (random -> custom)
        if (editForm.subcategoryMode === 'random') {
          handleEditFormChange('subcategoryMode', 'custom');
        }
      }
    }
  };

  // Swipe handlers for game mode switch
  const handleGameModeSwipeStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleGameModeSwipeEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    const threshold = 50;

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        // Swiped left -> go to AI mode
        if (editForm.gameMode === 'vocab') {
          handleEditFormChange('gameMode', 'ai');
        }
      } else {
        // Swiped right -> go to vocab
        if (editForm.gameMode === 'ai') {
          handleEditFormChange('gameMode', 'vocab');
        }
      }
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-primary text-xl">Loading...</div>
      </div>
    );
  }

  if (!lobbyData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground text-xl">Loading lobby...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <div className="border-b border-text-secondary/10">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/pvp')}
              className="flex items-center gap-2 text-text-secondary hover:text-primary-yellow hover:font-semibold transition-colors cursor-pointer text-body-lg"
            >
              <ArrowLeft className="w-4 sm:w-5 h-4 sm:h-5" />
              <span className="text-sm sm:text-base">Back to PvP</span>
            </button>
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 py-4 sm:py-6 md:py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Kicked Popup */}
          {isKicked && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            >
              <motion.div
                className="bg-card rounded-2xl p-8 border border-theme max-w-md w-full mx-4"
              >
                <h2 className="text-2xl font-bold mb-4 text-red-400">Rejected/Kicked from Lobby</h2>
                <p className="text-muted-foreground mb-6">
                  Host telah mengeluarkan Anda dari lobby.
                </p>
                <button
                  onClick={handleKickedOk}
                  className="w-full py-2 px-4 bg-primary-yellow text-black rounded-lg hover:bg-primary-yellow/90 transition-colors font-semibold cursor-pointer"
                >
                  Kembali
                </button>
              </motion.div>
            </motion.div>
          )}

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 sm:mb-6"
          >
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">
              <span className="text-primary-yellow">Battle</span> Lobby
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              {isHost ? (
                lobbyData?.joined_user_id ? (
                  lobbyData?.player2_ready ? 'Ready to start!' : 'Waiting for opponent to be ready...'
                ) : (
                  'Waiting for opponent to join...'
                )
              ) : (
                lobbyData?.host_approved === true ? (
                  lobbyData?.player2_ready ? 'You are ready!' : 'Click ready to proceed...'
                ) : (
                  'Waiting for host to accept...'
                )
              )}
            </p>
          </motion.div>

          {/* Approval Popup */}
          {showApprovalPopup && isHost && joinedProfile && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
              onClick={() => setShowApprovalPopup(false)}
            >
              <motion.div
                className="bg-card rounded-2xl p-8 border border-theme max-w-md w-full mx-4"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-2xl font-bold mb-4">Accept Opponent?</h2>
                <p className="text-muted-foreground mb-6">
                  <span className="text-foreground font-semibold">{joinedProfile.display_name}</span> wants to join your battle. Accept or reject?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleRejectOpponent}
                    className="flex-1 py-2 px-4 bg-background border border-theme rounded-lg hover:border-primary-yellow transition-colors font-semibold cursor-pointer"
                  >
                    Reject
                  </button>
                  <button
                    onClick={handleAcceptOpponent}
                    className="flex-1 py-2 px-4 bg-primary-yellow text-black rounded-lg hover:bg-primary-yellow-hover transition-colors font-semibold cursor-pointer"
                  >
                    Accept
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Edit Configuration Modal */}
          {showEditModal && isHost && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={handleCloseEditModal}
            >
              <motion.div
                className="bg-card rounded-2xl p-8 border border-theme max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-2xl font-bold mb-6">Edit Battle Configuration</h2>
                
                <div className="space-y-4 mb-6">
                  {/* Category */}
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Category
                    </label>
                    <select
                      value={editForm.category}
                      onChange={(e) => handleEditFormChange('category', e.target.value)}
                      className="w-full px-4 py-2 bg-background border border-theme rounded-lg text-foreground focus:outline-none focus:border-primary-yellow"
                    >
                      <option value="">Select a category</option>
                      {categories.map((cat) => (
                        <option key={cat.name} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Subcategory Mode - Switch Button */}
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-3">
                      Mode
                    </label>
                    <div 
                      className="inline-flex bg-background border border-theme rounded-lg p-1 select-none"
                      onTouchStart={handleModeSwipeStart}
                      onTouchEnd={handleModeSwipeEnd}
                    >
                      {['custom', 'random'].map((mode) => (
                        <button
                          key={mode}
                          onClick={() => handleEditFormChange('subcategoryMode', mode)}
                          className={`px-6 py-2 rounded-md font-semibold text-sm transition-all cursor-pointer ${
                            editForm.subcategoryMode === mode
                              ? 'bg-primary-yellow text-black'
                              : 'text-foreground hover:text-primary-yellow'
                          }`}
                        >
                          {mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Subcategory (if custom mode) */}
                  {editForm.subcategoryMode === 'custom' && (
                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-2">
                        Part
                      </label>
                      <select
                        value={editForm.subcategory}
                        onChange={(e) => handleEditFormChange('subcategory', parseInt(e.target.value))}
                        className="w-full px-4 py-2 bg-background border border-theme rounded-lg text-foreground focus:outline-none focus:border-primary-yellow"
                      >
                        {[1, 2, 3, 4, 5].map((part) => (
                          <option key={part} value={part}>
                            Part {part}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Number of Questions */}
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Number of Questions: {editForm.numQuestions}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max={maxQuestions}
                      value={editForm.numQuestions}
                      onChange={(e) => handleEditFormChange('numQuestions', parseInt(e.target.value))}
                      className="w-full h-2 bg-background rounded-lg appearance-none cursor-pointer accent-primary-yellow"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Max: {maxQuestions}</p>
                  </div>

                  {/* Timer Duration */}
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Time per Question: {editForm.timerDuration}s
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="60"
                      value={editForm.timerDuration}
                      onChange={(e) => handleEditFormChange('timerDuration', parseInt(e.target.value))}
                      className="w-full h-2 bg-background rounded-lg appearance-none cursor-pointer accent-primary-yellow"
                    />
                    <p className="text-xs text-muted-foreground mt-1">5s - 60s</p>
                  </div>

                  {/* Game Mode - Switch Button */}
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-3">
                      Game Type
                    </label>
                    <div 
                      className="relative bg-background rounded-lg border border-theme p-1 flex"
                    >
                      {/* Sliding background */}
                      <div
                        className={`absolute top-1 bottom-1 w-1/2 bg-primary-yellow rounded-md transition-all duration-300 ease-out ${
                          editForm.gameMode === 'ai' ? 'right-1 left-auto' : 'left-1'
                        }`}
                      />
                      
                      {/* Vocab Button */}
                      <button
                        type="button"
                        onClick={() => handleEditFormChange('gameMode', 'vocab')}
                        className={`relative flex-1 py-2 px-4 font-semibold text-sm rounded-md transition-colors duration-300 z-10 cursor-pointer ${
                          editForm.gameMode === 'vocab'
                            ? 'text-black'
                            : 'text-foreground hover:text-primary-yellow'
                        }`}
                      >
                        Vocab
                      </button>

                      {/* AI Mode Button */}
                      <button
                        type="button"
                        onClick={() => handleEditFormChange('gameMode', 'ai')}
                        className={`relative flex-1 py-2 px-4 font-semibold text-sm rounded-md transition-colors duration-300 z-10 cursor-pointer flex items-center justify-center gap-1 ${
                          editForm.gameMode === 'ai'
                            ? 'text-black'
                            : 'text-foreground hover:text-primary-yellow'
                        }`}
                      >
                        <span>Sentence Mode</span>
                        <span className="bg-primary-yellow text-black px-1 py-0.5 rounded text-xs font-bold">AI</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleCloseEditModal}
                    className="flex-1 py-2 px-4 bg-background border border-theme rounded-lg hover:border-primary-yellow transition-colors font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveConfiguration}
                    className="flex-1 py-2 px-4 bg-primary-yellow text-black rounded-lg hover:bg-primary-yellow/90 transition-colors font-semibold cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
            {/* Game Code Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-theme"
            >
              <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Game Code</h2>
              <div className="relative">
                <input
                  type="text"
                  value={gameCode}
                  readOnly
                  className="w-full px-3 sm:px-4 py-2 sm:py-4 bg-primary-yellow text-black text-center text-lg sm:text-2xl font-mono font-bold border border-primary-yellow rounded-lg focus:outline-none"
                />
                <button
                  onClick={handleCopyCode}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 sm:p-2 hover:bg-primary-yellow/80 rounded-lg transition-colors cursor-pointer"
                  title="Copy game code"
                >
                  {copied ? (
                    <Check className="w-4 sm:w-5 h-4 sm:h-5 text-black" />
                  ) : (
                    <Copy className="w-4 sm:w-5 h-4 sm:h-5 text-black" />
                  )}
                </button>
              </div>
            </motion.div>

          </div>

          {/* Players Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-theme mb-6 sm:mb-8"
          >
            <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 flex items-center gap-2">
              <Users className="w-4 sm:w-5 h-4 sm:h-5 text-primary-yellow" />
              Players
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {/* Player 1 (Host) */}
              <div className="bg-primary-yellow rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg text-black">Player 1</h3>
                  <span className="text-xs px-2 py-1 bg-black/10 text-black rounded-full font-semibold">
                    Host
                  </span>
                </div>
                <p className="text-black font-semibold text-xl mb-4">
                  {hostProfile?.display_name || 'Loading...'}
                </p>
                <div className="flex gap-2">
                  {isHost && (
                    <button
                      onClick={handleLeaveLobby}
                      className="flex-1 py-2 px-4 bg-black/10 border border-black/20 text-black rounded-lg hover:bg-black/20 transition-colors font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      Leave
                    </button>
                  )}
                </div>
              </div>

              {/* Player 2 (Joined) */}
              <div className="bg-primary-yellow rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg text-black">Player 2</h3>
                  {joinedProfile && (
                    <>
                      {lobbyData.host_approved === null && (
                        <span className="text-xs px-2 py-1 bg-black/10 text-black rounded-full font-semibold">
                          Pending
                        </span>
                      )}
                      {lobbyData.host_approved === false && (
                        <span className="text-xs px-2 py-1 bg-red-600/20 text-red-700 rounded-full font-semibold">
                          Rejected
                        </span>
                      )}
                      {lobbyData.host_approved === true && (
                        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                          lobbyData.player2_ready
                            ? 'bg-green-600/20 text-green-700'
                            : 'bg-black/10 text-black'
                        }`}>
                          {lobbyData.player2_ready ? 'Ready' : 'Not Ready'}
                        </span>
                      )}
                    </>
                  )}
                </div>
                {joinedProfile ? (
                  <>
                    <p className="text-black font-semibold text-xl mb-4">
                      {joinedProfile.display_name}
                    </p>
                    {lobbyData.host_approved === null && (
                      <p className="text-black/60 text-sm mb-4">
                        Waiting for host approval...
                      </p>
                    )}
                    <div className="flex gap-2">
                      {isHost && joinedProfile && lobbyData.status !== 'in_progress' && (
                        <button
                          onClick={handleKickPlayer}
                          className="flex-1 py-2 px-4 bg-red-600/20 border border-red-600/30 text-red-700 rounded-lg hover:bg-red-600/30 transition-colors font-semibold text-sm cursor-pointer"
                        >
                          Kick
                        </button>
                      )}
                      {isJoined && !lobbyData.player2_ready && lobbyData.host_approved === true && (
                        <button
                          onClick={handleReady}
                          className="flex-1 py-2 px-4 bg-black text-primary-yellow rounded-lg hover:bg-black/90 transition-colors font-semibold text-sm cursor-pointer"
                        >
                          Ready
                        </button>
                      )}
                      {isJoined && (
                        <button
                          onClick={handleLeaveLobby}
                          className="flex-1 py-2 px-4 bg-black/10 border border-black/20 text-black rounded-lg hover:bg-black/20 transition-colors font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <LogOut className="w-4 h-4" />
                          Leave
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-black/60 text-sm">Waiting for opponent to join...</p>
                )}
              </div>
            </div>
          </motion.div>

          {/* Game Config */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-theme mb-6 sm:mb-8"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base sm:text-lg font-bold text-foreground">Battle Configuration</h2>
              {isHost && lobbyData.status !== 'in_progress' && (
                <button
                  onClick={handleOpenEditModal}
                  className="flex items-center gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-primary-yellow/20 text-primary-yellow hover:bg-primary-yellow/30 rounded-lg transition-colors font-semibold text-xs sm:text-sm cursor-pointer"
                  title="Edit Battle Configuration"
                >
                  <Edit2 className="w-3 sm:w-4 h-3 sm:h-4" />
                  Edit
                </button>
              )}
            </div>
            <div className="bg-background rounded-lg p-3 sm:p-4 grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 text-xs sm:text-sm">
              <div>
                <p className="text-muted-foreground">Category</p>
                <p className="font-semibold text-primary-yellow">{lobbyData.category}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Mode</p>
                <p className="font-semibold text-primary-yellow">
                  {lobbyData.subcategory === 0 ? 'Random' : `Part ${lobbyData.subcategory}`}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Questions</p>
                <p className="font-semibold text-primary-yellow">{lobbyData.num_questions}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Time/Q</p>
                <p className="font-semibold text-primary-yellow">{lobbyData.timer_duration}s</p>
              </div>
              <div>
                <p className="text-muted-foreground">Type</p>
                <p className="font-semibold text-secondary-purple capitalize">{lobbyData.game_mode}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <p className="font-semibold text-primary-yellow capitalize">{lobbyData.status}</p>
              </div>
            </div>
          </motion.div>

          {/* Start Game Button */}
          {isHost && joinedProfile && lobbyData.player2_ready && lobbyData.host_approved && lobbyData.status !== 'in_progress' && (
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={handleStartGame}
              className="w-full py-3 sm:py-4 bg-primary-yellow text-black rounded-lg font-bold text-base sm:text-lg hover:bg-primary-yellow-hover transition-colors cursor-pointer"
            >
              Start Battle
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
