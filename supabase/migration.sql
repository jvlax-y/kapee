-- =============================================================================
-- JOGJA CAFE FINDER — Supabase Migration Script
-- =============================================================================
-- Jalankan script ini di Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- Script ini IDEMPOTENT — aman dijalankan berulang kali.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. ENUM TYPE: cafe_status
-- ---------------------------------------------------------------------------
-- Digunakan untuk moderasi/approval queue.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cafe_status') THEN
    CREATE TYPE cafe_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 2. TABEL: profiles
-- ---------------------------------------------------------------------------
-- Menyimpan data user yang terhubung dengan Supabase Auth.
-- Kolom `is_admin` digunakan untuk proteksi halaman /admin/dashboard.
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT,
  full_name   TEXT,
  avatar_url  TEXT,
  is_admin    BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Aktifkan RLS pada tabel profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies untuk profiles
-- Semua user bisa melihat profil (untuk menampilkan nama kontributor)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Profiles: public read'
  ) THEN
    CREATE POLICY "Profiles: public read"
      ON profiles FOR SELECT
      USING (true);
  END IF;
END
$$;

-- User hanya bisa mengupdate profil miliknya sendiri
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Profiles: self update'
  ) THEN
    CREATE POLICY "Profiles: self update"
      ON profiles FOR UPDATE
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 3. TRIGGER: Auto-create profile saat user signup
-- ---------------------------------------------------------------------------
-- Ketika user baru mendaftar via Supabase Auth (Google OAuth, dll),
-- otomatis membuat baris di tabel profiles.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    full_name  = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Revoke default public execution access to handle_new_user to make it secure
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- Drop trigger dulu kalau sudah ada, lalu buat ulang
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 4. TABEL: cafes (ALTER / CREATE)
-- ---------------------------------------------------------------------------
-- Menambahkan kolom-kolom baru jika tabel sudah ada.
-- Jika tabel belum ada, buat dari awal.

-- Cek apakah tabel cafes sudah ada, jika belum buat lengkap
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cafes' AND table_schema = 'public') THEN
    CREATE TABLE public.cafes (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name              TEXT NOT NULL,
      location          TEXT NOT NULL,
      area              TEXT NOT NULL DEFAULT '',
      category          TEXT NOT NULL DEFAULT '',
      description       TEXT DEFAULT '',
      full_description  TEXT DEFAULT '',
      image_url         TEXT DEFAULT '',

      -- Array columns untuk multi-filtering
      tags              TEXT[] DEFAULT '{}',
      ambiance          TEXT[] DEFAULT '{}',
      nearby_campuses   TEXT[] DEFAULT '{}',

      -- Metadata
      price_range       TEXT DEFAULT 'moderate',
      opening_hours     TEXT DEFAULT '',
      google_maps_link  TEXT DEFAULT '',
      rating            NUMERIC(2,1) DEFAULT NULL,

      -- Moderation / Approval Queue
      status            cafe_status DEFAULT 'pending',
      created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,

      -- Timestamps
      created_at        TIMESTAMPTZ DEFAULT now(),
      updated_at        TIMESTAMPTZ DEFAULT now()
    );
  END IF;
END
$$;

-- Jika tabel sudah ada, tambahkan kolom-kolom baru yang mungkin belum ada
DO $$
BEGIN
  -- Kolom ambiance (text array untuk suasana: tenang, aesthetic, bising, dll)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cafes' AND column_name = 'ambiance' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.cafes ADD COLUMN ambiance TEXT[] DEFAULT '{}';
  END IF;

  -- Kolom nearby_campuses (text array untuk kampus terdekat)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cafes' AND column_name = 'nearby_campuses' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.cafes ADD COLUMN nearby_campuses TEXT[] DEFAULT '{}';
  END IF;

  -- Kolom status (enum cafe_status)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cafes' AND column_name = 'status' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.cafes ADD COLUMN status cafe_status DEFAULT 'approved';
    -- Default 'approved' agar data lama tetap muncul
  END IF;

  -- Kolom created_by (UUID referensi ke auth.users)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cafes' AND column_name = 'created_by' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.cafes ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  -- Kolom updated_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cafes' AND column_name = 'updated_at' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.cafes ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
  END IF;

  -- Pastikan kolom tags bertipe text[] (jika sudah ada tapi bukan array)
  -- Catatan: Jika kolom tags sudah text[], ALTER ini akan di-skip
  -- Jika kolom tags belum ada sama sekali, tambahkan
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cafes' AND column_name = 'tags' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.cafes ADD COLUMN tags TEXT[] DEFAULT '{}';
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 5. INDEXES untuk performa query filtering
-- ---------------------------------------------------------------------------
-- GIN index pada kolom array agar operator @> (contains) cepat
CREATE INDEX IF NOT EXISTS idx_cafes_tags ON public.cafes USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_cafes_ambiance ON public.cafes USING GIN (ambiance);
CREATE INDEX IF NOT EXISTS idx_cafes_nearby_campuses ON public.cafes USING GIN (nearby_campuses);

-- Index pada kolom filter umum
CREATE INDEX IF NOT EXISTS idx_cafes_status ON public.cafes (status);
CREATE INDEX IF NOT EXISTS idx_cafes_category ON public.cafes (category);
CREATE INDEX IF NOT EXISTS idx_cafes_area ON public.cafes (area);
CREATE INDEX IF NOT EXISTS idx_cafes_price_range ON public.cafes (price_range);
CREATE INDEX IF NOT EXISTS idx_cafes_rating ON public.cafes (rating DESC NULLS LAST);

-- Composite index untuk query yang paling umum (homepage: approved + rating desc)
CREATE INDEX IF NOT EXISTS idx_cafes_approved_rating
  ON public.cafes (status, rating DESC NULLS LAST)
  WHERE status = 'approved';

-- ---------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) pada tabel cafes
-- ---------------------------------------------------------------------------
ALTER TABLE public.cafes ENABLE ROW LEVEL SECURITY;

-- Drop semua policy lama agar bisa di-recreate (idempotent)
DROP POLICY IF EXISTS "Cafes: public read approved" ON public.cafes;
DROP POLICY IF EXISTS "Cafes: authenticated insert" ON public.cafes;
DROP POLICY IF EXISTS "Cafes: admin update" ON public.cafes;
DROP POLICY IF EXISTS "Cafes: admin delete" ON public.cafes;
DROP POLICY IF EXISTS "Cafes: admin read all" ON public.cafes;

-- POLICY 1: Siapapun (anonim / authenticated) bisa SELECT cafe yang sudah approved
CREATE POLICY "Cafes: public read approved"
  ON public.cafes FOR SELECT
  USING (status = 'approved');

-- POLICY 2: Admin bisa SELECT SEMUA cafe (termasuk pending & rejected)
-- Ini penting agar halaman /admin/dashboard bisa menampilkan antrean
CREATE POLICY "Cafes: admin read all"
  ON public.cafes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
    )
  );

-- POLICY 3: User yang sudah login bisa INSERT cafe baru (status otomatis 'pending')
CREATE POLICY "Cafes: authenticated insert"
  ON public.cafes FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- POLICY 4: Hanya admin yang bisa UPDATE cafe (untuk approve/reject)
CREATE POLICY "Cafes: admin update"
  ON public.cafes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
    )
  );

-- POLICY 5: Hanya admin yang bisa DELETE cafe
CREATE POLICY "Cafes: admin delete"
  ON public.cafes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
    )
  );

-- ---------------------------------------------------------------------------
-- 7. TRIGGER: Auto-update `updated_at` pada cafes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Revoke public execution to ensure search path and function execute safety
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC;

DROP TRIGGER IF EXISTS set_updated_at ON public.cafes;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.cafes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 8. STORAGE BUCKET: cafe-images (Public Bucket)
-- ---------------------------------------------------------------------------
-- Buat bucket public untuk gambar cafe. Public bucket = no signed URL needed,
-- gambar bisa diakses langsung via URL, maksimal performa rendering.
--
-- CATATAN: Pembuatan bucket via SQL terbatas. Jalankan ini di Supabase Dashboard:
--   1. Buka Storage > New Bucket
--   2. Nama: "cafe-images"
--   3. Centang "Public bucket"
--   4. File size limit: 5MB
--   5. Allowed MIME types: image/jpeg, image/png, image/webp, image/avif
--
-- Atau gunakan SQL berikut (hanya bekerja jika extension storage sudah aktif):
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cafe-images',
  'cafe-images',
  TRUE,
  5242880,  -- 5MB dalam bytes
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO UPDATE SET
  public = TRUE,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

-- Storage policies:
-- CATATAN: Untuk public bucket, files dapat diakses secara publik via URL download
-- tanpa memerlukan SELECT RLS policy. Kita hapus SELECT policy untuk mencegah listing.
DROP POLICY IF EXISTS "Cafe images: public read" ON storage.objects;

DROP POLICY IF EXISTS "Cafe images: authenticated upload" ON storage.objects;
CREATE POLICY "Cafe images: authenticated upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'cafe-images'
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "Cafe images: admin delete" ON storage.objects;
CREATE POLICY "Cafe images: admin delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'cafe-images'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
    )
  );

-- ---------------------------------------------------------------------------
-- 9. SEED DATA: Update data lama agar kompatibel
-- ---------------------------------------------------------------------------
-- Set semua cafe yang sudah ada (tanpa status) menjadi 'approved'
UPDATE public.cafes SET status = 'approved' WHERE status IS NULL;

-- Contoh mapping nearby_campuses untuk area yang populer di kalangan mahasiswa Jogja
-- (Jalankan hanya jika data lama belum punya nearby_campuses)
UPDATE public.cafes SET nearby_campuses = ARRAY['UPN Veteran', 'STIE YKPN', 'UAJY']
  WHERE LOWER(area) LIKE '%seturan%' AND (nearby_campuses IS NULL OR nearby_campuses = '{}');

UPDATE public.cafes SET nearby_campuses = ARRAY['UPN Veteran', 'UAJY', 'UTY']
  WHERE LOWER(area) LIKE '%babarsari%' AND (nearby_campuses IS NULL OR nearby_campuses = '{}');

UPDATE public.cafes SET nearby_campuses = ARRAY['UGM', 'UNY']
  WHERE (LOWER(area) LIKE '%jakal%' OR LOWER(area) LIKE '%kaliurang%')
  AND (nearby_campuses IS NULL OR nearby_campuses = '{}');

UPDATE public.cafes SET nearby_campuses = ARRAY['UGM', 'UNY', 'Sanata Dharma']
  WHERE (LOWER(area) LIKE '%gejayan%' OR LOWER(area) LIKE '%demangan%' OR LOWER(area) LIKE '%colombo%')
  AND (nearby_campuses IS NULL OR nearby_campuses = '{}');

UPDATE public.cafes SET nearby_campuses = ARRAY['UGM']
  WHERE (LOWER(area) LIKE '%pogung%' OR LOWER(area) LIKE '%sendowo%' OR LOWER(area) LIKE '%bulaksumur%')
  AND (nearby_campuses IS NULL OR nearby_campuses = '{}');

UPDATE public.cafes SET nearby_campuses = ARRAY['UII']
  WHERE (LOWER(area) LIKE '%condong%' OR LOWER(area) LIKE '%condongcatur%')
  AND (nearby_campuses IS NULL OR nearby_campuses = '{}');

UPDATE public.cafes SET nearby_campuses = ARRAY['ISI Yogyakarta', 'UGM']
  WHERE LOWER(area) LIKE '%sewon%'
  AND (nearby_campuses IS NULL OR nearby_campuses = '{}');

UPDATE public.cafes SET nearby_campuses = ARRAY['UMY', 'UAD']
  WHERE (LOWER(area) LIKE '%tamantirto%' OR LOWER(area) LIKE '%kasihan%' OR LOWER(area) LIKE '%bantul%')
  AND (nearby_campuses IS NULL OR nearby_campuses = '{}');

-- ---------------------------------------------------------------------------
-- ✅ MIGRATION SELESAI
-- ---------------------------------------------------------------------------
-- Langkah selanjutnya setelah menjalankan migration ini:
-- 1. Buat user admin pertama di Supabase Dashboard:
--    UPDATE profiles SET is_admin = TRUE WHERE email = 'email_admin@gmail.com';
-- 2. Aktifkan Google OAuth di Supabase Auth > Providers > Google
-- 3. Set Site URL dan Redirect URLs di Authentication > URL Configuration
-- ---------------------------------------------------------------------------
