'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { AdminUser, ROLE_LABELS, canAccess } from '@/lib/auth'

const NAV = [
  { key: 'dashboard',  href: '/admin/dashboard',  emoji: '📊', label: 'الرئيسية' },
  { key: 'orders',     href: '/admin/orders',      emoji: '🧾', label: 'الطلبات' },
  { key: 'menu',       href: '/admin/menu',        emoji: '🍽️', label: 'المنيو' },
  { key: 'inventory',  href: '/admin/inventory',   emoji: '📦', label: 'المخزون' },
  { key: 'suppliers',  href: '/admin/suppliers',   emoji: '🚚', label: 'الموردين' },
  { key: 'users',      href: '/admin/users',       emoji: '👥', label: 'المستخدمين' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (pathname === '/admin/login') { setLoading(false); return }
    fetch('/api/admin/me').then(r => r.json()).then(d => {
      if (!d.user) { router.push('/admin/login'); return }
      setUser(d.user)
      setLoading(false)
    }).catch(() => { router.push('/admin/login') })
  }, [pathname, router])

  const logout = async () => {
    await fetch('/api/admin/login', { method: 'DELETE' })
    router.push('/admin/login')
  }

  if (pathname === '/admin/login') return <>{children}</>
  if (loading) return (
    <div className="min-h-dvh bg-[#0f0e0d] flex items-center justify-center">
      <div className="text-white text-lg animate-pulse">جارٍ التحميل...</div>
    </div>
  )
  if (!user) return null

  const allowedNav = NAV.filter(n => canAccess(user.role, n.key))

  return (
    <div className="min-h-dvh bg-[#0f0e0d] flex" dir="rtl">
      {/* Sidebar overlay on mobile */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed top-0 right-0 h-full w-64 bg-[#141312] border-l border-[#2c2b29] z-40 flex flex-col transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'} lg:translate-x-0 lg:static lg:z-auto`}>
        {/* Logo */}
        <div className="p-5 border-b border-[#2c2b29]">
          <div className="text-white font-black text-lg">{process.env.NEXT_PUBLIC_RESTAURANT_NAME || 'Restaurant'}</div>
          <div className="text-[#8a8884] text-xs mt-0.5">لوحة التحكم</div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {allowedNav.map(n => (
            <a key={n.key} href={n.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                pathname.startsWith(n.href)
                  ? 'bg-[#e74c3c] text-white'
                  : 'text-[#8a8884] hover:bg-[#1f1e1c] hover:text-white'
              }`}>
              <span className="text-lg">{n.emoji}</span>
              <span>{n.label}</span>
            </a>
          ))}
        </nav>

        {/* User info */}
        <div className="p-4 border-t border-[#2c2b29]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-[#e74c3c] flex items-center justify-center text-white font-black text-sm">
              {user.name[0]}
            </div>
            <div>
              <div className="text-white text-sm font-bold">{user.name}</div>
              <div className="text-[#8a8884] text-xs">{ROLE_LABELS[user.role]}</div>
            </div>
          </div>
          <button onClick={logout}
            className="w-full text-[#8a8884] hover:text-[#e74c3c] text-xs font-bold py-2 rounded-lg border border-[#2c2b29] hover:border-[#e74c3c] transition-all">
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-h-dvh overflow-hidden">
        {/* Mobile topbar */}
        <div className="lg:hidden bg-[#141312] border-b border-[#2c2b29] px-4 py-3 flex items-center justify-between sticky top-0 z-20">
          <div className="text-white font-black">{process.env.NEXT_PUBLIC_RESTAURANT_NAME || 'Restaurant'}</div>
          <button onClick={() => setSidebarOpen(true)} className="text-white p-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
