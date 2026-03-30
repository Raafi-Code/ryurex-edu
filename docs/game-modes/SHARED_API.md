# Shared Utilities & Components API Reference

Dokumentasi lengkap untuk semua shared utilities dan components di `/app/game-modes/shared/`.

## 📋 Hooks (`gameHooks.ts`)

### `useAuthCheck(supabase)`
Checks authentication status dan redirect jika user belum login.

**Signature:**
```tsx
function useAuthCheck(supabase: SupabaseClient): void
```

**Parameters:**
- `supabase` (SupabaseClient): Instance dari Supabase client

**Usage:**
```tsx
import { useAuthCheck } from '../shared';

export default function GameComponent() {
  const supabase = createClient();
  useAuthCheck(supabase);  // Call at top level
  
  // Component continues if authenticated
}
```

**What it does:**
- Check current session via Supabase
- Alerts user jika belum login
- Redirect ke `/login` jika not authenticated
- Component safe untuk render setelah check

**When to use:**
- Di setiap game mode content component
- Harus di browser context (`'use client'`)

---

### `useHintSettings()`
Get hint button settings dari localStorage.

**Signature:**
```tsx
function useHintSettings(): { enableHintButton: boolean }
```

**Returns:**
- `enableHintButton` (boolean): Whether hint button feature enabled

**Usage:**
```tsx
import { useHintSettings } from '../shared';

export default function GameComponent() {
  const { enableHintButton } = useHintSettings();
  
  if (enableHintButton) {
    // Show hint button
  }
}
```

**What it does:**
- Read localStorage key `enableHintButton`
- Return boolean flag
- Default false jika key doesn't exist

**When to use:**
- Di game modes yang support hint feature (spaced-repetition)
- Optional untuk modes yang tidak butuh hint

---

## 🛠️ Utility Functions (`gameUtils.ts`)

### `formatTime(seconds: number): string`
Convert seconds ke MM:SS format.

**Signature:**
```tsx
function formatTime(seconds: number): string
```

**Parameters:**
- `seconds` (number): Total seconds

**Returns:**
- (string): Formatted "MM:SS"

**Usage:**
```tsx
import { formatTime } from '../shared';

const displayTime = formatTime(125);  // "02:05"
```

**Examples:**
- `formatTime(0)` → "00:00"
- `formatTime(65)` → "01:05"
- `formatTime(3661)` → "61:01"

---

### `calculateAccuracy(total: number, correct: number): string`
Calculate accuracy percentage.

**Signature:**
```tsx
function calculateAccuracy(total: number, correct: number): string
```

**Parameters:**
- `total` (number): Total number of questions
- `correct` (number): Number of correct answers

**Returns:**
- (string): Accuracy percentage "0-100%"

**Usage:**
```tsx
import { calculateAccuracy } from '../shared';

const accuracy = calculateAccuracy(10, 8);  // "80%"
```

**Examples:**
- `calculateAccuracy(10, 10)` → "100%"
- `calculateAccuracy(10, 5)` → "50%"
- `calculateAccuracy(10, 0)` → "0%"

---

### `calculateAvgTime(totalTime: number, count: number): string`
Calculate average time per question.

**Signature:**
```tsx
function calculateAvgTime(totalTime: number, count: number): string
```

**Parameters:**
- `totalTime` (number): Total time in seconds
- `count` (number): Total number of questions

**Returns:**
- (string): Average time "MM:SS" format

**Usage:**
```tsx
import { calculateAvgTime } from '../shared';

const avgTime = calculateAvgTime(125, 5);  // "00:25"
```

---

### `calculateXPGained(results: GameResult[]): number`
Calculate total XP from game results.

**Signature:**
```tsx
function calculateXPGained(results: GameResult[]): number
```

**Parameters:**
- `results` (GameResult[]): Array of game results

**Type:**
```tsx
interface GameResult {
  vocab_id: number;
  correct: boolean;
  time_taken: number;
  hintUsed?: boolean;
}
```

**Returns:**
- (number): Total XP points earned

**Calculation:**
- Correct answer: 100 XP - time penalty
- Wrong answer: 0 XP
- Time penalty: (timeTaken / maxTime) * 100

**Usage:**
```tsx
import { calculateXPGained } from '../shared';

const xp = calculateXPGained([
  { vocab_id: 1, correct: true, time_taken: 10 },
  { vocab_id: 2, correct: false, time_taken: 5 }
]);
```

---

### `fisherYatesShuffle<T>(array: T[]): T[]`
Fisher-Yates shuffle algorithm untuk randomize array.

**Signature:**
```tsx
function fisherYatesShuffle<T>(array: T[]): T[]
```

**Parameters:**
- `array` (T[]): Array untuk di-shuffle

**Returns:**
- (T[]): Shuffled array (non-mutating)

**Usage:**
```tsx
import { fisherYatesShuffle } from '../shared';

const words = ['apple', 'banana', 'cherry'];
const shuffled = fisherYatesShuffle(words);
// Result: shuffled order, original unchanged
```

**When to use:**
- Randomize answer options (sentence-ordering)
- Randomize question order
- Fair randomization (better than sort shuffle)

---

### `normalizeString(str: string): string`
Normalize string untuk comparison (lowercase, trim, remove extra spaces).

**Signature:**
```tsx
function normalizeString(str: string): string
```

**Parameters:**
- `str` (string): String untuk di-normalize

**Returns:**
- (string): Normalized string

**Usage:**
```tsx
import { normalizeString } from '../shared';

const user = "  Hello World  ";
const correct = "hello world";

normalizeString(user) === normalizeString(correct);  // true
```

---

### `isAnswerCorrect(userAnswer: string, correctAnswer: string, synonyms: string[]): boolean`
Check apakah user answer correct (dengan synonyms support).

**Signature:**
```tsx
function isAnswerCorrect(
  userAnswer: string,
  correctAnswer: string,
  synonyms: string[]
): boolean
```

**Parameters:**
- `userAnswer` (string): User's answer
- `correctAnswer` (string): Correct answer
- `synonyms` (string[]): List of valid synonyms

**Returns:**
- (boolean): True jika answer correct

**Usage:**
```tsx
import { isAnswerCorrect } from '../shared';

const correct = isAnswerCorrect(
  'happy',
  'glad',
  ['cheerful', 'joyful']
);  // true
```

**Logic:**
1. Normalize kedua strings
2. Check exact match dengan correctAnswer
3. Check match dengan any synonym
4. Return boolean result

---

## 🎨 Components

### `GameNavbar`
Reusable navbar component untuk semua game modes.

**Location:** `/app/game-modes/shared/GameNavbar.tsx`

**Props:**
```tsx
interface GameNavbarProps {
  currentIndex: number;           // Current question index (0-based)
  totalQuestions: number;         // Total number of questions
  timer?: number;                 // Timer in seconds (optional)
  category?: string;              // Category name (optional)
  subcategory?: string;           // Subcategory name (optional)
  modeName?: string;              // Game mode name (optional, e.g., "AI")
  onBack: () => void;             // Callback untuk back button
}
```

**Usage:**
```tsx
import { GameNavbar } from '../shared';

<GameNavbar
  currentIndex={3}
  totalQuestions={10}
  timer={125}
  category="Animals"
  subcategory="1"
  modeName="Vocab"
  onBack={() => router.push('/dashboard')}
/>
```

**Features:**
- Question counter (3 of 10)
- Timer display (optional)
- Category & subcategory badges
- Mode name display (optional)
- Back button with custom handler
- Responsive design
- Theme-aware

---

### `ProgressBar`
Animated progress bar component.

**Location:** `/app/game-modes/shared/ProgressBar.tsx`

**Props:**
```tsx
interface ProgressBarProps {
  current: number;     // Current progress (0-based)
  total: number;       // Total items
}
```

**Usage:**
```tsx
import { ProgressBar } from '../shared';

<ProgressBar current={3} total={10} />  // Shows 30% progress
```

**Features:**
- Smooth animated transitions (Framer Motion)
- Percentage calculation
- Visual bar with color
- Responsive

---

### `GameResultModal`
Fully customizable result modal component.

**Location:** `/app/game-modes/shared/GameResultModal.tsx`

**Props:**
```tsx
interface GameResultModalProps {
  // Required
  correctCount: number;
  totalCount: number;
  accuracy: string;              // e.g., "85%"
  
  // Optional
  avgTime?: string;              // e.g., "00:25"
  totalTime?: number;            // seconds
  xpGained?: number;
  
  // Callbacks
  onPlayAgain: () => void;
  onBackToMenu: () => void;       // Dashboard
  onBackToCategory?: () => void;  // Category menu
  onNextPart?: () => void;        // Next part
  
  // Display flags
  hasNextPart?: boolean;
  showPlayAgain?: boolean;        // Default: true
  showBackToCategory?: boolean;   // Default: false
  showNextPart?: boolean;         // Default: false
}
```

**Usage:**
```tsx
import { GameResultModal } from '../shared';

{showResultModal && (
  <GameResultModal
    correctCount={8}
    totalCount={10}
    accuracy="80%"
    avgTime="00:25"
    totalTime={250}
    xpGained={750}
    onPlayAgain={() => resetGame()}
    onBackToMenu={() => router.push('/dashboard')}
    onBackToCategory={() => router.back()}
    showPlayAgain={true}
    showBackToCategory={true}
  />
)}
```

**Features:**
- Shows correct count, accuracy
- Optional XP, time stats
- Multiple customizable buttons
- Responsive design
- Animated entrance

---

## 🔄 Type Definitions

### `GameResult`
```tsx
interface GameResult {
  vocab_id: number;
  correct: boolean;
  time_taken: number;
  hintUsed?: boolean;          // Optional, for spaced-repetition
  userAnswer?: string;         // Optional, for review
  questionData?: any;          // Optional, for detailed review
}
```

### `VocabWord`
```tsx
interface VocabWord {
  vocab_id: number;
  indo: string;
  english_primary: string;
  synonyms: string[];
  class: string;               // e.g., "Noun", "Verb"
  category: string;
  subcategory: string;
  fluency: number;
}
```

---

## 📦 Importing

**Recommended (Barrel import):**
```tsx
import {
  useAuthCheck,
  useHintSettings,
  GameNavbar,
  ProgressBar,
  GameResultModal,
  calculateAccuracy,
  calculateAvgTime,
  calculateXPGained,
  formatTime,
  fisherYatesShuffle,
  normalizeString,
  isAnswerCorrect,
} from '../shared';
```

**Alternative (Individual imports):**
```tsx
import { useAuthCheck, useHintSettings } from '../shared/gameHooks';
import { calculateAccuracy, formatTime, ... } from '../shared/gameUtils';
import GameNavbar from '../shared/GameNavbar';
import ProgressBar from '../shared/ProgressBar';
import GameResultModal from '../shared/GameResultModal';
```

---

## 🧪 Testing Utilities

Ketika testing game modes, refer ke:
- **Hook behavior**: Check supabase mock
- **Utilities**: Pure functions, easy to test
- **Components**: Use React Testing Library
- **Integration**: Test full game flow

---

## 📝 Best Practices

1. **Always call `useAuthCheck` at component top**
   ```tsx
   export default function GameContent() {
     const supabase = createClient();
     useAuthCheck(supabase);  // ✓ Top level
     // ...
   }
   ```

2. **Pass normalized strings ke `isAnswerCorrect`**
   ```tsx
   // ✓ Already normalizes internally, but good to be explicit
   const correct = isAnswerCorrect(userAnswer, correctAns, synonyms);
   ```

3. **Use `calculateXPGained` after all results collected**
   ```tsx
   // ✓ After game finishes
   const xp = calculateXPGained(gameResults);
   ```

4. **Always show feedback before shuffling again**
   ```tsx
   // ✓ Show correctness, then shuffle on next
   setFeedback('correct');
   // ... wait for user to see...
   // THEN: shuffle again
   ```

---

## 🐛 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Navbar timer not updating | Check useEffect cleanup, timer dependency |
| Progress bar stuck | Pass correct current/total values |
| Result modal not showing | Check showResultModal state boolean |
| Answer not recognized | Use isAnswerCorrect for proper comparison |
| Shuffle not random | Use fisherYatesShuffle (Fisher-Yates) |

---

## 📞 Support

Untuk questions tentang shared utilities:
1. Check examples di game mode implementation
2. Review type definitions
3. Check logic di source file (gameUtils.ts)
4. Look at test files (if available)
