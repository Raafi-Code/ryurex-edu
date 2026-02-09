'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Loader } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import ThemeToggle from '@/components/ThemeToggle';

interface LobbyPreview {
  game_code: string;
  category: string;
  subcategory: number;
  num_questions: number;
  timer_duration: number;
  game_mode: string;
  host_user_id: string;
  host_display_name?: string;
  status: string;
}

export default function JoinGamePage() {
  const router = useRouter();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [gameCode, setGameCode] = useState('');
  const [lobbyPreview, setLobbyPreview] = useState<LobbyPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fetching, setFetching] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const supabase = createClient();

  // Fetch user on mount
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
        setPageLoading(false);
      }
    };

    fetchUser();

    return () => {
      isMounted = false;
    };
  }, [router, supabase.auth]);

  // Format game code to uppercase as user types
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    // Only allow alphanumeric characters
    const formatted = value.replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setGameCode(formatted);
    setError('');
    setLobbyPreview(null);
  };

  // Fetch lobby preview when code is complete
  useEffect(() => {
    if (gameCode.length === 6) {
      fetchLobbyPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameCode]);

  const fetchLobbyPreview = async () => {
    if (!gameCode || gameCode.length !== 6) return;

    setFetching(true);
    setError('');

    try {
      // First, get the lobby data
      const { data: lobby, error: fetchError } = await supabase
        .from('pvp_lobbies')
        .select('*')
        .eq('game_code', gameCode)
        .single();

      if (fetchError || !lobby) {
        setError('Lobby tidak ditemukan');
        setLobbyPreview(null);
        setFetching(false);
        return;
      }

      // Check if lobby status is waiting
      if (lobby.status !== 'waiting') {
        setError('Lobby sudah tutup atau sedang berlangsung');
        setLobbyPreview(null);
        setFetching(false);
        return;
      }

      // Check if lobby is expired (more than 5 minutes old)
      const createdAt = new Date(lobby.created_at);
      const now = new Date();
      const diffMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);

      if (diffMinutes > 5) {
        setError('Lobby sudah berakhir');
        setLobbyPreview(null);
        setFetching(false);
        return;
      }

      // Check if user is already in a lobby
      if (lobby.host_user_id === user?.id) {
        setError('Anda adalah host lobby ini');
        setLobbyPreview(null);
        setFetching(false);
        return;
      }

      // Check if lobby already has 2 players
      if (lobby.joined_user_id && lobby.joined_user_id !== user?.id) {
        setError('Lobby sudah penuh (2 pemain)');
        setLobbyPreview(null);
        setFetching(false);
        return;
      }

      // Get host display name
      const { data: hostData } = await supabase
        .from('users')
        .select('display_name')
        .eq('id', lobby.host_user_id)
        .single();

      // Build preview
      const preview: LobbyPreview = {
        game_code: lobby.game_code,
        category: lobby.category,
        subcategory: lobby.subcategory,
        num_questions: lobby.num_questions,
        timer_duration: lobby.timer_duration,
        game_mode: lobby.game_mode,
        host_user_id: lobby.host_user_id,
        host_display_name: hostData?.display_name || 'Unknown',
        status: lobby.status,
      };

      setLobbyPreview(preview);
      setError('');
    } catch (err) {
      console.error('Error fetching lobby:', err);
      setError('Gagal memuat lobby');
      setLobbyPreview(null);
    } finally {
      setFetching(false);
    }
  };

  const handleJoinLobby = async () => {
    if (!gameCode || !lobbyPreview || !user?.id) {
      setError('Data tidak lengkap');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Verify lobby still exists and is in waiting status
      const { data: lobbyCheck, error: checkError } = await supabase
        .from('pvp_lobbies')
        .select('status, joined_user_id')
        .eq('game_code', gameCode)
        .single();

      if (checkError || !lobbyCheck) {
        console.error('Check error:', checkError);
        setError('Lobby tidak ditemukan lagi');
        setLoading(false);
        return;
      }

      if (lobbyCheck.status !== 'waiting') {
        setError('Lobby sudah tidak tersedia');
        setLoading(false);
        return;
      }

      if (lobbyCheck.joined_user_id && lobbyCheck.joined_user_id !== user.id) {
        setError('Lobby sudah penuh');
        setLoading(false);
        return;
      }

      // Update the lobby with joined_user_id AND change status to opponent_joined
      const { error: updateError } = await supabase
        .from('pvp_lobbies')
        .update({
          joined_user_id: user.id,
          status: 'opponent_joined',
        })
        .eq('game_code', gameCode)
        .eq('status', 'waiting');

      if (updateError) {
        console.error('Update error:', updateError);
        setError('Gagal bergabung dengan lobby: ' + updateError.message);
        setLoading(false);
        return;
      }

      // Redirect to lobby page
      router.push(`/pvp/lobby/${gameCode}`);
    } catch (err) {
      console.error('Error joining lobby:', err);
      setError('Terjadi kesalahan saat bergabung');
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Loader className="animate-spin text-primary-yellow" size={32} />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <div className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/pvp')}
              className="flex items-center gap-2 text-muted-foreground hover:text-primary-yellow transition-colors cursor-pointer"
            >
              <ArrowLeft size={18} />
              Kembali ke PvP Menu
            </button>
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        {/* Main Content */}
        <div className="max-w-md mx-auto">
          {/* Title */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Bergabung dengan Lobby</h1>
            <p className="text-muted-foreground">
              Masukkan kode game untuk bergabung dengan pemain lain
            </p>
          </div>

          {/* Code Input Card */}
          <div className="bg-card border border-border rounded-lg p-6 mb-6">
            <label className="block text-sm font-medium mb-3">Kode Game</label>
            <input
              type="text"
              value={gameCode}
              onChange={handleCodeChange}
              placeholder="Contoh: ABC123"
              maxLength={6}
              className="w-full px-4 py-3 bg-background border border-border rounded-lg text-center text-2xl font-mono font-bold tracking-widest placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-yellow focus:border-transparent transition-all"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {gameCode.length} / 6 karakter
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Lobby Preview Card */}
          {lobbyPreview && !error && (
            <div className="bg-card border border-border rounded-lg p-6 mb-6 space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Host
                </p>
                <p className="font-semibold text-lg">{lobbyPreview.host_display_name}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-background rounded p-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Kategori
                  </p>
                  <p className="font-semibold text-sm">{lobbyPreview.category}</p>
                </div>
                <div className="bg-background rounded p-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Mode
                  </p>
                  <p className="font-semibold text-sm capitalize">
                    {lobbyPreview.game_mode === 'vocab' ? 'Vocabulary' : 'Sentence'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-background rounded p-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Pertanyaan
                  </p>
                  <p className="font-semibold text-sm">{lobbyPreview.num_questions}</p>
                </div>
                <div className="bg-background rounded p-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Waktu/Soal
                  </p>
                  <p className="font-semibold text-sm">{lobbyPreview.timer_duration}s</p>
                </div>
              </div>

              {lobbyPreview.subcategory !== 0 && (
                <div className="bg-background rounded p-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Part
                  </p>
                  <p className="font-semibold text-sm">{lobbyPreview.subcategory}</p>
                </div>
              )}
            </div>
          )}

          {/* Loading State */}
          {fetching && (
            <div className="flex items-center justify-center py-8">
              <Loader className="animate-spin text-primary-yellow" size={24} />
            </div>
          )}

          {/* Join Button */}
          <button
            onClick={handleJoinLobby}
            disabled={!lobbyPreview || loading || fetching || !!error}
            className="w-full py-3 px-4 bg-primary-yellow hover:bg-primary-yellow/90 disabled:bg-muted-foreground disabled:opacity-50 text-black font-semibold rounded-lg transition-all duration-200 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader size={18} className="animate-spin" />
                Bergabung...
              </>
            ) : (
              'Bergabung dengan Lobby'
            )}
          </button>

          {/* Info Text */}
          <p className="text-xs text-muted-foreground text-center mt-4">
            Pastikan Anda memiliki kode game yang benar sebelum bergabung
          </p>
        </div>
      </div>
    </div>
  );
}
