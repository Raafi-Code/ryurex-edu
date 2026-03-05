/**
 * Format waktu dalam format MM:SS
 */
export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Hitung accuracy dari game results
 */
export const calculateAccuracy = (totalQuestions: number, correctCount: number): string => {
  if (totalQuestions === 0) return '0';
  return ((correctCount / totalQuestions) * 100).toFixed(0);
};

/**
 * Hitung average time per question
 */
export const calculateAvgTime = (totalTime: number, totalQuestions: number): string => {
  if (totalQuestions === 0) return '0';
  return (totalTime / totalQuestions).toFixed(1);
};

/**
 * Hitung total XP untuk vocab game dan review mode
 * - Benar <= 5 detik: 15 XP
 * - Benar < 10 detik: 10 XP
 * - Benar >= 10 detik: 0 XP
 * - Salah: 0 XP
 */
export const calculateXPGained = (
  results: Array<{ correct: boolean; time_taken?: number }>
): number => {
  return results.reduce((sum, r) => {
    if (!r.correct) return sum; // Wrong: 0 XP
    if (!r.time_taken) return sum; // No time data: 0 XP
    if (r.time_taken <= 5) return sum + 15; // ⚡ Very fast: 15 XP
    if (r.time_taken < 10) return sum + 10; // 🔥 Fast: 10 XP
    return sum; // ⏱️ Slow: 0 XP
  }, 0);
};

/**
 * Fisher-Yates shuffle algorithm untuk randomize array
 */
export const fisherYatesShuffle = <T>(array: T[]): T[] => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

/**
 * Normalize string untuk comparison
 */
export const normalizeString = (str: string): string => {
  return str.toLowerCase().replace(/[.,!?;:'"]/g, '').trim();
};

/**
 * Check apakah user answer benar (vocab/sentence)
 */
export const isAnswerCorrect = (
  userAnswer: string,
  correctAnswer: string,
  synonyms?: string[]
): boolean => {
  const userLower = userAnswer.trim().toLowerCase();
  const correctLower = correctAnswer.toLowerCase();

  // Check exact match
  if (userLower === correctLower) return true;

  // Check synonyms
  if (synonyms && synonyms.length > 0) {
    return synonyms.some(s => s.toLowerCase() === userLower);
  }

  return false;
};
