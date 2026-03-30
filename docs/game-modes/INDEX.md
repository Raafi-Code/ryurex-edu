# Game Modes Documentation Index

Dokumentasi lengkap untuk game modes architecture dan implementation.

## 📚 File Dokumentasi

### 1. **STRUCTURE.md**
Menjelaskan struktur folder dan quick reference untuk:
- Folder hierarchy dengan deskripsi
- Shared components dan hooks
- Game mode explanations
- Backward compatibility
- Cara menambah game mode baru

**Untuk membaca**: Ketika perlu memahami struktur project
**File path**: `/docs/game-modes/STRUCTURE.md`

### 2. **REFACTORING.md**
Dokumentasi detail tentang refactoring yang dilakukan:
- Sebelum dan sesudah comparison
- Duplikasi yang dihapus
- Statistik pengurangan kode
- Files ready for deletion
- Key learnings

**Untuk membaca**: Ketika perlu memahami history dan perubahan
**File path**: `/docs/game-modes/REFACTORING.md`

### 3. **SHARED_API.md**
Dokumentasi API untuk shared utilities dan components:
- Hook signatures dan usage
- Utility function specs
- Component props dan examples
- Type definitions

**Untuk membaca**: Ketika develop game mode baru
**File path**: `/docs/game-modes/SHARED_API.md`

### 4. **INDEX.md** (this file)
Quick navigation index untuk semua dokumentasi

## 🎮 Game Modes Quick Reference

| Mode | Folder | Purpose | URL |
|------|--------|---------|-----|
| Vocab Translation | `vocab-translation/` | Terjemahkan vocab dari ID ke EN | `/vocabgame` |
| Spaced Repetition | `spaced-repetition/` | Review with SRS system | `/review-mode` |
| AI Sentence Completion | `ai-sentence-completion/` | Complete AI-generated sentences | `/ai-mode` |
| Sentence Ordering | `sentence-ordering/` | Order scrambled words correctly | `/sentence-box-mode` |

## 🛠️ Common Tasks

### Menambah Game Mode Baru
1. Baca [STRUCTURE.md - Menambahkan Game Mode Baru](STRUCTURE.md#menambahkan-game-mode-baru)
2. Gunakan struktur template
3. Import dari `../shared`
4. Update backward compat file jika ada URL change

### Modifikasi Shared Component
1. Edit file di `/app/game-modes/shared/`
2. Check [SHARED_API.md](SHARED_API.md) untuk signature
3. Test di semua 4 game modes
4. Update documentation jika interface berubah

### Understand Refactoring History
1. Baca [REFACTORING.md](REFACTORING.md) untuk full context
2. Check "Files Ready for Deletion" section
3. Verify backward compatibility sebelum delete

### Debug Game Mode
1. Check STRUCTURE.md untuk understanding architecture
2. Check SHARED_API.md untuk understanding imports
3. Trace calls ke shared utilities

## 📁 File Organization

```
/docs/game-modes/
├── INDEX.md                    # This file (navigation)
├── STRUCTURE.md               # Architecture & folder structure
├── REFACTORING.md             # History & detailed changes
└── SHARED_API.md              # API reference for shared utils

/app/game-modes/
├── shared/
│   ├── gameHooks.ts          # Custom hooks
│   ├── gameUtils.ts          # Utility functions
│   ├── GameNavbar.tsx        # Navbar component
│   ├── ProgressBar.tsx       # Progress bar component
│   ├── GameResultModal.tsx   # Result modal component
│   └── index.ts              # Export barrel file
│
├── vocab-translation/        # Vocabulary translation game
├── spaced-repetition/        # Review with spaced repetition
├── ai-sentence-completion/   # AI sentence completion game
└── sentence-ordering/        # Sentence word ordering game
```

## 🔗 Related Documentation

- **PvP Mode**: `/github/copilot-instructions.md` (Game Flow section)
- **Database Schema**: `/docs/DATABASE_SCHEMA.md`
- **Game Flow**: `/docs/GAME_FLOW.md`

## ✅ Checklist untuk Developer Baru

- [ ] Read STRUCTURE.md to understand folder organization
- [ ] Explore shared components in `/app/game-modes/shared/`
- [ ] Review one game mode implementation (e.g., vocab-translation)
- [ ] Read SHARED_API.md untuk API reference
- [ ] Understand backward compatibility routing
- [ ] Check REFACTORING.md untuk context dan history

## 🚀 Quick Start

### Untuk understand existing modes:
```
STRUCTURE.md → Pick a mode → Check imports → Read shared components
```

### Untuk create baru mode:
```
STRUCTURE.md→ Template → SHARED_API.md →implement → test → update docs
```

### Untuk modify shared component:
```
SHARED_API.md → Edit file → Test in all 4 modes → Update docs
```

## 📞 Questions?

- **What's the folder structure?** → STRUCTURE.md
- **What changed in refactoring?** → REFACTORING.md
- **How do I use GameNavbar?** → SHARED_API.md
- **How do I add new mode?** → STRUCTURE.md + SHARED_API.md

## 📝 Updates & Maintenance

Dokumentasi ini diupdate setiap kali ada:
- Perubahan struktur folder
- Penambahan shared component
- Perubahan API signatures
- Penambahan game mode baru

Last updated: January 2026
