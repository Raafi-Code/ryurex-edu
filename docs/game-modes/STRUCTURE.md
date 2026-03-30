# Game Modes Directory Structure

Direktori `game-modes` mengelompokkan semua game mode dalam satu tempat untuk kemudahan maintenance dan code organization.

## Struktur Folder (Updated with Descriptive Names)

```
app/game-modes/
├── shared/                            # Shared utilities, hooks, dan components
│   ├── gameHooks.ts                  # Custom hooks untuk auth dan game logic
│   ├── gameUtils.ts                  # Utility functions (formatting, calculations, helpers)
│   ├── GameNavbar.tsx                # Reusable navbar component
│   ├── ProgressBar.tsx               # Reusable progress bar component
│   ├── GameResultModal.tsx           # Reusable result modal component
│   └── index.ts                      # Index untuk export semua shared components
│
├── vocab-translation/                 # Vocabulary Translation Game
│   ├── page.tsx                      # Next.js page entry point
│   └── vocab-translation-content.tsx # Main component
│
├── spaced-repetition/                 # Spaced Repetition Learning Mode
│   ├── page.tsx                      # Next.js page entry point
│   └── spaced-repetition-content.tsx # Main component
│
├── ai-sentence-completion/            # AI-Generated Sentence Completion
│   ├── page.tsx                      # Next.js page entry point
│   └── ai-sentence-completion-content.tsx # Main component
│
└── sentence-ordering/                 # Sentence Word Ordering Mode
    ├── page.tsx                      # Next.js page entry point
    └── sentence-ordering-content.tsx # Main component
```

## Shared Components & Utils

### Hooks (`gameHooks.ts`)
- `useAuthCheck()` - Autentikasi user check
- `useHintSettings()` - Load hint settings dari localStorage

### Utils (`gameUtils.ts`)
- `formatTime()` - Format waktu ke MM:SS
- `calculateAccuracy()` - Hitung accuracy percentage
- `calculateAvgTime()` - Hitung rata-rata waktu per soal
- `calculateXPGained()` - Hitung total XP dari game results
- `fisherYatesShuffle()` - Fisher-Yates shuffle algorithm
- `normalizeString()` - Normalize string untuk comparison
- `isAnswerCorrect()` - Check apakah user answer benar

### Components

#### GameNavbar (`GameNavbar.tsx`)
Navbar yang reusable untuk semua game modes dengan dukungan:
- Back button
- Progress counter (Question X of Y)
- Timer (optional)
- Category & Subcategory badges
- Theme toggle

**Props:**
```tsx
interface GameNavbarProps {
  currentIndex: number;
  totalQuestions: number;
  timer?: number;
  category?: string;
  subcategory?: string;
  modeName?: string;
  onBack: () => void;
}
```

#### ProgressBar (`ProgressBar.tsx`)
Progress bar yang muncul di bawah navbar untuk tracking progress game.

**Props:**
```tsx
interface ProgressBarProps {
  current: number;
  total: number;
}
```

#### GameResultModal (`GameResultModal.tsx`)
Modal hasil game yang reusable untuk menampilkan statistik dan aksi setelah game selesai.

**Props:**
```tsx
interface GameResultModalProps {
  correctCount: number;
  totalCount: number;
  accuracy: string;
  avgTime?: string;
  totalTime?: number;
  xpGained?: number;
  onPlayAgain: () => void;
  onBackToMenu: () => void;
  onBackToCategory?: () => void;
  onNextPart?: () => void;
  hasNextPart?: boolean;
  showPlayAgain?: boolean;
  showBackToCategory?: boolean;
  showNextPart?: boolean;
}
```

## Game Modes Penjelasan

### 1. **Vocab Translation** (vocab-translation/)
- **Fungsi**: Menerjemahkan kosakata dari Bahasa Indonesia ke Inggris
- **Gameplay**: Tampilkan kata Indonesia, user ketik terjemahan Inggris
- **Features**: Auto-hint setelah 10 detik, undo dengan backspace
- **URL**: `/vocabgame?category=...&subcategory=...`

### 2. **Spaced Repetition** (spaced-repetition/)
- **Fungsi**: Review kosakata menggunakan spaced repetition system
- **Gameplay**: Similar dengan vocab translation tapi untuk review
- **Features**: Hint button, tracking hint usage, adaptive scheduling
- **URL**: `/review-mode`

### 3. **AI Sentence Completion** (ai-sentence-completion/)
- **Fungsi**: Melengkapi kalimat dengan terjemahan yang dihasilkan AI
- **Gameplay**: Tampilkan kalimat Indonesia (dengan vocab highlighted), user ketik terjemahan Inggris
- **Features**: Multiple hint system (per-letter), review wrong answers
- **URL**: `/ai-mode?category=...&subcategory=...`

### 4. **Sentence Ordering** (sentence-ordering/)
- **Fungsi**: Mengurutkan kata-kata menjadi kalimat yang benar
- **Gameplay**: Words diacak, user drag/click untuk order dengan benar
- **Features**: Clear button untuk re-shuffle, instant feedback
- **URL**: `/sentence-box-mode?category=...&subcategory=...`

## Menambahkan Game Mode Baru

Untuk menambahkan game mode baru:

1. Buat folder di `/app/game-modes/{mode-name}/`
2. Buat `page.tsx` yang import content component
3. Buat `{mode-name}-content.tsx` untuk main logic
4. Import shared components dan hooks dari `../shared`
5. Update routing di file page.tsx yang lama (jika ada)

### Contoh:

```tsx
// page.tsx
import NewModeContent from './new-mode-content';

export default function NewModePage() {
  return <NewModeContent />;
}

// new-mode-content.tsx
import {
  useAuthCheck,
  GameNavbar,
  ProgressBar,
  GameResultModal,
  calculateAccuracy,
  // ... import lainnya
} from '../shared';

export default function NewModeContent() {
  // implementasi
}
```

## Backward Compatibility

File-file original masih untuk backward compatibility:
- `/app/vocabgame/page.tsx` → import dari `vocab-translation`
- `/app/review-mode/page.tsx` → import dari `spaced-repetition`
- `/app/ai-mode/page.tsx` → import dari `ai-sentence-completion`
- `/app/sentence-box-mode/page.tsx` → import dari `sentence-ordering`

File `-content.tsx` lama di folder original sudah tidak digunakan lagi.

## Kelebihan Struktur Baru

✅ **Better Organization** - Semua game mode centralized dengan deskripsi yang jelas
✅ **Code Reusability** - Shared components mengurangi duplikasi ~80%
✅ **Easier Maintenance** - Changes di shared components auto apply ke semua modes
✅ **Scalability** - Mudah menambah game mode baru
✅ **Consistency** - UI/UX yang sama di semua game modes
✅ **Descriptive Names** - Nama folder menjelaskan fungsi masing-masing

## Catatan

- Setiap game mode dapat memiliki styling unik melalui props
- Shared components fully customizable via props
- Game logic tetap independent per game mode
- Backend API calls tetap sesuai kebutuhan masing-masing mode
