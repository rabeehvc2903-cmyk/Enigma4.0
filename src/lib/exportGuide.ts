export const SUPABASE_SCHEMA_SQL = `-- Madani College Art Fest Database Schema with RLS Policies & Roles

-- 1. ENUMS & EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. GROUPS TABLE
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    leader_name TEXT NOT NULL,
    leader_id TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#ffbe0b',
    total_points INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. USER ROLES TABLE (Separate table for security-definer helper)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'leader', 'participant')),
    UNIQUE(user_id, role)
);

-- SECURITY DEFINER FUNCTION FOR ROLE CHECKS
CREATE OR REPLACE FUNCTION public.has_role(req_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = req_role
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    user_id_code TEXT UNIQUE NOT NULL, -- e.g. ART-2026-014 or RUBY-LEADER
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'participant',
    group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
    department TEXT,
    category TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. COMPETITIONS TABLE
CREATE TABLE IF NOT EXISTS public.competitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- Music, Dance, Fine Arts, Literary, Theatre, Media
    type TEXT NOT NULL DEFAULT 'Individual', -- Individual or Group
    is_stage BOOLEAN DEFAULT TRUE,
    venue TEXT NOT NULL,
    schedule_time TEXT NOT NULL,
    max_entries_per_group INT DEFAULT 2,
    points_1st INT DEFAULT 10,
    points_2nd INT DEFAULT 7,
    points_3rd INT DEFAULT 5,
    description TEXT,
    is_published_result BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. REGISTRATIONS TABLE
CREATE TABLE IF NOT EXISTS public.registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    competition_id UUID REFERENCES public.competitions(id) ON DELETE CASCADE,
    participant_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(competition_id, participant_id)
);

-- 7. RESULTS TABLE
CREATE TABLE IF NOT EXISTS public.results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    competition_id UUID REFERENCES public.competitions(id) ON DELETE CASCADE UNIQUE,
    first_place_reg_id UUID REFERENCES public.registrations(id) ON DELETE RESTRICT,
    second_place_reg_id UUID REFERENCES public.registrations(id) ON DELETE SET NULL,
    third_place_reg_id UUID REFERENCES public.registrations(id) ON DELETE SET NULL,
    published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ===================================================

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;

-- GROUPS: Everyone can read groups (Public Leaderboard)
CREATE POLICY "Public read groups" ON public.groups FOR SELECT USING (true);
CREATE POLICY "Admin write groups" ON public.groups FOR ALL USING (public.has_role('admin'));

-- COMPETITIONS: Public read
CREATE POLICY "Public read competitions" ON public.competitions FOR SELECT USING (true);
CREATE POLICY "Admin write competitions" ON public.competitions FOR ALL USING (public.has_role('admin'));

-- RESULTS: Public read published results
CREATE POLICY "Public read results" ON public.results FOR SELECT USING (true);
CREATE POLICY "Admin write results" ON public.results FOR ALL USING (public.has_role('admin'));

-- REGISTRATIONS: Read by public, write by leader/admin
CREATE POLICY "Read registrations" ON public.registrations FOR SELECT USING (true);
CREATE POLICY "Group leader create registrations" ON public.registrations FOR INSERT WITH CHECK (
    public.has_role('leader') OR public.has_role('admin')
);
CREATE POLICY "Leader/Admin delete registrations" ON public.registrations FOR DELETE USING (
    public.has_role('leader') OR public.has_role('admin')
);

-- PROFILES: Users read own profile or leaders read group participants
CREATE POLICY "Read profiles" ON public.profiles FOR SELECT USING (
    auth.uid() = id OR public.has_role('leader') OR public.has_role('admin')
);
CREATE POLICY "Admin or Leader manage profiles" ON public.profiles FOR ALL USING (
    public.has_role('leader') OR public.has_role('admin')
);

-- INITIAL SEED DATA
INSERT INTO public.groups (name, leader_name, leader_id, code, color) VALUES
('Ruby Group', 'Mohammed Rayan', 'RUBY-LEADER', 'RUBY', '#ff2a5f'),
('Emerald Group', 'Fathima Nasrin', 'EMER-LEADER', 'EMER', '#10b981'),
('Sapphire Group', 'Anandhu Krishna', 'SAPP-LEADER', 'SAPP', '#00f0ff'),
('Topaz Group', 'Aisha Rifa', 'TOPZ-LEADER', 'TOPZ', '#ffbe0b')
ON CONFLICT DO NOTHING;
`;

export const GITHUB_HOSTING_INSTRUCTIONS = `
# How to Upload to GitHub & Deploy to Vercel/Netlify

Follow these step-by-step instructions to host **Madani College Art Fest Manager** on GitHub and connect Supabase database backend.

---

## 1. Project Directory Structure
Ensure your files are arranged in the root folder as follows:

\`\`\`
/
├── index.html
├── metadata.json
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .env.example
├── schema.sql                   <-- (Paste the Supabase SQL schema here)
├── public/
│   └── logo.png
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css
    ├── types.ts
    ├── components/
    │   ├── Navbar.tsx
    │   ├── Footer.tsx
    │   ├── Countdown.tsx
    │   ├── PublicHome.tsx
    │   ├── CompetitionsView.tsx
    │   ├── ResultsView.tsx
    │   ├── AuthView.tsx
    │   ├── AdminDashboard.tsx
    │   ├── LeaderDashboard.tsx
    │   ├── ParticipantDashboard.tsx
    │   └── SetupGuideModal.tsx
    └── lib/
        ├── supabase.ts
        ├── store.ts
        └── exportGuide.ts
\`\`\`

---

## 2. Setup Supabase Database Backend
1. Go to [https://supabase.com](https://supabase.com) and create a free project.
2. Open your Supabase Dashboard → **SQL Editor**.
3. Create a **New Query** and paste the content from \`schema.sql\` (or copy it from the **Setup & Backend SQL** tab in this app).
4. Click **RUN** to create all tables, indexes, and Row Level Security (RLS) policies.
5. Go to **Project Settings → API** and copy:
   - **Project URL**
   - **anon / public Key**

---

## 3. Upload Code to GitHub
1. Open your terminal in the project folder and run:
   \`\`\`bash
   git init
   git add .
   git commit -m "Initial commit - Madani College Art Fest Manager"
   git branch -M main
   \`\`\`
2. Create a new repository on GitHub (e.g. \`madani-art-fest\`).
3. Link and push to your repository:
   \`\`\`bash
   git remote add origin https://github.com/YOUR_USERNAME/madani-art-fest.git
   git push -u origin main
   \`\`\`

---

## 4. Deploy for Free on Vercel
1. Log in to [https://vercel.com](https://vercel.com) with GitHub.
2. Click **Add New → Project** and import \`madani-art-fest\`.
3. Under **Environment Variables**, add:
   - \`VITE_SUPABASE_URL\` = \`https://your-project.supabase.co\`
   - \`VITE_SUPABASE_ANON_KEY\` = \`your-anon-key\`
4. Click **Deploy**. Your website will be live with full real-time database and auth persistence!
`;
