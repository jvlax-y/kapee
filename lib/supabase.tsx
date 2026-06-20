import { createClient } from '@supabase/supabase-js'

// =============================================================================
// Supabase Client — Singleton untuk penggunaan di seluruh aplikasi
// =============================================================================
// Client ini menggunakan Anon Key (public) dan bisa dipakai di:
//   - Server Components (SSR/ISR)
//   - Server Actions
//   - Client Components (browser)
//
// Untuk operasi yang memerlukan authenticated user (insert, update),
// gunakan createClient dengan session/token dari Supabase Auth di sisi client.
// =============================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

// Koneksi utama (Anon Key) — bisa dipakai di server & client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Membuat Supabase client baru dengan access token dari session user.
 * Digunakan di Server Actions agar RLS mengenali user yang sedang login.
 */
export function createAuthClient(accessToken: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })
}

/**
 * Helper: Mendapatkan public URL dari file di Supabase Storage.
 * Digunakan untuk menampilkan gambar cafe tanpa signed URL.
 */
export function getStoragePublicUrl(bucket: string, path: string): string {
  if (!path) return ''
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}