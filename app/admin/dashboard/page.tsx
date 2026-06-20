"use client"

import React, { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { supabase } from "@/lib/supabase"
import { type Cafe } from "@/lib/schema"
import {
  getPendingCafes,
  approveCafeAction,
  rejectCafeAction,
} from "@/app/actions/cafes"
import {
  Shield,
  ShieldCheck,
  ShieldX,
  Coffee,
  MapPin,
  Tag,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  LogOut,
  RefreshCw,
  AlertTriangle,
  Inbox,
  Sparkles,
  LayoutGrid,
} from "lucide-react"

// =============================================================================
// TYPES
// =============================================================================

type TabFilter = "pending" | "approved" | "rejected"

interface Toast {
  id: string
  message: string
  type: "success" | "error"
}

interface ConfirmDialog {
  open: boolean
  cafeId: string
  cafeName: string
  action: "approve" | "reject"
}

// =============================================================================
// SKELETON CARD COMPONENT
// =============================================================================

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl bg-[#252322] border border-white/5 overflow-hidden">
      {/* Image skeleton */}
      <div className="h-48 bg-white/5" />
      <div className="p-5 space-y-3">
        <div className="h-5 bg-white/10 rounded-lg w-3/4" />
        <div className="h-4 bg-white/5 rounded-lg w-1/2" />
        <div className="flex gap-2">
          <div className="h-6 bg-white/5 rounded-full w-16" />
          <div className="h-6 bg-white/5 rounded-full w-20" />
          <div className="h-6 bg-white/5 rounded-full w-14" />
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-white/5 rounded w-full" />
          <div className="h-3 bg-white/5 rounded w-5/6" />
        </div>
        <div className="flex gap-3 pt-2">
          <div className="h-10 bg-white/5 rounded-xl flex-1" />
          <div className="h-10 bg-white/5 rounded-xl flex-1" />
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// TOAST COMPONENT
// =============================================================================

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[]
  onDismiss: (id: string) => void
}) {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl border backdrop-blur-xl
            animate-[slideUp_0.3s_ease-out] cursor-pointer transition-all duration-200 hover:scale-[1.02]
            ${
              toast.type === "success"
                ? "bg-emerald-950/80 border-emerald-500/30 text-emerald-200"
                : "bg-red-950/80 border-red-500/30 text-red-200"
            }`}
          onClick={() => onDismiss(toast.id)}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 text-red-400 shrink-0" />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      ))}
    </div>
  )
}

// =============================================================================
// CONFIRM DIALOG COMPONENT
// =============================================================================

function ConfirmModal({
  dialog,
  loading,
  onConfirm,
  onCancel,
}: {
  dialog: ConfirmDialog
  loading: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!dialog.open) return null

  const isApprove = dialog.action === "approve"

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={!loading ? onCancel : undefined}
      />
      {/* Modal */}
      <div className="relative bg-[#252322] border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-[scaleIn_0.2s_ease-out]">
        <div className="flex items-center gap-3 mb-4">
          <div
            className={`p-2.5 rounded-xl ${
              isApprove ? "bg-emerald-500/15" : "bg-red-500/15"
            }`}
          >
            {isApprove ? (
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            ) : (
              <ShieldX className="w-6 h-6 text-red-400" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">
              {isApprove ? "Approve Cafe?" : "Reject Cafe?"}
            </h3>
            <p className="text-sm text-white/50">Aksi ini nggak bisa di-undo</p>
          </div>
        </div>

        <p className="text-white/70 text-sm mb-6">
          {isApprove
            ? `Yakin mau approve `
            : `Yakin mau reject `}
          <span className="font-semibold text-white">
            &quot;{dialog.cafeName}&quot;
          </span>
          {isApprove
            ? `? Cafe ini bakal langsung tampil di homepage.`
            : `? Cafe ini nggak akan ditampilkan.`}
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10
              text-white/70 text-sm font-medium hover:bg-white/10 transition-colors
              disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all
              disabled:opacity-50 flex items-center justify-center gap-2
              ${
                isApprove
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                  : "bg-red-600 hover:bg-red-500 text-white"
              }`}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isApprove ? (
              <>
                <CheckCircle2 className="w-4 h-4" /> Approve
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4" /> Reject
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// MAIN ADMIN DASHBOARD PAGE
// =============================================================================

export default function AdminDashboardPage() {
  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null) // null = checking
  const [accessToken, setAccessToken] = useState<string>("")
  const [cafes, setCafes] = useState<Cafe[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<TabFilter>("pending")
  const [toasts, setToasts] = useState<Toast[]>([])
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>({
    open: false,
    cafeId: "",
    cafeName: "",
    action: "approve",
  })

  // ---------------------------------------------------------------------------
  // TOAST HELPERS
  // ---------------------------------------------------------------------------
  const showToast = useCallback(
    (message: string, type: "success" | "error") => {
      const id = crypto.randomUUID()
      setToasts((prev) => [...prev, { id, message, type }])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 4000)
    },
    []
  )

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // ---------------------------------------------------------------------------
  // AUTH CHECK — on mount, verify admin status
  // ---------------------------------------------------------------------------
  useEffect(() => {
    async function checkAdmin() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        setIsAdmin(false)
        return
      }

      setAccessToken(session.access_token)

      // Check profiles table for is_admin flag
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", session.user.id)
        .single()

      setIsAdmin(profile?.is_admin === true)
    }

    checkAdmin()
  }, [])

  // ---------------------------------------------------------------------------
  // FETCH PENDING CAFES — once admin is confirmed
  // ---------------------------------------------------------------------------
  const fetchCafes = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const result = await getPendingCafes(accessToken)
      setCafes(result)
    } catch {
      showToast("Gagal memuat data cafe 😅", "error")
    } finally {
      setLoading(false)
    }
  }, [accessToken, showToast])

  useEffect(() => {
    if (isAdmin && accessToken) {
      fetchCafes()
    }
  }, [isAdmin, accessToken, fetchCafes])

  // ---------------------------------------------------------------------------
  // APPROVE / REJECT ACTIONS
  // ---------------------------------------------------------------------------
  function openConfirm(
    cafeId: string,
    cafeName: string,
    action: "approve" | "reject"
  ) {
    setConfirmDialog({ open: true, cafeId, cafeName, action })
  }

  async function handleConfirm() {
    if (!accessToken) return
    setActionLoading(true)

    const { cafeId, action } = confirmDialog
    const actionFn =
      action === "approve" ? approveCafeAction : rejectCafeAction

    try {
      const result = await actionFn(cafeId, accessToken)

      if (result.success) {
        showToast(result.message, "success")
        // Remove from local state
        setCafes((prev) => prev.filter((c) => c.id !== cafeId))
      } else {
        showToast(result.message, "error")
      }
    } catch {
      showToast("Terjadi kesalahan jaringan 😅", "error")
    } finally {
      setActionLoading(false)
      setConfirmDialog((prev) => ({ ...prev, open: false }))
    }
  }

  // ---------------------------------------------------------------------------
  // LOADING STATE — checking admin
  // ---------------------------------------------------------------------------
  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-[#1c1a19] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-[#a3630f] animate-spin" />
          <p className="text-white/50 text-sm font-medium">
            Verifying access...
          </p>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // ACCESS DENIED
  // ---------------------------------------------------------------------------
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#1c1a19] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="inline-flex p-4 rounded-2xl bg-red-500/10 border border-red-500/20 mb-6">
            <ShieldX className="w-12 h-12 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Access Denied 🚫
          </h1>
          <p className="text-white/50 text-sm mb-6">
            Kamu nggak punya akses ke halaman ini. Halaman ini cuma buat admin.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#a3630f] text-white
              font-semibold text-sm hover:bg-[#b87420] transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Balik ke Homepage
          </a>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // TABS CONFIG
  // ---------------------------------------------------------------------------
  const tabs: { key: TabFilter; label: string; icon: React.ReactNode }[] = [
    {
      key: "pending",
      label: "Pending",
      icon: <Clock className="w-4 h-4" />,
    },
    {
      key: "approved",
      label: "Approved",
      icon: <CheckCircle2 className="w-4 h-4" />,
    },
    {
      key: "rejected",
      label: "Rejected",
      icon: <XCircle className="w-4 h-4" />,
    },
  ]

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#1c1a19] text-white">
      {/* Toasts */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Confirm Dialog */}
      <ConfirmModal
        dialog={confirmDialog}
        loading={actionLoading}
        onConfirm={handleConfirm}
        onCancel={() =>
          setConfirmDialog((prev) => ({ ...prev, open: false }))
        }
      />

      {/* ===== HEADER ===== */}
      <header className="sticky top-0 z-50 bg-[#1c1a19]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Left — Title */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#a3630f]/15 border border-[#a3630f]/25">
              <Shield className="w-5 h-5 text-[#a3630f]" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
                Admin Dashboard
                <span className="text-base">🛡️</span>
              </h1>
              <p className="text-[11px] text-white/40 -mt-0.5 hidden sm:block">
                Moderasi cafe submissions
              </p>
            </div>
          </div>

          {/* Right — Count badge + refresh */}
          <div className="flex items-center gap-3">
            {!loading && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full
                  bg-[#a3630f]/15 border border-[#a3630f]/25 text-[#e8a54b]"
              >
                <Inbox className="w-3.5 h-3.5" />
                <span className="text-xs font-bold">{cafes.length}</span>
                <span className="text-xs font-medium hidden sm:inline">
                  pending
                </span>
              </div>
            )}
            <button
              onClick={fetchCafes}
              disabled={loading}
              className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/60
                hover:text-white hover:bg-white/10 transition-all disabled:opacity-40"
              title="Refresh"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
            <a
              href="/"
              className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/60
                hover:text-white hover:bg-white/10 transition-all"
              title="Back to homepage"
            >
              <LogOut className="w-4 h-4" />
            </a>
          </div>
        </div>
      </header>

      {/* ===== MAIN CONTENT ===== */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Filters */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
                transition-all whitespace-nowrap
                ${
                  activeTab === tab.key
                    ? "bg-[#a3630f] text-white shadow-lg shadow-[#a3630f]/20"
                    : "bg-white/5 text-white/50 border border-white/5 hover:bg-white/10 hover:text-white/70"
                }`}
            >
              {tab.icon}
              {tab.label}
              {tab.key === "pending" && !loading && (
                <span
                  className={`ml-1 text-[11px] px-1.5 py-0.5 rounded-full font-bold
                  ${
                    activeTab === "pending"
                      ? "bg-white/20 text-white"
                      : "bg-white/10 text-white/50"
                  }`}
                >
                  {cafes.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content Area */}
        {activeTab === "pending" ? (
          <>
            {/* Loading Skeletons */}
            {loading && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            )}

            {/* Empty State */}
            {!loading && cafes.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/15 mb-6">
                  <Sparkles className="w-12 h-12 text-emerald-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">
                  Belum ada cafe yang butuh review nih 🎉
                </h2>
                <p className="text-white/40 text-sm max-w-sm">
                  Semua submission udah di-review. Santai dulu, nanti cek lagi
                  ya~
                </p>
                <button
                  onClick={fetchCafes}
                  className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl
                    bg-white/5 border border-white/10 text-white/60 text-sm font-medium
                    hover:bg-white/10 hover:text-white transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  Cek Lagi
                </button>
              </div>
            )}

            {/* Cafe Cards Grid */}
            {!loading && cafes.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {cafes.map((cafe) => (
                  <div
                    key={cafe.id}
                    className="group rounded-2xl bg-[#252322] border border-white/5 overflow-hidden
                      hover:border-[#a3630f]/30 transition-all duration-300 hover:shadow-xl
                      hover:shadow-[#a3630f]/5"
                  >
                    {/* Image */}
                    <div className="relative h-48 overflow-hidden bg-white/5">
                      {cafe.image ? (
                        <Image
                          src={cafe.image}
                          alt={cafe.name}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Coffee className="w-10 h-10 text-white/15" />
                        </div>
                      )}
                      {/* Status Badge */}
                      <div className="absolute top-3 left-3">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                            bg-amber-500/20 backdrop-blur-md border border-amber-500/25
                            text-amber-300 text-[11px] font-bold uppercase tracking-wide"
                        >
                          <Clock className="w-3 h-3" />
                          Pending
                        </span>
                      </div>
                      {/* Category Badge */}
                      <div className="absolute top-3 right-3">
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full
                            bg-black/50 backdrop-blur-md border border-white/10
                            text-white/80 text-[11px] font-semibold"
                        >
                          <LayoutGrid className="w-3 h-3" />
                          {cafe.category}
                        </span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-5">
                      {/* Name & Area */}
                      <h3 className="text-base font-bold text-white mb-1 line-clamp-1">
                        {cafe.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-white/40 text-xs mb-3">
                        <MapPin className="w-3.5 h-3.5" />
                        <span className="line-clamp-1">{cafe.area}</span>
                      </div>

                      {/* Tags */}
                      {cafe.tags && cafe.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {cafe.tags.slice(0, 4).map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md
                                bg-white/5 text-white/50 text-[11px] font-medium border border-white/5"
                            >
                              <Tag className="w-2.5 h-2.5" />
                              {tag}
                            </span>
                          ))}
                          {cafe.tags.length > 4 && (
                            <span className="text-[11px] text-white/30 font-medium px-1">
                              +{cafe.tags.length - 4}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Description Preview */}
                      <p className="text-white/40 text-xs leading-relaxed line-clamp-2 mb-4">
                        {cafe.description}
                      </p>

                      {/* Submitted Date */}
                      <div className="flex items-center gap-1.5 text-white/25 text-[11px] mb-4">
                        <Clock className="w-3 h-3" />
                        <span>
                          Submitted{" "}
                          {cafe.createdBy
                            ? `by ${cafe.createdBy.slice(0, 8)}...`
                            : "anonymously"}
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2.5">
                        <button
                          onClick={() =>
                            openConfirm(cafe.id, cafe.name, "approve")
                          }
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5
                            rounded-xl bg-emerald-600/15 border border-emerald-500/20
                            text-emerald-400 text-sm font-semibold
                            hover:bg-emerald-600/25 hover:border-emerald-500/35
                            hover:text-emerald-300 transition-all active:scale-[0.97]"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Approve
                        </button>
                        <button
                          onClick={() =>
                            openConfirm(cafe.id, cafe.name, "reject")
                          }
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5
                            rounded-xl bg-red-600/15 border border-red-500/20
                            text-red-400 text-sm font-semibold
                            hover:bg-red-600/25 hover:border-red-500/35
                            hover:text-red-300 transition-all active:scale-[0.97]"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Placeholder for Approved / Rejected tabs */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="p-5 rounded-2xl bg-white/5 border border-white/5 mb-6">
              <AlertTriangle className="w-10 h-10 text-white/20" />
            </div>
            <h2 className="text-lg font-bold text-white/60 mb-2">
              Coming Soon ✨
            </h2>
            <p className="text-white/30 text-sm max-w-xs">
              Tab &quot;{activeTab === "approved" ? "Approved" : "Rejected"}
              &quot; belum tersedia. Lagi di-develop ya!
            </p>
          </div>
        )}
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-white/5 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <p className="text-white/20 text-xs">
            Jogja Cafe Finder — Admin Panel
          </p>
          <p className="text-white/20 text-xs">
            Made with ☕ for the cafe community
          </p>
        </div>
      </footer>
    </div>
  )
}
