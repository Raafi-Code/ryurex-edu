# Ryurex Edu - PvP Mode Implementation Plan

## Overview
PvP Mode adalah fitur competitive vocabulary game yang memungkinkan dua player bermain head-to-head secara real-time. Mode ini TIDAK mempengaruhi stats learning user (user_vocab_progress).

---

## Database Schema

### Table: pvp_lobbies
```sql
CREATE TABLE public.pvp_lobbies (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Players
  host_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joined_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  
  -- Game Configuration
  game_code text NOT NULL UNIQUE,
  category text NOT NULL,
  subcategory smallint NOT NULL,  -- 0 = random, 1-5 = custom
  num_questions smallint NOT NULL CHECK (num_questions >= 1),
  timer_duration smallint NOT NULL CHECK (timer_duration >= 5),  -- MIN 5 sec, WAJIB
  game_mode text NOT NULL,  -- 'vocab' atau 'sentence'
  random_seed text,  -- Untuk random mode consistency
  
  -- Game Status
  status text DEFAULT 'waiting',
    -- 'waiting' = menunggu player 2 join
    -- 'opponent_joined' = player 2 joined, waiting host approval
    -- 'ready' = kedua player ready
    -- 'in_progress' = game sedang berjalan
    -- 'finished' = game selesai
  host_approved boolean,  -- NULL = pending, true = accepted, false = rejected/kicked
  player2_ready boolean DEFAULT false,
  
  -- Scores (diisi saat game selesai)
  host_score integer,  -- Player 1 final score
  joined_score integer,  -- Player 2 final score
  
  -- Timestamps
  created_at timestamp with time zone DEFAULT now(),
  started_at timestamp with time zone,
  finished_at timestamp with time zone,
  expires_at timestamp with time zone  -- 5 menit dari created_at
);
```

---

## Game Flow

### Phase 1: Create Lobby (✅ DONE - `/pvp/create`)
**UI Elements:**
- Choose Category (dropdown dari vocab_master categories)
- Choose Subcategory Mode:
  - **Custom Mode**: Pilih Part 1-5 (max 10 soal)
  - **Random Mode**: Campur semua parts dari category (max = total vocab di category)
- Choose Number of Questions (input + slider, min 1)
- Choose Timer per Question (required, slider 5-60 sec)
- Choose Game Mode (Vocab/Sentence, sentence only if available)
- Summary Card (preview config)

**Actions:**
- Generate unique game_code (6 chars: ABC123)
- Insert ke DB: status = 'waiting', expires_at = now() + 5 min
- Redirect ke `/pvp/lobby/{code}`

---

### Phase 2: Lobby Waiting Page (✅ DONE - `/pvp/lobby/{code}`)
**For Player 1 (Host):**
- Display game code (prominent)
- Display lobby config
- **Countdown timer: 0:00 → 5:00** (dari created_at)
- Status Player 2 (None / "Opponent joined" / "Ready")
- Button "Kick" (disabled sampai Player 2 join)
- Poll `/api/pvp/lobby/{code}` setiap 1-2 detik untuk update status

**Actions:**
- Jika 5 menit habis & belum ada join:
  - DELETE/UPDATE lobby (status = 'expired')
  - Redirect Player 1 ke `/pvp/create` dengan toast "Lobby expired"

**For Player 2 (Joined):**
- Input game code → Validate (✅ DONE - `/pvp/join`)
- POST `/api/pvp/join-lobby` → UPDATE joined_user_id
- Masuk lobby page (sama UI seperti Player 1)
- Display "Waiting for host to accept..." dengan status approval

---

### Phase 3: Accept/Reject Popup (Player 1)
**Triggered:** Saat Player 2 join

**UI:** Pop-up modal
- "Player [Nama] wants to join. Accept or Reject?"
- Button "Accept" / "Reject"

**Actions:**
- **Accept**: POST `/api/pvp/accept-opponent` → UPDATE host_approved = true, status = 'opponent_joined'
- **Reject**: POST `/api/pvp/reject-opponent` → UPDATE joined_user_id = NULL, host_approved = NULL, status = 'waiting'

---

### Phase 4: Ready Status (Player 2)
**For Player 2:**
- Display "Ready?" button
- Klik Ready → POST `/api/pvp/ready` → UPDATE player2_ready = true

**For Player 1:**
- See real-time status: "Opponent: Not Ready" → "Opponent: Ready"
- Can now see "Start Game" button (enabled only if player2_ready = true)

---

### Phase 5: Start Game (Player 1)
**Prerequisite:**
- host_approved = true
- player2_ready = true

**Actions:**
1. Klik "Start Game"
2. UPDATE status = 'in_progress', started_at = now()
3. Show countdown 3, 2, 1
4. Fetch questions dari DB:
   - Query vocab_master WHERE category = ? AND (subcategory = ? OR subcategory = 0 for random)
   - Randomize questions
   - If random mode: Apply seed (hash dari lobbyId + category) untuk deterministic shuffle
5. Load game page `/pvp/game/{lobbyId}` untuk kedua player

---

### Phase 6: In-Game (Client-side) 
**UI Design:**
- **Vocab Mode**: Reuse `/vocabgame-content` UI
  - Layout: Indo text → input English translation
- **Sentence Mode**: Reuse `/sentencelearning-content` UI
  - Layout: Sentence context → input missing word

**Scoring (ALL LOCAL - no server interaction):**
```javascript
function calculateScore(isCorrect, timeTakenMs, timerDurationSec) {
  if (!isCorrect) return 0;
  
  const basePoints = 100;
  const timeTakenSec = timeTakenMs / 1000;
  const timePenalty = (timeTakenSec / timerDurationSec) * 100;
  return Math.max(0, Math.floor(basePoints - timePenalty));
}
```

**Local State:**
```javascript
{
  gameState: {
    questions: [...],
    currentQuestionIndex: 0,
    userAnswers: [
      {
        vocabId: 1,
        userAnswer: "hello",
        correctAnswer: "hello",
        isCorrect: true,
        timeTakenMs: 1500
      },
      ...
    ],
    totalScore: 850
  }
}
```

**Auto-next soal jika:**
- Player klik "Answer" button
- Timer countdown habis (if timer enabled)

---

### Phase 7: Game Finished - One Player Done Early ⭐
**Skenario:** Player 1 selesai duluan, Player 2 masih bermain

**Flow untuk Player 1:**
1. Selesai semua soal → Hitung final score di local
2. Klik tombol "Submit Score"
3. POST `/api/pvp/submit-score`:
   ```json
   {
     "lobbyId": "uuid",
     "playerRole": "host",
     "finalScore": 850,
     "userAnswers": [...]
   }
   ```
4. Server UPDATE `pvp_lobbies.host_score = 850`
5. **Pop-up muncul**: "Waiting for opponent to finish..." ⏳
6. Client **poll** `/api/pvp/{lobbyId}/scores` setiap 1-2 detik:
   ```json
   {
     "host_score": 850,
     "joined_score": null,
     "bothSubmitted": false
   }
   ```
7. Saat `bothSubmitted = true` → Pop-up hilang → Load result page

**Flow untuk Player 2:**
- Terus bermain tanpa disturbance
- Saat selesai → Submit score
- Langsung bisa lihat result page

---

### Phase 8: Show Result
**Setelah kedua player submit score:**
- Redirect ke `/pvp/result/{lobbyId}`
- Display leaderboard: Player 1 vs Player 2
- Show scores, winner
- UPDATE status = 'finished'

---

### Phase 9: IMPORTANT - Kick Player (Only During Lobby)
**Kapan bisa kick?**
- Status = 'waiting' ✅
- Status = 'opponent_joined' ✅
- Status = 'ready' ✅
- Status = 'in_progress' ❌ (TIDAK BISA)

**Action saat kick:**
- UPDATE joined_user_id = NULL
- UPDATE host_approved = false
- UPDATE player2_ready = false
- Status tetap sesuai kondisi
- Player 2 redirect ke `/pvp` dengan toast "Kicked from lobby"

**UI:**
- Kick button disabled/hidden saat in_progress

---

## Pages to Build

| Route | Status | Purpose |
|-------|--------|---------|
| `/pvp` | ✅ DONE | Main PvP menu (Create/Join) |
| `/pvp/create` | ✅ DONE | Create lobby form |
| `/pvp/lobby/{code}` | ✅ DONE | Lobby waiting page |
| `/pvp/join` | ✅ DONE | Join game input page |
| `/pvp/game/{lobbyId}` | ✅ DONE | In-game page (reuse vocab/sentence UI) |
| `/pvp/result/{lobbyId}` | ✅ DONE | Result leaderboard |

---

## API Endpoints Needed

### 1. POST /api/pvp/create-lobby
```json
Input: {
  category: string,
  subcategory: number,
  numQuestions: number,
  timerDuration: number,
  gameMode: string
}
Output: { lobbyId: uuid, gameCode: string }
```

### 2. GET /api/pvp/lobby/{code}
```json
Output: {
  id: uuid,
  host: { id, displayName },
  joined: { id, displayName } | null,
  status: string,
  config: { category, subcategory, numQuestions, timerDuration, gameMode },
  hostApproved: boolean | null,
  player2Ready: boolean,
  timeRemaining: number (seconds)
}
```

### 3. POST /api/pvp/join-lobby
```json
Input: { gameCode: string }
Output: { lobbyId: uuid, status: string }
```

### 4. POST /api/pvp/accept-opponent
```json
Input: { lobbyId: uuid, decision: 'accept' | 'reject' }
Output: { status: updated }
```

### 5. POST /api/pvp/ready
```json
Input: { lobbyId: uuid }
Output: { status: 'ready' }
```

### 6. POST /api/pvp/start-game
```json
Input: { lobbyId: uuid }
Output: { questions: [...], randomSeed: string | null }
```

### 7. POST /api/pvp/submit-score
```json
Input: {
  lobbyId: uuid,
  playerRole: 'host' | 'joined',
  finalScore: number,
  userAnswers: [...]
}
Output: { status: 'submitted' }
```

### 8. GET /api/pvp/{lobbyId}/scores
```json
Output: {
  hostScore: number | null,
  joinedScore: number | null,
  bothSubmitted: boolean
}
```

### 9. POST /api/pvp/kick-player
```json
Input: { lobbyId: uuid }
Output: { status: 'kicked' }
Action: Only works if status !== 'in_progress'
```

### 10. GET /api/pvp/{lobbyId}/result
```json
Output: {
  hostScore: number,
  joinedScore: number,
  winner: 'host' | 'joined',
  hostName: string,
  joinedName: string
}
```

---

## Important Notes

### Scoring Calculation
- **All scoring happens locally on client**
- No server involvement during gameplay
- Timestamps & calculations trusted from client
- Per soal: Jika benar → score based on speed, jika salah → 0

### Question Consistency
- **Custom Mode**: Soal automatically sama (dari DB, same subcategory)
- **Random Mode**: Perlu seed untuk deterministic shuffle
  - Seed = hashCode(lobbyId + category)
  - Use Fisher-Yates shuffle dengan seed
  - Atau: Store randomized questions_list di DB saat game start

### Lobby Expiration
- Jika 5 menit & belum ada join:
  - Player 1 auto-redirect ke create form
  - Delete/expire lobby dari DB

### Player Flow
- Player 1: Create → Wait → Accept → Ready (from P2) → Start → Play → Wait for opponent scores → Result
- Player 2: Join → Accept pop-up (P1) → Ready → Play → Submit → See result

### Kick Mechanic
- **During lobby**: Can kick anytime (status ≠ in_progress)
- **During game**: Cannot kick (button disabled/hidden)
- **After kick**: Player 2 redirected to /pvp

---

## UI/UX Requirements

### Design Consistency
- Vocab Mode: Use exact UI from `/vocabgame-content`
- Sentence Mode: Use exact UI from `/sentencelearning-content`
- Lobby page: Similar to category-menu layout
- Dark theme support (already implemented)

### Mobile Responsive
- All pages responsive (mobile-first design)
- Navbar similar to category-menu page
- Cards & buttons follow dashboard styling

### Real-time Updates
- Use polling (1-2 sec intervals) for:
  - Lobby status (Player 2 join, approval, ready)
  - Scores submission (waiting page)
- Optional: Use WebSocket/Supabase Realtime later

---

## Testing Checklist

- [ ] Create lobby: Generate code, save to DB
- [ ] Lobby expiration: 5 min auto-delete
- [ ] Join lobby: Update joined_user_id, notify P1
- [ ] Accept/Reject: Update host_approved, reset if reject
- [ ] Ready status: Update player2_ready, enable Start button
- [ ] Start game: Load game page with questions
- [ ] In-game: Score calculation (local)
- [ ] One player done early: Show waiting pop-up
- [ ] Both submit: Show result page
- [ ] Kick player: Only during lobby, redirect P2
- [ ] Mobile responsive: All pages work on mobile
- [ ] Dark/Light theme: All pages theme-aware

---

## Notes for Future
- Consider WebSocket for real-time updates
- Add replay/history feature
- Leaderboard page for PvP stats
- Achievements/badges for PvP wins
- Matchmaking system

---

## Navigation & Back Button Guidelines (Updated Jan 2026)

### Back Button Navigation Pattern
All game modes (VocabGame, ReviewMode, AI-Mode, SentenceBoxMode) follow consistent back button behavior:

**Navbar Back Button:**
- Uses `router.back()` for natural browser history navigation
- Conditional logic based on entry point:
  - If accessed from **Category** (category param exists) → goes back to Category
  - If accessed from **Dashboard** (no category param) → goes back to Dashboard
- Implementation:
  ```tsx
  onClick={() => {
    if (category) {
      router.back();  // Back to category (or whatever page user came from)
    } else {
      router.push('/dashboard');  // Direct to dashboard if no category
    }
  }}
  ```

**Result Modal Back Buttons:**
- "Back to Category" button → `router.back()` (returns to previous page in history)
- "Dashboard" button → `router.push('/dashboard')` (explicit navigation)
- Session Complete modal uses conditional button text based on category param

**Special Case - ReviewMode:**
- If accessed from Category with `categoryFilter` param:
  - "Back to Category" button visible → `router.back()`
  - "Dashboard" button → `router.push('/dashboard')`
- If accessed from Dashboard (no `categoryFilter`):
  - Only shows "Dashboard" button
  - No category navigation option

**Clear All in SentenceBoxMode:**
- After clearing selected words, word boxes are re-shuffled using Fisher-Yates shuffle
- Prevents words from appearing in correct answer order

### Affected Files
- `/app/vocabgame/vocabgame-content.tsx` - navbar & result modal
- `/app/review-mode/review-mode-content.tsx` - navbar & result modal with conditional logic
- `/app/ai-mode/ai-mode-content.tsx` - navbar & result modal with conditional navbar text
- `/app/sentence-box-mode/sentence-box-mode-content.tsx` - navbar conditional navigation
```
