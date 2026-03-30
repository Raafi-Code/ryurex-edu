# 🎮 Ryurex Edu - Alur Game (Game Flow)

> Dokumentasi lengkap alur permainan di Ryurex Edu Vocab Game.

---

## 🗺️ Overview Semua Mode

```mermaid
flowchart TD
    Landing["🏠 Landing Page"] --> Login["🔐 Login / Signup"]
    Login --> Dashboard["📊 Dashboard"]
    
    Dashboard --> CategoryMenu["📁 Pilih Kategori"]
    Dashboard --> ReviewMode["📖 Review Mode"]
    Dashboard --> PvP["⚔️ PvP Mode"]
    Dashboard --> Stats["📈 Progress Stats"]
    Dashboard --> Leaderboard["🏆 Leaderboard"]
    
    CategoryMenu --> SubcategorySelect["📂 Pilih Subcategory / Part"]
    SubcategorySelect --> VocabGame["🎯 Vocab Game"]
    SubcategorySelect --> AiMode["🤖 AI Mode"]
    SubcategorySelect --> SentenceBox["✏️ Sentence Box Mode"]
    
    VocabGame --> Results["📊 Result Modal"]
    AiMode --> Results
    SentenceBox --> Results
    ReviewMode --> Results
    
    PvP --> PvPCreate["Create Lobby"]
    PvP --> PvPJoin["Join Lobby"]
    PvPCreate --> PvPLobby["⏳ Lobby Waiting"]
    PvPJoin --> PvPLobby
    PvPLobby --> PvPGame["🎮 PvP Game"]
    PvPGame --> PvPResult["🏆 PvP Result"]
    
    Results --> NextPart["➡️ Next Part"]
    Results --> PlayAgain["🔄 Play Again"]
    Results --> BackMenu["🔙 Back to Menu"]
```

---

## 1. 🎯 Vocab Game (Mode Utama)

Mode inti di mana user menerjemahkan kata Indonesia → Inggris dengan mengetik jawaban.

### Alur Lengkap

```mermaid
flowchart TD
    Start["User pilih Kategori + Part"] --> Auth["🔐 Cek Autentikasi"]
    Auth -->|Tidak login| Redirect["Redirect ke Landing"]
    Auth -->|Login| FetchWords["📥 Fetch kata dari API\n/api/getCustomBatch"]
    
    FetchWords -->|Kosong| NoWords["Tampilkan 'No Words Available'\nBack to Menu"]
    FetchWords -->|Ada kata| ShowQuestion["📝 Tampilkan Soal"]
    
    ShowQuestion --> Timer["⏱️ Timer mulai berjalan"]
    Timer --> Hint{Timer ≥ 10 detik?}
    Hint -->|Ya| RevealHint["💡 Hint: Reveal huruf pertama\nSetiap 10 detik tambah 1 huruf"]
    Hint -->|Belum| UserType["User mengetik jawaban"]
    RevealHint --> UserType
    
    UserType --> Submit["✅ Submit Jawaban"]
    Submit --> Check{"Jawaban benar?"}
    
    Check -->|✅ Benar| CorrectFeedback["🟢 'Correct!' + animasi"]
    Check -->|❌ Salah| WrongFeedback["🔴 'Wrong!' + tampilkan jawaban benar"]
    
    CorrectFeedback --> RecordResult["📝 Simpan hasil lokal"]
    WrongFeedback --> RecordResult
    
    RecordResult --> NextCheck{"Soal terakhir?"}
    NextCheck -->|Belum| NextQuestion["➡️ 2 detik → Soal berikutnya\nReset timer & hint"]
    NextQuestion --> ShowQuestion
    
    NextCheck -->|Ya| BatchSubmit["📤 Submit semua hasil\nPOST /api/submitBatch"]
    BatchSubmit --> CheckNext["🔍 Cek ada Part selanjutnya?\nGET /api/subcategories"]
    CheckNext --> ResultModal["📊 Result Modal"]
    
    ResultModal --> ActionPlay["🔄 Play Again"]
    ResultModal --> ActionNext["➡️ Next Part"]
    ResultModal --> ActionBack["🔙 Back to Category"]
    
    ActionPlay --> FetchWords
    ActionNext --> Start
```

### Detail Mekanisme

| Fitur | Detail |
|---|---|
| **Input** | Hidden input + visual underscore display |
| **Spasi** | Otomatis ditambahkan sesuai jawaban benar |
| **Hint** | Auto-reveal setiap 10 detik (huruf 1, 2, 3, ...) |
| **Jawaban** | Case-insensitive, harus lengkap (panjang = jawaban benar) |
| **Feedback** | 2 detik tampil sebelum lanjut ke soal berikutnya |
| **Batch Submit** | Semua hasil dikirim sekaligus di akhir sesi |

### Kalkulasi XP

| Kondisi | XP |
|---|---|
| ✅ Benar & jawab ≤ 5 detik | **+15 XP** ⚡ |
| ✅ Benar & jawab < 10 detik | **+10 XP** 🔥 |
| ✅ Benar & jawab ≥ 10 detik | **+0 XP** ⏱️ |
| ❌ Salah | **+0 XP** |

---

## 2. 📖 Review Mode (Spaced Repetition)

Mode untuk mereview kata-kata yang sudah pernah dipelajari, menggunakan sistem spaced repetition.

### Alur Lengkap

```mermaid
flowchart TD
    Start["User masuk Review Mode"] --> Auth["🔐 Cek Autentikasi"]
    Auth --> FetchDue["📥 Fetch kata 'due today'\nGET /api/getBatch"]
    
    FetchDue -->|Kosong| AllDone["✨ 'All caught up!'\nTidak ada kata untuk direview"]
    FetchDue -->|Ada kata| ShowQuestion["📝 Tampilkan Soal"]
    
    ShowQuestion --> Timer["⏱️ Timer berjalan"]
    Timer --> HintBtn{"User klik tombol Hint?"}
    HintBtn -->|Ya| RevealHint["💡 Reveal huruf satu per satu"]
    HintBtn -->|Tidak| UserType["User mengetik jawaban"]
    RevealHint --> UserType
    
    UserType --> Submit["✅ Submit"]
    Submit --> Check{"Benar?"}
    
    Check -->|✅| Correct["🟢 Correct!"]
    Check -->|❌| Wrong["🔴 Wrong! + jawaban benar"]
    
    Correct --> Record["📝 Simpan + catat hintUsed"]
    Wrong --> Record
    
    Record --> Next{"Soal terakhir?"}
    Next -->|Belum| NextQ["➡️ Soal berikutnya"]
    NextQ --> ShowQuestion
    Next -->|Ya| BatchSubmit["📤 Submit batch"]
    BatchSubmit --> ResultModal["📊 Result Modal"]
    
    ResultModal --> PlayAgain["🔄 Play Again"]
    ResultModal --> BackCat["🔙 Back to Category"]
```

### Perbedaan dengan Vocab Game

| Fitur | Vocab Game | Review Mode |
|---|---|---|
| **Sumber kata** | Semua kata di kategori | Hanya kata dengan `next_due ≤ today` |
| **Hint** | Auto setiap 10 detik | Manual (klik tombol) |
| **Tujuan** | Belajar kata baru | Mengulang kata yang sudah dipelajari |
| **Spaced Repetition** | Tidak | Ya (berdasarkan `next_due`) |
| **Data result** | `time_taken` | `time_taken` + `hintUsed` |

---

## 3. 🤖 AI Mode (Konteks Kalimat)

Mode di mana AI (Groq) membuat kalimat context, dan user menebak kata yang hilang di kalimat tersebut.

### Alur Lengkap

```mermaid
flowchart TD
    Start["User pilih Kategori + Part"] --> Auth["🔐 Cek Auth"]
    Auth --> FetchAI["📥 Request ke AI\nPOST /api/ai/generateSentences"]
    
    FetchAI --> AIProcess["🤖 Groq AI generate kalimat\nBahasa Indonesia + Inggris"]
    AIProcess --> ShowQuestion["📝 Tampilkan:\n- Kalimat Indonesia (dengan badge kata target)\n- Kalimat Inggris (kata target di-blank-kan)"]
    
    ShowQuestion --> HintBtn{"User klik Hint?"}
    HintBtn -->|Ya| RevealHint["💡 Reveal huruf"]
    HintBtn -->|Tidak| UserType["User mengetik kata yang hilang"]
    RevealHint --> UserType
    
    UserType --> Submit["✅ Submit"]
    Submit --> Check{"Benar?"}
    
    Check -->|✅| Correct["🟢 Correct!"]
    Check -->|❌| Wrong["🔴 Wrong! + jawaban benar"]
    
    Correct --> Record["📝 Simpan + hintClickCount"]
    Wrong --> Record
    
    Record --> Next{"Soal terakhir?"}
    Next -->|Belum| NextQ["➡️ Soal berikutnya"]
    NextQ --> ShowQuestion
    Next -->|Ya| Submit2["📤 Submit skor\nPOST /api/ai/submitScore"]
    Submit2 --> ResultModal["📊 Result Modal"]
    
    ResultModal --> Retry["🔄 Retry"]
    ResultModal --> BackCat["🔙 Back to Category"]
    ResultModal --> BackDash["🏠 Back to Dashboard"]
```

### Contoh Soal AI Mode

```
Kalimat Indonesia: "Kucing itu tidur di atas [meja]"
Kalimat Inggris:   "The cat sleeps on the _____"
Jawaban:            "table"
```

### Data yang disimpan per soal

```typescript
{
  vocab_id: number,
  correct: boolean,
  hintClickCount: number,  // berapa kali hint diklik
  userAnswer: string,
  questionData: {           // data kalimat dari AI
    id, indo, english, class, category,
    subcategory, sentence_indo, sentence_english
  }
}
```

---

## 4. ✏️ Sentence Box Mode (Susun Kalimat)

Mode di mana user menyusun kalimat Inggris dari word boxes yang diacak.

### Alur Lengkap

```mermaid
flowchart TD
    Start["User pilih Kategori + Part"] --> Auth["🔐 Cek Auth"]
    Auth --> FetchAI["📥 Request ke AI\nPOST /api/ai/generateSentences"]
    
    FetchAI --> ShowQuestion["📝 Tampilkan:\n- Kalimat Indonesia (referensi)\n- Word boxes (acak)"]
    
    ShowQuestion --> UserClick["User klik box → masuk ke slot jawaban"]
    UserClick --> Remove{"User klik slot jawaban?"}
    Remove -->|Ya| RemoveWord["Kembalikan word ke pool"]
    Remove -->|Tidak| MoreBoxes{"Semua slot terisi?"}
    
    MoreBoxes -->|Belum| UserClick
    MoreBoxes -->|Ya| Submit["✅ Submit"]
    
    Submit --> Normalize["Normalize kedua kalimat\n(lowercase, trim spasi, hapus tanda baca)"]
    Normalize --> Check{"Kalimat cocok?"}
    
    Check -->|✅| Correct["🟢 Correct!"]
    Check -->|❌| Wrong["🔴 Wrong!"]
    
    Correct --> Record
    Wrong --> Record
    
    Record --> Next{"Soal terakhir?"}
    Next -->|Belum| NextQ["➡️ Soal berikutnya"]
    NextQ --> ShowQuestion
    Next -->|Ya| Submit2["📤 Submit skor\nPOST /api/ai/submitScore"]
    Submit2 --> ResultModal["📊 Result Modal"]
    
    ResultModal --> Retry["🔄 Retry"]
    ResultModal --> BackCat["🔙 Back to Category"]
    ResultModal --> BackDash["🏠 Back to Dashboard"]
```

### Mekanisme Word Box

1. Kalimat dipecah jadi kata-kata individual
2. Kata-kata diacak posisinya
3. User klik urutan kata yang benar
4. Bisa hapus kata dari slot jawaban (klik untuk remove)
5. Tombol "Clear" mengembalikan semua

---

## 5. ⚔️ PvP Mode (Multiplayer)

Mode kompetitif antara 2 pemain secara real-time.

### Alur Lengkap

```mermaid
flowchart TD
    Start["⚔️ PvP Hub Page"] --> Choice{"Create atau Join?"}
    
    Choice -->|Create| CreateLobby["📝 Create Lobby Form"]
    CreateLobby --> Config["⚙️ Konfigurasi:\n- Pilih Kategori\n- Subcategory (custom/random)\n- Jumlah soal\n- Timer duration\n- Game mode (vocab/sentence)"]
    Config --> GenerateCode["🔑 Generate game code\nFormat: 'XX-XXXXX'"]
    GenerateCode --> InsertDB["📤 Insert ke pvp_lobbies\nStatus: 'waiting'"]
    InsertDB --> WaitLobby["⏳ Lobby Screen\nTampilkan game code\nTunggu player 2"]
    
    Choice -->|Join| JoinPage["🔗 Join Page\nMasukkan game code"]
    JoinPage --> FindLobby["🔍 Cari lobby by code"]
    FindLobby -->|Ditemukan| JoinLobby["📤 Update: joined_user_id\nStatus: 'opponent_joined'"]
    FindLobby -->|Tidak ada| Error["❌ 'Lobby not found'"]
    
    JoinLobby --> WaitLobby
    
    WaitLobby --> HostApprove["👍 Host approve opponent"]
    HostApprove --> BothReady["✅ Kedua player ready\nStatus: 'ready'"]
    BothReady --> StartGame["🎮 Start Game!\nStatus: 'in_progress'\nPOST /api/pvp/start-game"]
    
    StartGame --> GamePlay["🎯 Gameplay\n(vocab atau sentence mode)"]
    GamePlay --> SubmitScore["📤 Submit skor masing-masing\nPOST /api/pvp/submit-score"]
    SubmitScore --> WaitOpponent["⏳ Tunggu lawan selesai"]
    WaitOpponent --> PvPResult["🏆 Result Page\n/pvp/result/[lobbyId]"]
    
    PvPResult --> PlayAgain["🔄 Play Again\nPOST /api/pvp/reset-game"]
    PvPResult --> BackPvP["🔙 Back to PvP Hub"]
```

### Status Lifecycle Lobby

```mermaid
stateDiagram-v2
    [*] --> waiting : Host create lobby
    waiting --> opponent_joined : Player 2 join
    opponent_joined --> ready : Host approve
    ready --> in_progress : Game dimulai
    in_progress --> finished : Kedua player submit
    waiting --> expired : 5 menit timeout
    
    expired --> [*]
    finished --> [*]
```

### Konfigurasi Game PvP

| Setting | Options |
|---|---|
| **Kategori** | Dari daftar `vocab_master` categories |
| **Subcategory** | Custom (pilih Part) atau Random |
| **Jumlah Soal** | ≥ 1 |
| **Timer** | ≥ 5 detik per soal |
| **Game Mode** | `vocab` (terjemahkan kata) atau `sentence` (AI-generated) |

### Data Skor yang Disimpan

Per player:
- Total questions, correct answers, wrong answers
- Accuracy percent
- Total time (ms), average time per question (ms)
- Fastest & slowest answer time (ms)
- Detail per soal (`jsonb`): vocab_id, answer, isCorrect, timeTakenMs

---

## 🔄 Flow Data Keseluruhan

```mermaid
flowchart LR
    subgraph Frontend
        VG["Vocab Game"]
        RM["Review Mode"]
        AI["AI Mode"]
        SB["Sentence Box"]
        PvP["PvP Game"]
    end
    
    subgraph API["API Routes"]
        GB["/api/getCustomBatch"]
        GBR["/api/getBatch"]
        SBatch["/api/submitBatch"]
        AIG["/api/ai/generateSentences"]
        AIS["/api/ai/submitScore"]
        PvPAPI["/api/pvp/*"]
    end
    
    subgraph DB["Supabase DB"]
        VM["vocab_master"]
        UVP["user_vocab_progress"]
        U["users (XP)"]
        PL["pvp_lobbies"]
    end
    
    subgraph External
        Groq["Groq AI"]
    end
    
    VG --> GB --> VM
    RM --> GBR --> VM
    VG & RM --> SBatch --> UVP & U
    
    AI & SB --> AIG --> Groq
    AI & SB --> AIS --> UVP & U
    
    PvP --> PvPAPI --> PL & VM
    PvPAPI --> Groq
```

---

## 📱 Halaman & Routing

| Route | Halaman | Keterangan |
|---|---|---|
| `/` | Landing Page | Halaman utama, CTA login |
| `/login` | Login | Login dengan Supabase Auth |
| `/signup` | Signup | Registrasi user baru |
| `/forgot-password` | Forgot Password | Reset password via email |
| `/update-password` | Update Password | Update password baru |
| `/dashboard` | Dashboard | Hub utama setelah login |
| `/category-menu` | Category Menu | Browse semua kategori |
| `/vocabgame?category=X&subcategory=Y` | Vocab Game | Game terjemahan kata |
| `/review-mode?category=X` | Review Mode | Review kata due today |
| `/ai-mode?category=X&subcategory=Y` | AI Mode | Game konteks kalimat AI |
| `/ai-mode/select` | AI Mode Select | Pilih kategori untuk AI mode |
| `/sentence-box-mode?category=X&subcategory=Y` | Sentence Box | Susun kalimat dari boxes |
| `/pvp` | PvP Hub | Menu utama PvP |
| `/pvp/create` | Create Lobby | Form buat lobby |
| `/pvp/join` | Join Lobby | Join lobby via kode |
| `/pvp/lobby/[code]` | Lobby Waiting | Ruang tunggu lobby |
| `/pvp/game/[lobbyId]` | PvP Game | Gameplay PvP |
| `/pvp/result/[lobbyId]` | PvP Result | Hasil pertandingan PvP |
| `/progress-stats` | Progress Stats | Statistik belajar detail |
| `/settings` | Settings | Pengaturan user |
