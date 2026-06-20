'use server'

import { revalidatePath } from 'next/cache'
import { supabase, createAuthClient, getStoragePublicUrl } from '@/lib/supabase'
import {
  type CafeFilters,
  type Cafe,
  type CafeRow,
  cafeSubmissionSchema,
  transformCafeRow,
} from '@/lib/schema'

// =============================================================================
// SERVER ACTION: getFilteredCafes
// =============================================================================
// Query dinamis ke Supabase dengan multi-filter menggunakan operator array PostgreSQL.
// Hanya mengembalikan cafe berstatus 'approved' (sesuai RLS policy).
// =============================================================================

export async function getFilteredCafes(filters: CafeFilters): Promise<Cafe[]> {
  const isPlaceholder = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                        process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder-project');

  if (isPlaceholder) {
    console.warn('[getFilteredCafes] Running in mock/demo mode. Set NEXT_PUBLIC_SUPABASE_URL to connect to a real database.');
    return getMockCafes(filters);
  }

  let query = supabase
    .from('cafes')
    .select('*')
    .eq('status', 'approved')
    .order('rating', { ascending: false, nullsFirst: false })
    .limit(100)

  // Filter: text search (nama atau area)
  if (filters.search && filters.search.trim() !== '') {
    const searchTerm = `%${filters.search.trim()}%`
    query = query.or(`name.ilike.${searchTerm},area.ilike.${searchTerm},description.ilike.${searchTerm}`)
  }

  // Filter: category
  if (filters.category && filters.category !== 'All') {
    query = query.eq('category', filters.category)
  }

  // Filter: price range
  if (filters.priceRange && filters.priceRange !== 'all') {
    query = query.eq('price_range', filters.priceRange)
  }

  // Filter: minimum rating
  if (filters.minRating && filters.minRating > 0) {
    query = query.gte('rating', filters.minRating)
  }

  // Filter: tags (fasilitas) — menggunakan @> (contains) operator
  // Mencari cafe yang memiliki SEMUA tags yang dipilih
  if (filters.tags && filters.tags.length > 0) {
    query = query.contains('tags', filters.tags)
  }

  // Filter: ambiance (suasana) — menggunakan @> (contains) operator
  if (filters.ambiance && filters.ambiance.length > 0) {
    query = query.contains('ambiance', filters.ambiance)
  }

  // Filter: kampus terdekat — menggunakan @> (contains) operator
  if (filters.campus && filters.campus.trim() !== '') {
    query = query.contains('nearby_campuses', [filters.campus])
  }

  // Filter: area spesifik
  if (filters.area && filters.area.trim() !== '') {
    query = query.ilike('area', `%${filters.area.trim()}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error('[getFilteredCafes] Supabase error:', error.message)
    return []
  }

  return (data as CafeRow[]).map(transformCafeRow)
}

// =============================================================================
// SERVER ACTION: submitCafe
// =============================================================================
// Menerima FormData dari form client, validasi dengan Zod, upload gambar ke
// Supabase Storage, lalu simpan cafe ke database dengan status 'pending'.
// =============================================================================

interface SubmitResult {
  success: boolean
  message: string
  errors?: Record<string, string[]>
}

export async function submitCafeAction(formData: FormData): Promise<SubmitResult> {
  const isPlaceholder = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                        process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder-project');

  if (isPlaceholder) {
    return {
      success: true,
      message: 'Demo Mode: Cafe berhasil di-submit (tidak benar-benar tersimpan di Supabase) 🎉',
    }
  }

  try {
    // Ambil access token dari form (dikirim oleh client)
    const accessToken = formData.get('access_token') as string
    if (!accessToken) {
      return { success: false, message: 'Kamu harus login dulu sebelum submit cafe! 🔐' }
    }

    // Buat authenticated client
    const authClient = createAuthClient(accessToken)

    // Verifikasi user
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return { success: false, message: 'Session expired. Coba login ulang ya! 🔄' }
    }

    // Parse tags, ambiance, dan nearby_campuses dari JSON string
    const rawTags = formData.get('tags') as string
    const rawAmbiance = formData.get('ambiance') as string
    const rawCampuses = formData.get('nearby_campuses') as string

    // Construct object untuk validasi Zod
    const rawData = {
      name: formData.get('name') as string,
      location: formData.get('location') as string,
      area: formData.get('area') as string,
      category: formData.get('category') as string,
      price_range: formData.get('price_range') as string,
      opening_hours: formData.get('opening_hours') as string,
      description: formData.get('description') as string,
      google_maps_link: (formData.get('google_maps_link') as string) || '',
      tags: rawTags ? JSON.parse(rawTags) : [],
      ambiance: rawAmbiance ? JSON.parse(rawAmbiance) : [],
      nearby_campuses: rawCampuses ? JSON.parse(rawCampuses) : [],
      rating: formData.get('rating') ? parseFloat(formData.get('rating') as string) : null,
    }

    // Validasi dengan Zod
    const parsed = cafeSubmissionSchema.safeParse(rawData)
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {}
      for (const [key, errs] of Object.entries(parsed.error.flatten().fieldErrors)) {
        if (errs) fieldErrors[key] = errs
      }
      return {
        success: false,
        message: 'Ada beberapa field yang perlu diperbaiki! 👇',
        errors: fieldErrors,
      }
    }

    // Upload image ke Supabase Storage (jika ada)
    let imageUrl = ''
    const imageFile = formData.get('image') as File | null
    if (imageFile && imageFile.size > 0) {
      // Generate unique filename
      const ext = imageFile.name.split('.').pop() || 'jpg'
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { error: uploadError } = await authClient.storage
        .from('cafe-images')
        .upload(fileName, imageFile, {
          cacheControl: '31536000', // cache 1 tahun (immutable file)
          upsert: false,
        })

      if (uploadError) {
        console.error('[submitCafe] Upload error:', uploadError.message)
        return { success: false, message: 'Gagal upload gambar. Coba file yang lebih kecil (maks 5MB). 📸' }
      }

      imageUrl = getStoragePublicUrl('cafe-images', fileName)
    }

    // Buat short description otomatis
    const shortDesc = parsed.data.description.length > 120
      ? parsed.data.description.substring(0, 120) + '...'
      : parsed.data.description

    // Insert ke database dengan status 'pending'
    const { error: insertError } = await authClient.from('cafes').insert({
      name: parsed.data.name,
      location: parsed.data.location,
      area: parsed.data.area,
      category: parsed.data.category,
      price_range: parsed.data.price_range,
      opening_hours: parsed.data.opening_hours,
      description: shortDesc,
      full_description: parsed.data.description,
      google_maps_link: parsed.data.google_maps_link || '',
      tags: parsed.data.tags,
      ambiance: parsed.data.ambiance,
      nearby_campuses: parsed.data.nearby_campuses,
      rating: parsed.data.rating,
      image_url: imageUrl,
      status: 'pending',
      created_by: user.id,
    })

    if (insertError) {
      console.error('[submitCafe] Insert error:', insertError.message)
      return { success: false, message: 'Gagal menyimpan data cafe. Coba lagi ya! 😅' }
    }

    return {
      success: true,
      message: 'Cafe berhasil di-submit! Tunggu approval dari admin ya 🎉',
    }
  } catch (e: unknown) {
    console.error('[submitCafe] Unexpected error:', e)
    return { success: false, message: 'Terjadi kesalahan. Coba lagi nanti ya! 🙏' }
  }
}

// =============================================================================
// SERVER ACTION: approveCafe
// =============================================================================
// Mengubah status cafe menjadi 'approved' dan memicu on-demand revalidation
// agar homepage menampilkan cafe baru tanpa perlu full rebuild.
// =============================================================================

export async function approveCafeAction(
  cafeId: string,
  accessToken: string
): Promise<{ success: boolean; message: string }> {
  const isPlaceholder = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                        process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder-project');

  if (isPlaceholder) {
    return { success: true, message: 'Demo Mode: Cafe berhasil di-approve! ✅' }
  }

  try {
    const authClient = createAuthClient(accessToken)

    // Verifikasi admin
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return { success: false, message: 'Unauthorized' }

    const { data: profile } = await authClient
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return { success: false, message: 'Kamu bukan admin! 🚫' }
    }

    // Update status
    const { error } = await authClient
      .from('cafes')
      .update({ status: 'approved' })
      .eq('id', cafeId)

    if (error) {
      console.error('[approveCafe] Error:', error.message)
      return { success: false, message: 'Gagal approve cafe.' }
    }

    // On-demand ISR revalidation — homepage langsung update
    revalidatePath('/')

    return { success: true, message: 'Cafe berhasil di-approve! ✅' }
  } catch (e) {
    console.error('[approveCafe] Unexpected error:', e)
    return { success: false, message: 'Terjadi kesalahan.' }
  }
}

// =============================================================================
// SERVER ACTION: rejectCafe
// =============================================================================

export async function rejectCafeAction(
  cafeId: string,
  accessToken: string
): Promise<{ success: boolean; message: string }> {
  const isPlaceholder = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                        process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder-project');

  if (isPlaceholder) {
    return { success: true, message: 'Demo Mode: Cafe di-reject. 🙅' }
  }

  try {
    const authClient = createAuthClient(accessToken)

    // Verifikasi admin
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return { success: false, message: 'Unauthorized' }

    const { data: profile } = await authClient
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return { success: false, message: 'Kamu bukan admin! 🚫' }
    }

    const { error } = await authClient
      .from('cafes')
      .update({ status: 'rejected' })
      .eq('id', cafeId)

    if (error) {
      console.error('[rejectCafe] Error:', error.message)
      return { success: false, message: 'Gagal reject cafe.' }
    }

    revalidatePath('/')

    return { success: true, message: 'Cafe di-reject. 🙅' }
  } catch (e) {
    console.error('[rejectCafe] Unexpected error:', e)
    return { success: false, message: 'Terjadi kesalahan.' }
  }
}

// =============================================================================
// SERVER ACTION: getPendingCafes (Admin Only)
// =============================================================================

export async function getPendingCafes(accessToken: string): Promise<Cafe[]> {
  const isPlaceholder = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                        process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder-project');

  if (isPlaceholder) {
    console.warn('[getPendingCafes] Running in mock/demo mode.');
    return [
      {
        id: 'mock-pending-1',
        name: 'Demo Pending Cafe (Ekstra Estetik)',
        location: 'Jl. Babarsari No.99, Babarsari',
        area: 'Babarsari',
        category: 'WFC Friendly',
        description: 'Cafe contoh yang nunggu diapprove admin. Punya kolokan dan wifi super ngebut.',
        fullDescription: 'Cafe contoh ini dibuat agar Anda bisa mengetes tombol Approve/Reject di halaman admin dashboard tanpa perlu koneksi database Supabase. Jika Anda menekan Approve, dia akan hilang dari dashboard dan terhapus secara simulasi.',
        image: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?q=80&w=800&auto=format&fit=crop',
        tags: ['wifi', 'colokan', 'outdoor', 'ac'],
        ambiance: ['tenang', 'aesthetic'],
        nearbyCampuses: ['UAJY', 'UPN Veteran'],
        priceRange: 'moderate',
        openingHours: '10:00 - 22:00',
        googleMapsLink: '',
        rating: 4.4,
        status: 'pending',
        createdBy: 'demo-user-id'
      }
    ];
  }

  try {
    const authClient = createAuthClient(accessToken)

    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return []

    const { data: profile } = await authClient
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) return []

    const { data, error } = await authClient
      .from('cafes')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[getPendingCafes] Error:', error.message)
      return []
    }

    return (data as CafeRow[]).map(transformCafeRow)
  } catch (e) {
    console.error('[getPendingCafes] Unexpected error:', e)
    return []
  }
}

// =============================================================================
// HELPER: MOCK DATA FOR DEMO MODE
// =============================================================================
function getMockCafes(filters: CafeFilters): Cafe[] {
  const mockList: Cafe[] = [
    {
      id: 'mock-1',
      name: 'Ekologi Desk & Coffee',
      location: 'Jl. Pandean Sari No.10, Condongcatur',
      area: 'Jakal',
      category: 'Workspace',
      description: 'Vibe WFC paling solid se-Jakal. Tenang, colokan berlimpah, dan kopi yang nendang buat nemenin nugas.',
      fullDescription: 'Ekologi Desk & Coffee adalah pioneer coworking space cafe di Jogja. Terletak strategis di kawasan dekat Jalan Kaliurang bawah, tempat ini menawarkan area semi-indoor yang asri di lantai satu dan lantai dua khusus coworking space yang sangat tenang, hening, dan kondusif untuk produktivitas tingkat tinggi.',
      image: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?q=80&w=800&auto=format&fit=crop',
      tags: ['wifi', 'colokan', 'indoor', 'outdoor', 'ac', 'mushola'],
      ambiance: ['tenang', 'aesthetic', 'cozy', 'minimalis'],
      nearbyCampuses: ['UGM', 'UNY'],
      priceRange: 'moderate',
      openingHours: '09:00 - 23:00',
      googleMapsLink: 'https://maps.google.com/?q=Ekologi+Desk+and+Coffee',
      rating: 4.7,
      status: 'approved',
      createdBy: null
    },
    {
      id: 'mock-2',
      name: 'Carney Co.',
      location: 'Jl. Garuni II, Kledokan, Babarsari',
      area: 'Babarsari',
      category: 'Coffee Shop',
      description: 'Aesthetic bgt dengan view sawah pinggir kota. Cocok buat nongkrong sore sambil nyari inspirasi skripsi.',
      fullDescription: 'Carney Co. memadukan arsitektur bangunan modern glasshouse dengan pemandangan sawah hijau khas Babarsari. Selain kopinya yang lezat, tempat ini memiliki area outdoor berumput yang sangat luas yang sering menjadi spot andalan mahasiswa Atma Jaya dan UPN untuk melepas penat di sore hari menjelang senja.',
      image: 'https://images.unsplash.com/photo-1498804103079-a6351b050096?q=80&w=800&auto=format&fit=crop',
      tags: ['wifi', 'colokan', 'outdoor', 'indoor', 'mushola', 'ac'],
      ambiance: ['aesthetic', 'cozy', 'tropical'],
      nearbyCampuses: ['UAJY', 'UPN Veteran', 'STIE YKPN'],
      priceRange: 'moderate',
      openingHours: '10:00 - 24:00',
      googleMapsLink: 'https://maps.google.com/?q=Carney+Co',
      rating: 4.5,
      status: 'approved',
      createdBy: null
    },
    {
      id: 'mock-3',
      name: 'Le Travail Coffee',
      location: 'Jl. Lempongsari Raya No.305, Sariharjo',
      area: 'Gejayan',
      category: 'Coffee Shop',
      description: 'Kecil tapi magis. Kopi berkualitas buat penikmat kopi garis keras, plus buka sampai larut malam.',
      fullDescription: 'Le Travail Coffee adalah salah satu coffee shop legendaris di Gejayan yang sangat disukai karena konsistensi rasa kopi specialty-nya. Area duduknya yang bergaya industrial minimalis justru menciptakan kehangatan tersendiri bagi para mahasiswa penikmat kopi yang ingin fokus membaca buku atau diskusi santai.',
      image: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?q=80&w=800&auto=format&fit=crop',
      tags: ['wifi', 'colokan', 'indoor', 'ac'],
      ambiance: ['tenang', 'cozy', 'minimalis', 'industrial'],
      nearbyCampuses: ['UNY', 'UGM', 'Sanata Dharma'],
      priceRange: 'budget-friendly',
      openingHours: '08:00 - 02:00',
      googleMapsLink: 'https://maps.google.com/?q=Le+Travail+Coffee',
      rating: 4.6,
      status: 'approved',
      createdBy: null
    },
    {
      id: 'mock-4',
      name: 'Bento Kopi Jakal',
      location: 'Jl. Kaliurang KM 12, Candi Karang',
      area: 'Jakal',
      category: 'Coffee Shop',
      description: 'Penyelamat dompet mahasiswa pas akhir bulan. Area outdoor luas luar biasa buat nobar atau nongkrong ramean.',
      fullDescription: 'Bento Kopi dikenal luas sebagai tempat nongkrong terpopuler dengan harga ramah kantong mahasiswa. Area outdoor-nya sangat lapang dan dikelilingi pohon rindang, menjadikannya pilihan favorit untuk kumpul organisasi, nobar sepak bola, atau sekadar obrolan santai hingga tengah malam.',
      image: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=800&auto=format&fit=crop',
      tags: ['wifi', 'colokan', 'outdoor', 'live music', 'mushola'],
      ambiance: ['ramai', 'cozy'],
      nearbyCampuses: ['UGM', 'UNY', 'UII'],
      priceRange: 'budget-friendly',
      openingHours: '09:00 - 01:00',
      googleMapsLink: 'https://maps.google.com/?q=Bento+Kopi+Jakal',
      rating: 4.2,
      status: 'approved',
      createdBy: null
    }
  ];

  return mockList.filter(cafe => {
    if (filters.search && !cafe.name.toLowerCase().includes(filters.search.toLowerCase()) && !cafe.area.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.category && filters.category !== 'All' && cafe.category !== filters.category) return false;
    if (filters.priceRange && filters.priceRange !== 'all' && cafe.priceRange !== filters.priceRange) return false;
    if (filters.minRating && cafe.rating !== null && cafe.rating < filters.minRating) return false;
    if (filters.tags && filters.tags.length > 0 && !filters.tags.every(t => cafe.tags.includes(t))) return false;
    if (filters.ambiance && filters.ambiance.length > 0 && !filters.ambiance.every(a => cafe.ambiance.includes(a))) return false;
    if (filters.campus && !cafe.nearbyCampuses.includes(filters.campus)) return false;
    if (filters.area && !cafe.area.toLowerCase().includes(filters.area.toLowerCase())) return false;
    return true;
  });
}
