import { Suspense } from 'react'
import { Coffee } from 'lucide-react'
import { getFilteredCafes } from '@/app/actions/cafes'
import type { CafeFilters } from '@/lib/schema'
import CafeFinderClient from './CafeFinderClient'

export const revalidate = 60
export const metadata = {
  title: 'Jogja Cafe Finder — Temukan Spot Ngopi Terbaik di Yogyakarta',
  description:
    'Platform pencarian cafe untuk mahasiswa Jogja. Cari berdasarkan WiFi, colokan, suasana, harga, dan kampus terdekat. WFC friendly, aesthetic, & budget-friendly!',
  openGraph: {
    title: 'Kapee siap membantu kamu menemukan cafe terbaik di Yogyakarta',
    description: 'Temukan cafe yang sesuai kebutuhanmu di Yogyakarta',
    type: 'website',
  },
}

interface HomePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams

  const filters: CafeFilters = {
    search: typeof params.q === 'string' ? params.q : undefined,
    category: typeof params.category === 'string' ? params.category : undefined,
    priceRange: typeof params.price === 'string' ? params.price : undefined,
    minRating: typeof params.rating === 'string' ? parseFloat(params.rating) : undefined,
    tags: typeof params.tags === 'string' ? params.tags.split(',').filter(Boolean) : undefined,
    ambiance: typeof params.ambiance === 'string' ? params.ambiance.split(',').filter(Boolean) : undefined,
    campus: typeof params.campus === 'string' ? params.campus : undefined,
    area: typeof params.area === 'string' ? params.area : undefined,
  }
  const initialCafes = await getFilteredCafes(filters)

  return (
    <Suspense fallback={<HomePageSkeleton />}>
      <CafeFinderClient initialCafes={initialCafes} />
    </Suspense>
  )
}

function HomePageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1c1a19]">
      {/* Header skeleton */}
      <div className="bg-white dark:bg-[#252322] shadow-sm border-b dark:border-[#322f2e] px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <Coffee className="h-8 w-8 text-[#a3630f] animate-pulse" />
            <div className="h-6 w-48 rounded-lg skeleton bg-gray-200 dark:bg-[#322f2e]" />
          </div>
          <div className="h-10 w-full rounded-lg skeleton bg-gray-200 dark:bg-[#322f2e]" />
          <div className="flex gap-2 mt-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-8 w-24 rounded-full skeleton bg-gray-200 dark:bg-[#322f2e]"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Card grid skeleton */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-[#252322] rounded-xl overflow-hidden border border-gray-200 dark:border-[#322f2e]"
            >
              <div className="aspect-video skeleton bg-gray-200 dark:bg-[#322f2e]" />
              <div className="p-4 space-y-3">
                <div className="h-5 w-3/4 rounded skeleton bg-gray-200 dark:bg-[#322f2e]" />
                <div className="h-4 w-1/2 rounded skeleton bg-gray-200 dark:bg-[#322f2e]" />
                <div className="h-3 w-full rounded skeleton bg-gray-200 dark:bg-[#322f2e]" />
                <div className="h-3 w-2/3 rounded skeleton bg-gray-200 dark:bg-[#322f2e]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}