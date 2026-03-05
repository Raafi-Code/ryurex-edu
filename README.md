# 🎓 RyuLearn

An adaptive English vocabulary learning platform with multiple game modes, AI-powered exercises, and spaced repetition. Built with Next.js 16 and Supabase.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?logo=tailwindcss)
![Supabase](https://img.shields.io/badge/Supabase-Auth_%26_DB-3fcf8e?logo=supabase)

## ✨ Features

### 🎮 Game Modes
- **Vocab Translation** — Translate Indonesian words to English with synonym support
- **Fill the Word** — Complete sentences by filling in missing vocabulary
- **Spaced Repetition** — Smart review system that adapts to your memory patterns
- **Sentence Ordering** — Rearrange shuffled words into correct sentence order
- **AI Sentence Completion** — AI-generated sentence exercises powered by Groq

### ⚔️ PvP Mode
- Create or join multiplayer rooms
- Real-time vocabulary battles with friends
- Lobby system with game results

### 📊 Progress & Analytics
- Detailed stats dashboard with Recharts visualizations
- XP and leveling system
- Category-based progress tracking
- Leaderboard with global rankings

### 🎯 Other Features
- 🔐 Secure authentication (Supabase Auth)
- 🌙 Dark / Light theme toggle
- 📱 Responsive design (mobile-first)
- 🗂️ Category & subcategory system with Oxford-level classification
- 🤖 AI-powered content generation via Groq SDK

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router, Turbopack) |
| **Language** | [TypeScript 5](https://www.typescriptlang.org/) |
| **Styling** | [Tailwind CSS 4](https://tailwindcss.com/) |
| **UI Components** | [shadcn/ui](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/) |
| **Animations** | [Framer Motion](https://www.framer.com/motion/) |
| **Icons** | [Lucide React](https://lucide.dev/) |
| **Charts** | [Recharts](https://recharts.org/) |
| **Auth & Database** | [Supabase](https://supabase.com/) |
| **AI** | [Groq SDK](https://groq.com/) |

## 🏗️ Project Structure

```
RyuLearn/
├── app/
│   ├── api/                    # API routes
│   │   ├── ai/                 # AI-powered endpoints
│   │   ├── getBatch/           # Vocab batch fetching
│   │   ├── getCustomBatch/     # Custom batch queries
│   │   ├── categories/         # Category management
│   │   ├── subcategories/      # Subcategory queries
│   │   ├── fill-the-word/      # Fill-the-word game API
│   │   ├── submit/             # Answer submission
│   │   ├── submitBatch/        # Batch submission
│   │   ├── leaderboard/        # Leaderboard data
│   │   ├── pvp/                # PvP game APIs
│   │   ├── userStats/          # User statistics
│   │   └── updateDisplayName/  # Profile update
│   ├── auth/                   # Auth callback
│   ├── category-menu/          # Category selection page
│   ├── dashboard/              # User dashboard
│   ├── game-modes/             # All game mode pages
│   │   ├── shared/             # Shared game components
│   │   ├── vocab-translation/
│   │   ├── fill-the-word/
│   │   ├── spaced-repetition/
│   │   ├── sentence-ordering/
│   │   └── ai-sentence-completion/
│   ├── login/                  # Login page
│   ├── signup/                 # Sign up page
│   ├── forgot-password/        # Password recovery
│   ├── update-password/        # Password update
│   ├── progress-stats/         # Progress analytics
│   ├── pvp/                    # PvP multiplayer
│   ├── settings/               # User settings
│   ├── globals.css             # Global styles
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Landing page
├── components/                 # Shared UI components
│   ├── ui/                     # shadcn/ui components
│   ├── Navbar.tsx
│   ├── Hero.tsx
│   ├── AnimatedBackground.tsx
│   └── ...
├── context/                    # React context providers
├── lib/                        # Utilities & config
│   ├── supabase/               # Supabase client (browser, server, middleware)
│   ├── rateLimit.ts
│   ├── security.ts
│   └── utils.ts
├── public/                     # Static assets & images
│   └── images/categories/      # Category illustrations (SVG)
└── supabase/                   # Supabase config & migrations
    ├── config.toml
    ├── migrations/             # SQL migration files
    └── seed_example.sql        # Example seed data
```

## 🛠️ Getting Started

### Prerequisites
- Node.js 18+
- npm
- A [Supabase](https://supabase.com/) project
- A [Groq](https://console.groq.com/) API key (for AI features)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/RyuLearn.git
   cd RyuLearn
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   Fill in your Supabase URL, anon key, and Groq API key in `.env.local`.

4. **Set up the database:**
   - Run the SQL migrations from `supabase/migrations/` in your Supabase dashboard
   - Optionally seed data using `supabase/seed_example.sql`

5. **Start the development server:**
   ```bash
   npm run dev
   ```

6. **Open** [http://localhost:3000](http://localhost:3000)

## 📱 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with Turbopack |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## 🎨 Design System

- **Dark Theme**: `#0f1115` base with glassmorphism effects
- **Primary Accent**: `#fee801` (Yellow)
- **Secondary Accent**: `#7c5cff` (Purple)
- **Typography**: Inter (sans), Poppins (display)
- **Animations**: Framer Motion with micro-interactions

## 🗺️ Roadmap

- [x] Landing page with animated hero
- [x] Authentication (login, signup, password recovery)
- [x] Dashboard with category grid
- [x] 5 game modes
- [x] PvP multiplayer
- [x] Progress stats & leaderboard
- [x] Category & subcategory system
- [x] AI-powered exercises (Groq)
- [x] Dark/Light theme
- [ ] Mobile app (React Native)
- [ ] Social features (friends, challenges)
- [ ] More languages support

## 📄 License

This project is licensed under the MIT License.

## 👤 Author

**Ryurex**

---

Built with 💜 for better learning
