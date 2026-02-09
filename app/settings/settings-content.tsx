'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, AlertCircle, CheckCircle } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import CompactNavbar from '@/components/CompactNavbar';
import LoadingScreen from '@/components/LoadingScreen';
import Footer from '@/components/Footer';

export default function SettingsContent() {
  const router = useRouter();
  const supabase = createClient();

  const [displayName, setDisplayName] = useState('');
  const [numQuestions, setNumQuestions] = useState(10);
  const [enableHintButton, setEnableHintButton] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          // Fetch user stats
          const response = await fetch('/api/userStats');
          if (response.ok) {
            const data = await response.json();
            setDisplayName(data.user.display_name || data.user.username || '');
          }

          // Load number of questions from localStorage
          const savedNumQuestions = localStorage.getItem('reviewModeNumQuestions');
          if (savedNumQuestions) {
            setNumQuestions(parseInt(savedNumQuestions, 10));
          }

          // Load hint button setting from localStorage
          const savedEnableHintButton = localStorage.getItem('enableHintButton');
          if (savedEnableHintButton) {
            setEnableHintButton(JSON.parse(savedEnableHintButton));
          }
        } else {
          router.push('/login');
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        setMessage({ type: 'error', text: 'Failed to load settings' });
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [supabase.auth, router]);

  const handleSaveDisplayName = async () => {
    if (!displayName.trim()) {
      setMessage({ type: 'error', text: 'Display name cannot be empty' });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/updateDisplayName', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName.trim() }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Display name updated successfully!' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to update display name' });
      }
    } catch (error) {
      console.error('Error updating display name:', error);
      setMessage({ type: 'error', text: 'Failed to update display name' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNumQuestions = async () => {
    if (numQuestions < 1 || numQuestions > 200) {
      setMessage({ type: 'error', text: 'Number of questions must be between 1 and 200' });
      return;
    }

    try {
      localStorage.setItem('reviewModeNumQuestions', numQuestions.toString());
      setMessage({ type: 'success', text: 'Number of questions updated successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    }
  };

  const handleToggleHintButton = () => {
    const newValue = !enableHintButton;
    setEnableHintButton(newValue);
    try {
      localStorage.setItem('enableHintButton', JSON.stringify(newValue));
      setMessage({ 
        type: 'success', 
        text: newValue ? 'Hint button enabled!' : 'Hint button disabled!' 
      });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving hint button setting:', error);
      setMessage({ type: 'error', text: 'Failed to save setting' });
    }
  };

  if (loading) {
    return <LoadingScreen title="Loading your settings" />;
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <CompactNavbar title="Settings" showBackButton={true} />

      {/* Main Content */}
      <div className="flex-1 py-6 px-4 sm:px-6 lg:px-8 mt-14">
        <div className="max-w-2xl mx-auto">
          {/* Message */}
          <AnimatePresence>
            {message && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
                  message.type === 'success'
                    ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                    : 'bg-red-500/10 border border-red-500/20 text-red-400'
                }`}
              >
                {message.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                )}
                <span className="text-body-lg">{message.text}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Settings Cards */}
          <div className="space-y-6">
            {/* Display Name Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-card rounded-2xl p-6 md:p-8 shadow-lg border border-theme"
            >
              <h2 className="text-heading-2 mb-2">Display Name</h2>
              <p className="text-muted-foreground text-body-lg mb-6">
                This is the name that will be displayed in your profile and leaderboards.
              </p>

              <div className="space-y-4">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-background border border-theme text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-yellow transition-all"
                  placeholder="Enter your display name"
                />

                <button
                  onClick={handleSaveDisplayName}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary-yellow text-black rounded-lg font-semibold hover:bg-primary-yellow-hover disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  <Save className="w-5 h-5" />
                  {saving ? 'Saving...' : 'Save Display Name'}
                </button>
              </div>
            </motion.div>

            {/* Number of Questions Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-card rounded-2xl p-6 md:p-8 shadow-lg border border-theme"
            >
              <h2 className="text-heading-2 mb-2">Review Mode Settings</h2>
              <p className="text-muted-foreground text-body-lg mb-6">
                Set the number of questions for each Review Mode session. This setting will apply the next time you start a new game.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-label font-semibold mb-3">
                    Number of Questions Per Game
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="1"
                      max="200"
                      value={numQuestions}
                      onChange={(e) => setNumQuestions(parseInt(e.target.value, 10))}
                      className="flex-1 h-2 bg-theme rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #FCD34D 0%, #FCD34D ${((numQuestions - 1) / 199) * 100}%, var(--color-theme) ${((numQuestions - 1) / 199) * 100}%, var(--color-theme) 100%)`,
                      }}
                    />
                    <div className="text-heading-3 font-bold text-primary-yellow w-16 text-center">
                      {numQuestions}
                    </div>
                  </div>

                  <div className="mt-4 text-muted-foreground text-body-sm">
                    <p>Min: 1 | Max: 200</p>
                    <p className="mt-2 text-body-sm">
                      Actual available questions may vary based on your progress.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleSaveNumQuestions}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-secondary-purple text-white rounded-lg font-semibold hover:bg-secondary-purple/80 cursor-pointer transition-colors"
                >
                  <Save className="w-5 h-5" />
                  Save Review Mode Settings
                </button>
              </div>
            </motion.div>

            {/* Hint Button Settings Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-card rounded-2xl p-6 md:p-8 shadow-lg border border-theme"
            >
              <h2 className="text-heading-2 mb-2">Hint Button in Review Mode</h2>
              <p className="text-muted-foreground text-body-lg mb-6">
                Enable or disable the hint button (lightbulb) in Review Mode. When enabled, you can click once per question to reveal the first letter instantly.
              </p>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-background rounded-lg border border-theme">
                  <div>
                    <p className="font-semibold text-foreground">Enable Hint Button</p>
                    <p className="text-muted-foreground text-body-sm">1 click per question to reveal first letter</p>
                  </div>
                  {/* Toggle Switch */}
                  <button
                    onClick={handleToggleHintButton}
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                      enableHintButton ? 'bg-primary-yellow' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                        enableHintButton ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Info Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-secondary-purple/10 rounded-2xl p-6 border border-secondary-purple/30"
            >
              <h3 className="text-heading-3 mb-2 text-secondary-purple">💡 Tip</h3>
              <p className="text-body-lg text-muted-foreground">
                Your settings are saved locally in your browser. If you clear your browser cache, these settings will be reset to default values.
              </p>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}
