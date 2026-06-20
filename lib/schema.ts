import { z } from 'zod'

// =============================================================================
// TYPES — Cafe & Filter Types
// =============================================================================

/** Status cafe dalam approval queue */
export type CafeStatus = 'pending' | 'approved' | 'rejected'

/** Tipe data cafe dari database Supabase */
export interface CafeRow {
  id: string
  name: string
  location: string
  area: string
  category: string
  description: string
  full_description: string
  image_url: string
  tags: string[]
  ambiance: string[]
  nearby_campuses: string[]
  price_range: string
  opening_hours: string
  google_maps_link: string
  rating: number | null
  status: CafeStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

/** Tipe data cafe yang sudah di-transform untuk frontend */
export interface Cafe {
  id: string
  name: string
  location: string
  area: string
  category: string
  description: string
  fullDescription: string
  image: string
  tags: string[]
  ambiance: string[]
  nearbyCampuses: string[]
  priceRange: string
  openingHours: string
  googleMapsLink: string
  rating: number | null
  status: CafeStatus
  createdBy: string | null
}

/** Parameter filter untuk query cafes */
export interface CafeFilters {
  search?: string
  category?: string
  priceRange?: string
  minRating?: number
  tags?: string[]
  ambiance?: string[]
  campus?: string
  area?: string
}

// =============================================================================
// ZOD SCHEMAS — Validasi type-safe untuk form input
// =============================================================================

/** Daftar kategori cafe yang valid */
export const CAFE_CATEGORIES = [
  'Cozy', 'WFC Friendly', 'Trendy', 'Budget Friendly', 'Professional',
] as const

/** Daftar price range yang valid */
export const PRICE_RANGES = [
  'budget-friendly', 'moderate', 'premium',
] as const

/** Daftar tags/fasilitas yang valid */
export const FACILITY_TAGS = [
  'wifi', 'colokan', 'quiet', 'outdoor', 'indoor',
  'live music', 'instagrammable', 'student friendly',
  'work friendly', 'pet friendly', 'smoking area',
  'meeting room', 'projector', 'ac',
] as const

/** Daftar suasana/ambiance yang valid */
export const AMBIANCE_OPTIONS = [
  'tenang', 'ramai', 'aesthetic', 'vintage',
  'industrial', 'minimalis', 'cozy', 'tropical',
  'rooftop', 'garden',
] as const

/** Daftar kampus yang populer di Jogja */
export const NEARBY_CAMPUSES = [
  'UGM', 'UNY', 'UII', 'UPN Veteran', 'UAJY',
  'Sanata Dharma', 'STIE YKPN', 'UTY', 'UMY',
  'UAD', 'ISI Yogyakarta', 'AMIKOM', 'STMM MMTC',
] as const

/** Zod schema untuk validasi form submission cafe baru */
export const cafeSubmissionSchema = z.object({
  name: z
    .string()
    .min(2, 'Nama cafe minimal 2 karakter ya!')
    .max(100, 'Nama cafe kepanjangan nih, maks 100 karakter.'),

  location: z
    .string()
    .min(5, 'Alamat lengkapnya dong, minimal 5 karakter.'),

  area: z
    .string()
    .min(2, 'Area/wilayah perlu diisi, misal: Seturan, Jakal.'),

  category: z
    .enum(CAFE_CATEGORIES, {
      message: 'Pilih salah satu kategori ya.',
    }),

  price_range: z
    .enum(PRICE_RANGES, {
      message: 'Pilih range harga yang sesuai.',
    }),

  opening_hours: z
    .string()
    .min(3, 'Isi jam bukanya, misal: 08:00 - 22:00'),

  description: z
    .string()
    .min(20, 'Deskripsi minimal 20 karakter supaya orang lain paham vibes-nya.')
    .max(2000, 'Deskripsi terlalu panjang, maks 2000 karakter.'),

  google_maps_link: z
    .string()
    .url('Link Google Maps-nya harus URL yang valid.')
    .refine(
      (val) => {
        const lower = val.toLowerCase()
        return lower.includes('google') || lower.includes('goo.gl') || lower.includes('maps')
      },
      'Pastikan ini link dari Google Maps ya!'
    )
    .or(z.literal('')),

  tags: z
    .array(z.string())
    .min(1, 'Pilih minimal 1 fasilitas.'),

  ambiance: z
    .array(z.string())
    .min(1, 'Pilih minimal 1 suasana.'),

  nearby_campuses: z
    .array(z.string())
    .default([]),

  rating: z
    .number()
    .min(0)
    .max(5)
    .nullable()
    .default(null),
})

/** Tipe inferensi dari schema submission */
export type CafeSubmissionInput = z.infer<typeof cafeSubmissionSchema>

// =============================================================================
// HELPER: Transform data dari Supabase row ke frontend Cafe type
// =============================================================================
export function transformCafeRow(row: CafeRow): Cafe {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    area: row.area,
    category: row.category,
    description: row.description,
    fullDescription: row.full_description || row.description,
    image: row.image_url || '',
    tags: row.tags || [],
    ambiance: row.ambiance || [],
    nearbyCampuses: row.nearby_campuses || [],
    priceRange: row.price_range,
    openingHours: row.opening_hours,
    googleMapsLink: row.google_maps_link,
    rating: typeof row.rating === 'string' ? parseFloat(row.rating) : row.rating,
    status: row.status,
    createdBy: row.created_by,
  }
}
