'use client'

import React, { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { X, Coffee, Sparkles, Shield, Zap } from 'lucide-react'

interface LoginModalProps {
  onClose: () => void
  onSuccess?: () => void
}

/**
 * LoginModal — Glassmorphism pop-up dengan One-Click Google Sign-In.
 * 
 * Muncul saat user anonim mencoba melihat detail cafe.
 * Copywriting casual ala Gen-Z, vibe aesthetic & relatable.
 */
export default function LoginModal({ onClose, onSuccess }: LoginModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError(null)

    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}${window.location.pathname}${window.location.search}`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (authError) {
        setError('Login gagal, coba lagi ya! 😅')
        setLoading(false)
      }
      // Kalau sukses, browser akan redirect ke Google OAuth
    } catch {
      setError('Terjadi kesalahan. Coba lagi nanti.')
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop — blur + dark overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md" />

      {/* Modal Card — Glassmorphism */}
      <div
        className="relative w-full max-w-md animate-in zoom-in-95 fade-in duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow effect behind card */}
        <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 rounded-3xl blur-xl" />

        <div className="relative bg-white/80 dark:bg-[#252322]/80 backdrop-blur-2xl border border-white/20 dark:border-[#3d3a39]/50 rounded-2xl overflow-hidden shadow-2xl">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/30 dark:bg-white/10 backdrop-blur-sm hover:bg-white/50 dark:hover:bg-white/20 transition-all duration-300 active:scale-90 hover:rotate-90"
          >
            <X className="h-4 w-4 text-gray-700 dark:text-gray-300" />
          </button>

          {/* Header with gradient */}
          <div className="relative px-8 pt-10 pb-6 text-center">
            {/* Decorative circles */}
            <div className="absolute top-4 left-6 w-16 h-16 bg-amber-400/10 rounded-full blur-xl" />
            <div className="absolute top-8 right-8 w-12 h-12 bg-orange-400/10 rounded-full blur-xl" />

            {/* Icon */}
            <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30 mb-4">
              <Coffee className="h-8 w-8 text-white" />
              <Sparkles className="absolute -top-1 -right-1 h-5 w-5 text-yellow-400 animate-pulse" />
            </div>

            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Mau liat detail cafe? 👀
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed max-w-xs mx-auto">
              Login dulu yuk, cuma 1 klik pake Google. Biar kamu bisa eksplor semua info lengkap cafe-nya!
            </p>
          </div>

          {/* Login button */}
          <div className="px-8 pb-4">
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full relative group flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-white dark:bg-[#322f2e] border-2 border-gray-200 dark:border-[#3d3a39] hover:border-[#a3630f] dark:hover:border-[#a3630f] transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-[#a3630f] border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              <span className="font-semibold text-gray-700 dark:text-gray-200 text-sm">
                {loading ? 'Lagi proses...' : 'Lanjutkan dengan Google'}
              </span>
            </button>

            {error && (
              <p className="mt-3 text-center text-sm text-red-500 animate-in fade-in duration-300">
                {error}
              </p>
            )}
          </div>

          {/* Benefits */}
          <div className="px-8 pb-8 pt-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-gray-50/50 dark:bg-[#1c1a19]/50">
                <Zap className="h-4 w-4 text-amber-500" />
                <span className="text-[10px] text-gray-500 dark:text-gray-400 text-center font-medium">Detail lengkap</span>
              </div>
              <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-gray-50/50 dark:bg-[#1c1a19]/50">
                <Coffee className="h-4 w-4 text-amber-500" />
                <span className="text-[10px] text-gray-500 dark:text-gray-400 text-center font-medium">Submit cafe</span>
              </div>
              <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-gray-50/50 dark:bg-[#1c1a19]/50">
                <Shield className="h-4 w-4 text-amber-500" />
                <span className="text-[10px] text-gray-500 dark:text-gray-400 text-center font-medium">Data aman</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 pb-6 text-center">
            <p className="text-[10px] text-gray-400 dark:text-gray-500">
              Dengan login, kamu setuju sama{' '}
              <span className="underline cursor-pointer hover:text-[#a3630f] transition-colors">ketentuan layanan</span>
              {' '}kami. Datamu aman kok! 🔒
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
