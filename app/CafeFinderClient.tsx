'use client'

import React, { useState, useEffect, useCallback, useTransition, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { getFilteredCafes, submitCafeAction } from '@/app/actions/cafes'
import LoginModal from '@/app/components/LoginModal'
import type { Cafe, CafeFilters } from '@/lib/schema'
import {
  FACILITY_TAGS, AMBIANCE_OPTIONS, NEARBY_CAMPUSES,
  CAFE_CATEGORIES, PRICE_RANGES,
} from '@/lib/schema'
import {
  Search, MapPin, Coffee, Plus, Star, DollarSign, Clock, X, Filter,
  Moon, Sun, Heart, CircleCheck, CircleAlert, Sparkles,
  Building2, ChevronDown, Loader2, Upload, ExternalLink,
} from 'lucide-react'
import type { Session } from '@supabase/supabase-js'

// =============================================================================
// CafeFinderClient — Main interactive client component
// =============================================================================

interface CafeFinderClientProps {
  initialCafes: Cafe[]
}

export default function CafeFinderClient({ initialCafes }: CafeFinderClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // Auth state
  const [session, setSession] = useState<Session | null>(null)
  const [showLoginModal, setShowLoginModal] = useState(false)

  // Data state
  const [cafes, setCafes] = useState<Cafe[]>(initialCafes)
  const [loading, setLoading] = useState(false)

  // UI state
  const [darkMode, setDarkMode] = useState(false)
  const [bookmarks, setBookmarks] = useState<string[]>([])
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedCafe, setSelectedCafe] = useState<Cafe | null>(null)

  // Filter state (initialized from URL)
  const [filters, setFilters] = useState<CafeFilters>({
    search: searchParams.get('q') || '',
    category: searchParams.get('category') || 'All',
    priceRange: searchParams.get('price') || 'all',
    minRating: searchParams.get('rating') ? parseFloat(searchParams.get('rating')!) : 0,
    tags: searchParams.get('tags') ? searchParams.get('tags')!.split(',') : [],
    ambiance: searchParams.get('ambiance') ? searchParams.get('ambiance')!.split(',') : [],
    campus: searchParams.get('campus') || '',
  })

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ─── Auth listener ─────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  // ─── Dark mode & bookmarks from localStorage ──────────────────
  useEffect(() => {
    const saved = localStorage.getItem('darkMode') === 'true'
    const savedBm = JSON.parse(localStorage.getItem('bookmarks') || '[]')
    setDarkMode(saved)
    setBookmarks(savedBm)
    if (saved) document.documentElement.classList.add('dark')
  }, [])

  // ─── Sync filters → URL & fetch ───────────────────────────────
  const syncAndFetch = useCallback((f: CafeFilters) => {
    // Build URL params
    const params = new URLSearchParams()
    if (f.search) params.set('q', f.search)
    if (f.category && f.category !== 'All') params.set('category', f.category)
    if (f.priceRange && f.priceRange !== 'all') params.set('price', f.priceRange)
    if (f.minRating && f.minRating > 0) params.set('rating', String(f.minRating))
    if (f.tags && f.tags.length > 0) params.set('tags', f.tags.join(','))
    if (f.ambiance && f.ambiance.length > 0) params.set('ambiance', f.ambiance.join(','))
    if (f.campus) params.set('campus', f.campus)

    const qs = params.toString()
    router.replace(qs ? `/?${qs}` : '/', { scroll: false })

    // Fetch with server action
    startTransition(async () => {
      setLoading(true)
      const data = await getFilteredCafes(f)
      setCafes(data)
      setLoading(false)
    })
  }, [router, startTransition])

  // ─── Debounced filter change handler ───────────────────────────
  const updateFilters = useCallback((partial: Partial<CafeFilters>) => {
    setFilters(prev => {
      const next = { ...prev, ...partial }
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => syncAndFetch(next), 300)
      return next
    })
  }, [syncAndFetch])

  // ─── Dark mode toggle ─────────────────────────────────────────
  const toggleDarkMode = () => {
    const next = !darkMode
    setDarkMode(next)
    localStorage.setItem('darkMode', String(next))
    document.documentElement.classList.toggle('dark', next)
  }

  // ─── Bookmark toggle ──────────────────────────────────────────
  const toggleBookmark = (id: string) => {
    setBookmarks(prev => {
      const next = prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
      localStorage.setItem('bookmarks', JSON.stringify(next))
      return next
    })
  }

  // ─── Reset all filters ────────────────────────────────────────
  const resetFilters = () => {
    const cleared: CafeFilters = {
      search: '', category: 'All', priceRange: 'all', minRating: 0,
      tags: [], ambiance: [], campus: '',
    }
    setFilters(cleared)
    setShowBookmarksOnly(false)
    syncAndFetch(cleared)
  }

  // ─── Handle cafe card click (Gated content) ───────────────────
  const handleCafeClick = (cafe: Cafe) => {
    if (!session) {
      setShowLoginModal(true)
    } else {
      setSelectedCafe(cafe)
    }
  }

  // ─── Display cafes (with bookmark filter) ─────────────────────
  const displayCafes = showBookmarksOnly
    ? cafes.filter(c => bookmarks.includes(c.id))
    : cafes

  // ─── Active filter count ──────────────────────────────────────
  const activeFilterCount = [
    filters.priceRange !== 'all' && filters.priceRange,
    (filters.minRating ?? 0) > 0,
    (filters.tags?.length ?? 0) > 0,
    (filters.ambiance?.length ?? 0) > 0,
    filters.campus,
  ].filter(Boolean).length

  return (
    <div className={`min-h-screen ${darkMode ? 'dark' : ''}`}>
      <div className="min-h-screen bg-gray-50 dark:bg-[#1c1a19] transition-colors duration-500">

        {/* ═══════════════ HEADER ═══════════════ */}
        <header className="bg-white/80 dark:bg-[#252322]/80 backdrop-blur-xl sticky top-0 z-30 border-b border-gray-200/50 dark:border-[#322f2e]/50 transition-colors duration-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            {/* Top row: Logo + Actions */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-[#a3630f]/20 rounded-xl blur-md" />
                  <div className="relative bg-gradient-to-br from-[#a3630f] to-[#c87d1a] p-2 rounded-xl">
                    <Coffee className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight tracking-tight">
                    Jogja Cafe Finder
                  </h1>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    ngopi enak, WiFi kenceng <Sparkles className="h-3 w-3 text-amber-500" />
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowBookmarksOnly(!showBookmarksOnly)}
                  className={`p-2.5 rounded-xl transition-all duration-300 active:scale-90 ${
                    showBookmarksOnly
                      ? 'bg-[#a3630f] text-white shadow-md shadow-[#a3630f]/30'
                      : 'bg-gray-100 dark:bg-[#322f2e] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#3d3a39]'
                  }`}
                >
                  <Heart className={`h-5 w-5 ${showBookmarksOnly ? 'fill-current' : ''}`} />
                </button>

                <button
                  onClick={toggleDarkMode}
                  className="p-2.5 rounded-xl bg-gray-100 dark:bg-[#322f2e] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#3d3a39] transition-all duration-300 active:scale-90"
                >
                  {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </button>

                {session && (
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="bg-gradient-to-r from-[#a3630f] to-[#c87d1a] hover:from-[#b8731b] hover:to-[#d99030] text-white px-4 py-2.5 rounded-xl font-medium transition-all duration-300 active:scale-95 flex items-center gap-2 shadow-md shadow-[#a3630f]/20 hover:shadow-lg hover:-translate-y-0.5"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline text-sm">Tambahin Cafe</span>
                  </button>
                )}
              </div>
            </div>

            {/* Search bar + Filter button */}
            <div className="flex gap-2">
              <div className="relative flex-1 group">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-[#a3630f] transition-colors duration-300" />
                <input
                  type="text"
                  placeholder="Cari cafe, area, atau vibes..."
                  value={filters.search || ''}
                  onChange={(e) => updateFilters({ search: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#3d3a39] bg-white dark:bg-[#252322] text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-[#a3630f]/30 focus:border-[#a3630f] transition-all duration-300 outline-none text-sm"
                />
              </div>
              <button
                onClick={() => setShowFilters(true)}
                className="relative px-4 py-2.5 bg-gray-100 dark:bg-[#322f2e] border border-gray-200 dark:border-[#3d3a39] text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-[#3d3a39] transition-all duration-300 active:scale-95 flex items-center gap-2 text-sm"
              >
                <Filter className="h-4 w-4" />
                <span className="hidden sm:inline font-medium">Filter</span>
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-[#a3630f] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>

            {/* Category pills */}
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
              {['All', ...CAFE_CATEGORIES].map(cat => (
                <button
                  key={cat}
                  onClick={() => updateFilters({ category: cat })}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-300 active:scale-95 ${
                    filters.category === cat
                      ? 'bg-gradient-to-r from-[#a3630f] to-[#c87d1a] text-white shadow-md shadow-[#a3630f]/20'
                      : 'bg-gray-100 dark:bg-[#322f2e] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#3d3a39]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Active filter badges */}
            {activeFilterCount > 0 && (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {filters.priceRange && filters.priceRange !== 'all' && (
                  <FilterBadge label={filters.priceRange} onRemove={() => updateFilters({ priceRange: 'all' })} />
                )}
                {(filters.minRating ?? 0) > 0 && (
                  <FilterBadge label={`≥${filters.minRating} ★`} onRemove={() => updateFilters({ minRating: 0 })} />
                )}
                {filters.tags?.map(t => (
                  <FilterBadge key={t} label={t} onRemove={() => updateFilters({ tags: filters.tags?.filter(x => x !== t) })} />
                ))}
                {filters.ambiance?.map(a => (
                  <FilterBadge key={a} label={a} onRemove={() => updateFilters({ ambiance: filters.ambiance?.filter(x => x !== a) })} />
                ))}
                {filters.campus && (
                  <FilterBadge label={`🎓 ${filters.campus}`} onRemove={() => updateFilters({ campus: '' })} />
                )}
                <button onClick={resetFilters} className="text-xs text-[#a3630f] hover:underline font-medium ml-1">
                  Clear all
                </button>
              </div>
            )}
          </div>
        </header>

        {/* ═══════════════ MAIN CONTENT ═══════════════ */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Stats bar */}
          <div className="mb-4 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-3">
              <span>
                {isPending || loading ? (
                  <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
                ) : null}
                {displayCafes.length} cafe ditemukan
              </span>
              {bookmarks.length > 0 && (
                <span className="text-[#a3630f] font-medium flex items-center gap-1">
                  <Heart className="w-3 h-3 fill-current" /> {bookmarks.length} disimpan
                </span>
              )}
            </div>
            {!session && (
              <button
                onClick={() => setShowLoginModal(true)}
                className="text-[#a3630f] font-medium hover:underline flex items-center gap-1"
              >
                Login dulu yuk <Sparkles className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Cards grid */}
          {(isPending || loading) && cafes.length === 0 ? (
            <SkeletonGrid />
          ) : displayCafes.length === 0 ? (
            <EmptyState onReset={resetFilters} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {displayCafes.map((cafe, i) => (
                <CafeCard
                  key={cafe.id}
                  cafe={cafe}
                  index={i}
                  isBookmarked={bookmarks.includes(cafe.id)}
                  onToggleBookmark={() => toggleBookmark(cafe.id)}
                  onClick={() => handleCafeClick(cafe)}
                />
              ))}
            </div>
          )}
        </main>

        {/* ═══════════════ MODALS ═══════════════ */}
        {showFilters && (
          <FiltersModal
            filters={filters}
            onApply={(f) => { setFilters(f); syncAndFetch(f); setShowFilters(false) }}
            onClose={() => setShowFilters(false)}
            darkMode={darkMode}
          />
        )}

        {selectedCafe && (
          <CafeDetailModal
            cafe={selectedCafe}
            isBookmarked={bookmarks.includes(selectedCafe.id)}
            onToggleBookmark={() => toggleBookmark(selectedCafe.id)}
            onClose={() => setSelectedCafe(null)}
          />
        )}

        {showAddForm && session && (
          <AddCafeModal
            session={session}
            onClose={() => setShowAddForm(false)}
            onSuccess={() => syncAndFetch(filters)}
            darkMode={darkMode}
          />
        )}

        {showLoginModal && (
          <LoginModal
            onClose={() => setShowLoginModal(false)}
            onSuccess={() => setShowLoginModal(false)}
          />
        )}
      </div>
    </div>
  )
}

// =============================================================================
// FilterBadge
// =============================================================================
function FilterBadge({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="bg-[#a3630f]/10 text-[#a3630f] px-3 py-1 rounded-full text-xs flex items-center gap-1.5 font-medium">
      {label}
      <X className="h-3 w-3 cursor-pointer hover:scale-125 transition-transform" onClick={onRemove} />
    </span>
  )
}

// =============================================================================
// CafeCard
// =============================================================================
function CafeCard({ cafe, index, isBookmarked, onToggleBookmark, onClick }: {
  cafe: Cafe; index: number; isBookmarked: boolean
  onToggleBookmark: () => void; onClick: () => void
}) {
  const [imgError, setImgError] = useState(false)
  const hasImage = cafe.image && cafe.image.trim() !== '' && !imgError

  return (
    <div
      className="animate-card-enter bg-white dark:bg-[#252322] rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 active:scale-[0.98] group border border-gray-200/60 dark:border-[#322f2e] flex flex-col cursor-pointer hover:-translate-y-1"
      style={{ animationDelay: `${index * 60}ms` }}
      onClick={onClick}
    >
      {/* Image */}
      <div className="relative aspect-[16/10] overflow-hidden bg-gray-100 dark:bg-[#322f2e]">
        {hasImage ? (
          <Image
            src={cafe.image}
            alt={cafe.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 dark:text-gray-600">
            <Coffee className="w-8 h-8 opacity-40 mb-1" />
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-50">No Image</span>
          </div>
        )}

        {/* Badges overlay */}
        <div className="absolute top-3 left-3 flex gap-1.5">
          <span className="bg-gradient-to-r from-[#a3630f] to-[#c87d1a] text-white px-2.5 py-0.5 rounded-lg text-[10px] font-bold tracking-wide shadow-sm">
            {cafe.category}
          </span>
        </div>
        <div className="absolute top-3 right-3 flex gap-1.5">
          {cafe.rating && (
            <div className="bg-white/90 dark:bg-[#252322]/90 backdrop-blur-sm px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-sm">
              <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
              <span className="font-bold text-[11px] text-gray-900 dark:text-white">{cafe.rating.toFixed(1)}</span>
            </div>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleBookmark() }}
            className="bg-white/90 dark:bg-[#252322]/90 backdrop-blur-sm p-1.5 rounded-lg hover:scale-110 active:scale-90 transition-all duration-300 shadow-sm"
          >
            <Heart className={`h-3.5 w-3.5 ${isBookmarked ? 'fill-red-500 text-red-500' : 'text-gray-500 dark:text-gray-400'}`} />
          </button>
        </div>

        {/* Bottom gradient */}
        <div className="absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-black/20 to-transparent" />
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1 line-clamp-1 group-hover:text-[#a3630f] transition-colors">
          {cafe.name}
        </h3>
        <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-xs mb-2.5">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="line-clamp-1">{cafe.area}</span>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-xs mb-3 line-clamp-2 flex-1 leading-relaxed">
          {cafe.description}
        </p>

        {/* Tags row */}
        {cafe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {cafe.tags.slice(0, 3).map(tag => (
              <span key={tag} className="bg-gray-100 dark:bg-[#322f2e] text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded text-[10px] font-medium">
                {tag}
              </span>
            ))}
            {cafe.tags.length > 3 && (
              <span className="text-gray-400 dark:text-gray-500 text-[10px] font-medium">+{cafe.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 dark:border-[#322f2e] pt-2.5 mt-auto">
          <span className="text-[#a3630f] font-semibold text-xs capitalize">{cafe.priceRange?.replace('-', ' ')}</span>
          <span className="text-gray-400 dark:text-gray-500 text-[10px] flex items-center gap-1">
            <Clock className="h-3 w-3" /> {cafe.openingHours}
          </span>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// CafeDetailModal
// =============================================================================
function CafeDetailModal({ cafe, isBookmarked, onToggleBookmark, onClose }: {
  cafe: Cafe; isBookmarked: boolean; onToggleBookmark: () => void; onClose: () => void
}) {
  const [imgError, setImgError] = useState(false)
  const hasImage = cafe.image && cafe.image.trim() !== '' && !imgError

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 md:p-4 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-[#252322] border dark:border-[#3d3a39] w-full max-w-2xl h-full md:h-auto md:max-h-[90vh] md:rounded-2xl overflow-y-auto flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">

        {/* Hero image */}
        <div className="relative h-56 md:h-72 bg-gray-100 dark:bg-[#322f2e] shrink-0">
          {hasImage ? (
            <Image
              src={cafe.image}
              alt={cafe.name}
              fill
              sizes="(max-width: 768px) 100vw, 672px"
              className="object-cover"
              priority
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
              <Coffee className="w-12 h-12 opacity-40 mb-2" />
              <span className="text-xs font-bold uppercase tracking-wider opacity-50">No Image</span>
            </div>
          )}

          {/* Top buttons */}
          <div className="absolute top-4 right-4 flex gap-2">
            <button
              onClick={onToggleBookmark}
              className="glass p-2.5 rounded-full hover:scale-110 active:scale-90 transition-all duration-300 shadow-sm"
            >
              <Heart className={`h-5 w-5 ${isBookmarked ? 'fill-red-500 text-red-500' : 'text-gray-700 dark:text-gray-300'}`} />
            </button>
            <button
              onClick={onClose}
              className="glass p-2.5 rounded-full hover:scale-110 active:scale-90 hover:rotate-90 transition-all duration-300 shadow-sm"
            >
              <X className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            </button>
          </div>

          {/* Title overlay */}
          {hasImage && (
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-5 pt-14">
              <h2 className="text-2xl font-bold text-white">{cafe.name}</h2>
              <div className="flex items-center gap-2 text-white/80 mt-1">
                <MapPin className="h-4 w-4" />
                <span className="text-sm">{cafe.area}</span>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5 md:p-7 space-y-5 flex-1">
          {!hasImage && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{cafe.name}</h2>
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mt-1">
                <MapPin className="h-4 w-4" />
                <span className="text-sm">{cafe.area}</span>
              </div>
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 dark:bg-[#322f2e] p-3 rounded-xl border border-gray-100 dark:border-[#3d3a39] hover:border-[#a3630f]/40 transition-colors">
              <DollarSign className="h-4 w-4 text-[#a3630f] mb-1" />
              <p className="text-[10px] text-gray-500 uppercase font-medium">Harga</p>
              <p className="font-semibold text-gray-900 dark:text-white text-xs capitalize">{cafe.priceRange?.replace('-', ' ')}</p>
            </div>
            <div className="bg-gray-50 dark:bg-[#322f2e] p-3 rounded-xl border border-gray-100 dark:border-[#3d3a39] hover:border-blue-500/40 transition-colors">
              <Clock className="h-4 w-4 text-blue-500 mb-1" />
              <p className="text-[10px] text-gray-500 uppercase font-medium">Jam Buka</p>
              <p className="font-semibold text-gray-900 dark:text-white text-xs">{cafe.openingHours}</p>
            </div>
            <div className="bg-gray-50 dark:bg-[#322f2e] p-3 rounded-xl border border-gray-100 dark:border-[#3d3a39] hover:border-amber-500/40 transition-colors">
              <Star className="h-4 w-4 text-amber-500 mb-1" />
              <p className="text-[10px] text-gray-500 uppercase font-medium">Rating</p>
              <p className="font-semibold text-gray-900 dark:text-white text-xs">{cafe.rating ? cafe.rating.toFixed(1) : 'N/A'}</p>
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Tentang Cafe Ini</h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">{cafe.fullDescription || cafe.description}</p>
          </div>

          {/* Address */}
          <div className="bg-gray-50 dark:bg-[#322f2e] p-4 rounded-xl border border-gray-100 dark:border-[#3d3a39]">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-[#a3630f]" /> Alamat
            </h3>
            <p className="text-gray-600 dark:text-gray-300 text-xs leading-relaxed">{cafe.location}</p>
          </div>

          {/* Tags */}
          {cafe.tags.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Fasilitas ✨</h3>
              <div className="flex flex-wrap gap-2">
                {cafe.tags.map(tag => (
                  <span key={tag} className="bg-gray-100 dark:bg-[#322f2e] text-gray-600 dark:text-gray-300 px-3 py-1 rounded-lg border border-gray-200 dark:border-[#3d3a39] text-xs font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Ambiance */}
          {cafe.ambiance.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Suasana 🎨</h3>
              <div className="flex flex-wrap gap-2">
                {cafe.ambiance.map(a => (
                  <span key={a} className="bg-[#a3630f]/10 text-[#a3630f] px-3 py-1 rounded-lg text-xs font-medium capitalize">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Nearby campuses */}
          {cafe.nearbyCampuses.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Kampus Terdekat 🎓</h3>
              <div className="flex flex-wrap gap-2">
                {cafe.nearbyCampuses.map(c => (
                  <span key={c} className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Google Maps button */}
          {cafe.googleMapsLink && (
            <div className="pt-2 pb-6 md:pb-0">
              <button
                onClick={() => window.open(cafe.googleMapsLink, '_blank')}
                className="w-full bg-gradient-to-r from-[#a3630f] to-[#c87d1a] hover:from-[#b8731b] hover:to-[#d99030] text-white py-3.5 rounded-xl font-semibold text-sm transition-all duration-300 active:scale-[0.98] shadow-md hover:shadow-lg hover:-translate-y-0.5 flex items-center justify-center gap-2"
              >
                <ExternalLink className="h-4 w-4" /> Buka di Google Maps
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// FiltersModal
// =============================================================================
function FiltersModal({ filters, onApply, onClose, darkMode }: {
  filters: CafeFilters; onApply: (f: CafeFilters) => void; onClose: () => void; darkMode: boolean
}) {
  const [local, setLocal] = useState<CafeFilters>({ ...filters })

  const toggleArray = (arr: string[] | undefined, val: string) => {
    const current = arr || []
    return current.includes(val) ? current.filter(x => x !== val) : [...current, val]
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-[#252322] border-t md:border border-gray-200 dark:border-[#3d3a39] w-full max-w-xl max-h-[85vh] md:max-h-[80vh] rounded-t-2xl md:rounded-2xl flex flex-col shadow-2xl animate-slide-up md:animate-in md:zoom-in-95 md:duration-300 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-[#322f2e] shrink-0">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Filter Cafe ☕</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-[#322f2e] rounded-full transition-all active:scale-90 hover:rotate-90">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Price range */}
          <div>
            <label className="block text-sm font-semibold mb-2.5 text-gray-900 dark:text-white">Range Harga 💰</label>
            <select
              value={local.priceRange || 'all'}
              onChange={e => setLocal({ ...local, priceRange: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 dark:border-[#3d3a39] bg-white dark:bg-[#322f2e] text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-[#a3630f]/30 focus:border-[#a3630f] outline-none text-sm cursor-pointer"
              style={{ colorScheme: darkMode ? 'dark' : 'light' }}
            >
              <option value="all">Semua Harga</option>
              {PRICE_RANGES.map(p => (
                <option key={p} value={p}>{p.replace('-', ' ')}</option>
              ))}
            </select>
          </div>

          {/* Min rating */}
          <div>
            <label className="block text-sm font-semibold mb-2.5 text-gray-900 dark:text-white">Minimum Rating ⭐</label>
            <input
              type="range" min="0" max="5" step="0.5"
              value={local.minRating || 0}
              onChange={e => setLocal({ ...local, minRating: parseFloat(e.target.value) })}
              className="w-full accent-[#a3630f]"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1.5">
              <span>Semua</span>
              <span className="font-bold text-[#a3630f] text-sm">{(local.minRating || 0).toFixed(1)}</span>
              <span>5.0</span>
            </div>
          </div>

          {/* Fasilitas/Tags */}
          <div>
            <label className="block text-sm font-semibold mb-2.5 text-gray-900 dark:text-white">Fasilitas ✨</label>
            <div className="flex flex-wrap gap-2">
              {FACILITY_TAGS.map(tag => (
                <button
                  key={tag}
                  onClick={() => setLocal({ ...local, tags: toggleArray(local.tags, tag) })}
                  className={`chip ${local.tags?.includes(tag) ? 'active' : ''}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Suasana/Ambiance */}
          <div>
            <label className="block text-sm font-semibold mb-2.5 text-gray-900 dark:text-white">Suasana 🎨</label>
            <div className="flex flex-wrap gap-2">
              {AMBIANCE_OPTIONS.map(a => (
                <button
                  key={a}
                  onClick={() => setLocal({ ...local, ambiance: toggleArray(local.ambiance, a) })}
                  className={`chip ${local.ambiance?.includes(a) ? 'active' : ''}`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Kampus terdekat */}
          <div>
            <label className="block text-sm font-semibold mb-2.5 text-gray-900 dark:text-white">Kampus Terdekat 🎓</label>
            <select
              value={local.campus || ''}
              onChange={e => setLocal({ ...local, campus: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 dark:border-[#3d3a39] bg-white dark:bg-[#322f2e] text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-[#a3630f]/30 focus:border-[#a3630f] outline-none text-sm cursor-pointer"
              style={{ colorScheme: darkMode ? 'dark' : 'light' }}
            >
              <option value="">Semua kampus</option>
              {NEARBY_CAMPUSES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer buttons */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-[#322f2e] flex gap-3 shrink-0 bg-white dark:bg-[#252322]">
          <button
            onClick={() => setLocal({ search: '', category: 'All', priceRange: 'all', minRating: 0, tags: [], ambiance: [], campus: '' })}
            className="flex-1 py-3 border border-gray-200 dark:border-[#3d3a39] text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-[#322f2e] transition-all active:scale-95 text-sm"
          >
            Reset
          </button>
          <button
            onClick={() => onApply(local)}
            className="flex-1 py-3 bg-gradient-to-r from-[#a3630f] to-[#c87d1a] text-white rounded-xl font-semibold transition-all active:scale-95 text-sm shadow-md hover:shadow-lg hover:-translate-y-0.5"
          >
            Terapkan Filter
          </button>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// AddCafeModal
// =============================================================================
function AddCafeModal({ session, onClose, onSuccess, darkMode }: {
  session: Session; onClose: () => void; onSuccess: () => void; darkMode: boolean
}) {
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ show: boolean; type: 'success' | 'error'; message: string }>({ show: false, type: 'success', message: '' })
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [form, setForm] = useState({
    name: '', location: '', area: '', category: '',
    price_range: '', opening_hours: '', description: '',
    google_maps_link: '', rating: '3.0',
    tags: [] as string[], ambiance: [] as string[],
    nearby_campuses: [] as string[],
  })

  const toggleArr = (key: 'tags' | 'ambiance' | 'nearby_campuses', val: string) => {
    setForm(prev => ({
      ...prev,
      [key]: prev[key].includes(val) ? prev[key].filter(v => v !== val) : [...prev[key], val],
    }))
  }

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ show: true, type, message })
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast('error', 'Ukuran gambar maks 5MB ya! 📸')
        return
      }
      const reader = new FileReader()
      reader.onload = () => setImagePreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrors({})

    const formData = new FormData()
    formData.set('access_token', session.access_token)
    formData.set('name', form.name)
    formData.set('location', form.location)
    formData.set('area', form.area)
    formData.set('category', form.category)
    formData.set('price_range', form.price_range)
    formData.set('opening_hours', form.opening_hours)
    formData.set('description', form.description)
    formData.set('google_maps_link', form.google_maps_link)
    formData.set('rating', form.rating)
    formData.set('tags', JSON.stringify(form.tags))
    formData.set('ambiance', JSON.stringify(form.ambiance))
    formData.set('nearby_campuses', JSON.stringify(form.nearby_campuses))

    const imageFile = fileInputRef.current?.files?.[0]
    if (imageFile) formData.set('image', imageFile)

    const result = await submitCafeAction(formData)

    if (result.success) {
      showToast('success', result.message)
      setTimeout(() => { onSuccess(); onClose() }, 2000)
    } else {
      showToast('error', result.message)
      if (result.errors) setErrors(result.errors)
    }

    setSubmitting(false)
  }

  const inputClass = "w-full px-3 py-2.5 bg-transparent border border-gray-200 dark:border-[#3d3a39] rounded-xl focus:border-[#a3630f] focus:ring-2 focus:ring-[#a3630f]/30 text-gray-900 dark:text-white placeholder-gray-400 transition-all outline-none text-sm"
  const labelClass = "block text-sm text-gray-500 dark:text-gray-400 mb-1.5"
  const errorClass = "text-red-500 text-[11px] mt-1"

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 md:p-4 animate-in fade-in duration-300">
      {/* Toast */}
      {toast.show && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[110] animate-toast w-[90%] max-w-sm pointer-events-auto">
          <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-[#322f2e] border border-gray-200 dark:border-[#3d3a39] rounded-xl shadow-xl">
            {toast.type === 'success' ? <CircleCheck className="w-5 h-5 text-emerald-500 shrink-0" /> : <CircleAlert className="w-5 h-5 text-red-500 shrink-0" />}
            <p className="text-sm font-medium text-gray-900 dark:text-white">{toast.message}</p>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-[#252322] w-full max-w-2xl h-full md:h-auto md:max-h-[90vh] md:rounded-2xl md:border dark:border-[#3d3a39] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom-8 md:zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-[#3d3a39] shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Tambahin Cafe Baru ☕</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Share spot favorit kamu ke komunitas!</p>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-100 dark:bg-[#322f2e] rounded-full hover:bg-gray-200 dark:hover:bg-[#3d3a39] active:scale-90 hover:rotate-90 transition-all">
            <X className="h-4 w-4 text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 overflow-y-auto flex-1">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name + Area */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Nama Cafe *</label>
                <input required placeholder="Contoh: Kopi Kenangan" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} />
                {errors.name && <p className={errorClass}>{errors.name[0]}</p>}
              </div>
              <div>
                <label className={labelClass}>Area *</label>
                <input required placeholder="Contoh: Seturan, Jakal" value={form.area} onChange={e => setForm({ ...form, area: e.target.value })} className={inputClass} />
                {errors.area && <p className={errorClass}>{errors.area[0]}</p>}
              </div>
            </div>

            {/* Category + Price */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Kategori *</label>
                <select required value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={inputClass} style={{ colorScheme: darkMode ? 'dark' : 'light' }}>
                  <option value="" disabled>Pilih kategori...</option>
                  {CAFE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                {errors.category && <p className={errorClass}>{errors.category[0]}</p>}
              </div>
              <div>
                <label className={labelClass}>Range Harga *</label>
                <select required value={form.price_range} onChange={e => setForm({ ...form, price_range: e.target.value })} className={inputClass} style={{ colorScheme: darkMode ? 'dark' : 'light' }}>
                  <option value="" disabled>Pilih harga...</option>
                  {PRICE_RANGES.map(p => <option key={p} value={p}>{p.replace('-', ' ')}</option>)}
                </select>
                {errors.price_range && <p className={errorClass}>{errors.price_range[0]}</p>}
              </div>
            </div>

            {/* Address + Hours */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Alamat Lengkap *</label>
                <input required placeholder="Jl. Ring Road Utara No..." value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className={inputClass} />
                {errors.location && <p className={errorClass}>{errors.location[0]}</p>}
              </div>
              <div>
                <label className={labelClass}>Jam Buka *</label>
                <input required placeholder="08:00 - 22:00" value={form.opening_hours} onChange={e => setForm({ ...form, opening_hours: e.target.value })} className={inputClass} />
                {errors.opening_hours && <p className={errorClass}>{errors.opening_hours[0]}</p>}
              </div>
            </div>

            {/* Image upload */}
            <div>
              <label className={labelClass}>Foto Cafe 📸</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 dark:border-[#3d3a39] rounded-xl p-6 text-center cursor-pointer hover:border-[#a3630f]/50 transition-colors group"
              >
                {imagePreview ? (
                  <div className="relative aspect-video rounded-lg overflow-hidden max-w-xs mx-auto">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-white text-xs font-medium">Ganti foto</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <Upload className="h-8 w-8 group-hover:text-[#a3630f] transition-colors" />
                    <span className="text-xs">Klik untuk upload (maks 5MB)</span>
                    <span className="text-[10px] text-gray-400">JPG, PNG, WebP</span>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </div>
            </div>

            {/* Rating slider */}
            <div className="p-4 border border-gray-200 dark:border-[#3d3a39] rounded-xl bg-gray-50/50 dark:bg-[#2a2827]/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  Rating: <span className="font-bold text-[#a3630f] text-lg ml-1">{parseFloat(form.rating).toFixed(1)}</span> / 5.0
                </span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const val = parseFloat(form.rating)
                    const fill = val >= star ? 100 : val >= star - 1 ? (val - (star - 1)) * 100 : 0
                    return (
                      <div key={star} className="relative">
                        <Star className="h-6 w-6 text-gray-200 dark:text-[#3d3a39]" />
                        <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ width: `${fill}%` }}>
                          <Star className="h-6 w-6 text-amber-500 fill-amber-500" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <input
                type="range" min="0.5" max="5" step="0.1"
                value={form.rating}
                onChange={e => setForm({ ...form, rating: e.target.value })}
                className="w-full accent-[#a3630f]"
              />
            </div>

            {/* Description */}
            <div>
              <label className={labelClass}>Deskripsi *</label>
              <textarea
                required
                placeholder="Ceritain vibes cafe ini, menu favorit, suasana, dan fasilitas yang bikin betah..."
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={4}
                className={`${inputClass} resize-none`}
              />
              {errors.description && <p className={errorClass}>{errors.description[0]}</p>}
            </div>

            {/* Tags */}
            <div>
              <label className={labelClass}>Fasilitas ✨</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {FACILITY_TAGS.map(tag => (
                  <button key={tag} type="button" onClick={() => toggleArr('tags', tag)}
                    className={`chip ${form.tags.includes(tag) ? 'active' : ''}`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              {errors.tags && <p className={errorClass}>{errors.tags[0]}</p>}
            </div>

            {/* Ambiance */}
            <div>
              <label className={labelClass}>Suasana 🎨</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {AMBIANCE_OPTIONS.map(a => (
                  <button key={a} type="button" onClick={() => toggleArr('ambiance', a)}
                    className={`chip ${form.ambiance.includes(a) ? 'active' : ''}`}
                  >
                    {a}
                  </button>
                ))}
              </div>
              {errors.ambiance && <p className={errorClass}>{errors.ambiance[0]}</p>}
            </div>

            {/* Nearby campuses */}
            <div>
              <label className={labelClass}>Kampus Terdekat 🎓 (opsional)</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {NEARBY_CAMPUSES.map(c => (
                  <button key={c} type="button" onClick={() => toggleArr('nearby_campuses', c)}
                    className={`chip ${form.nearby_campuses.includes(c) ? 'active' : ''}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Google Maps link */}
            <div>
              <label className={labelClass}>Link Google Maps (opsional)</label>
              <input
                placeholder="Paste link share dari Google Maps..."
                value={form.google_maps_link}
                onChange={e => setForm({ ...form, google_maps_link: e.target.value })}
                className={inputClass}
              />
              {errors.google_maps_link && <p className={errorClass}>{errors.google_maps_link[0]}</p>}
            </div>

            {/* Submit */}
            <div className="pt-2 pb-6 md:pb-0">
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-[#a3630f] to-[#c87d1a] hover:from-[#b8731b] hover:to-[#d99030] text-white py-3.5 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-50 shadow-md hover:shadow-lg hover:-translate-y-0.5 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Lagi diproses...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" /> Submit Cafe
                  </>
                )}
              </button>
              <p className="text-center text-[10px] text-gray-400 mt-2">
                Cafe akan masuk antrian review dulu sebelum tampil di homepage 🔍
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// SkeletonGrid
// =============================================================================
function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-[#252322] rounded-2xl overflow-hidden border border-gray-200 dark:border-[#322f2e]">
          <div className="aspect-[16/10] skeleton bg-gray-200 dark:bg-[#322f2e]" />
          <div className="p-4 space-y-3">
            <div className="h-4 w-3/4 rounded-lg skeleton bg-gray-200 dark:bg-[#322f2e]" />
            <div className="h-3 w-1/2 rounded-lg skeleton bg-gray-200 dark:bg-[#322f2e]" />
            <div className="h-3 w-full rounded-lg skeleton bg-gray-200 dark:bg-[#322f2e]" />
            <div className="h-3 w-2/3 rounded-lg skeleton bg-gray-200 dark:bg-[#322f2e]" />
          </div>
        </div>
      ))}
    </div>
  )
}

// =============================================================================
// EmptyState
// =============================================================================
function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="text-center py-20 bg-white dark:bg-[#252322] rounded-2xl border border-gray-200 dark:border-[#322f2e]">
      <div className="animate-float">
        <Coffee className="h-14 w-14 text-[#a3630f]/30 mx-auto mb-4" />
      </div>
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
        Wah, belum ada cafe yang cocok nih 😅
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-xs mx-auto">
        Coba ubah filter atau kata kunci pencarian kamu.
      </p>
      <button
        onClick={onReset}
        className="text-[#a3630f] font-semibold text-sm hover:underline active:scale-95 transition-all"
      >
        Reset semua filter
      </button>
    </div>
  )
}
