'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const r = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const d = await r.json()
    if (!r.ok) { setError(d.error); setLoading(false); return }
    router.push('/admin/dashboard')
  }

  return (
    <div className="min-h-dvh bg-[#0f0e0d] flex items-center justify-center p-5" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🔐</div>
          <h1 className="text-white font-black text-2xl">{process.env.NEXT_PUBLIC_RESTAURANT_NAME || 'Restaurant'}</h1>
          <p className="text-[#8a8884] text-sm mt-1">لوحة التحكم</p>
        </div>
        <form onSubmit={submit} className="bg-[#1a1917] border border-[#2c2b29] rounded-3xl p-6 space-y-4">
          <div>
            <label className="text-[#8a8884] text-xs font-bold block mb-1.5">اسم المستخدم</label>
            <input value={username} onChange={e => setUsername(e.target.value)} required
              className="w-full bg-[#0f0e0d] border border-[#3a3936] rounded-xl px-4 py-3 text-white text-sm focus:border-[#e74c3c] outline-none transition-all"
              placeholder="admin" />
          </div>
          <div>
            <label className="text-[#8a8884] text-xs font-bold block mb-1.5">كلمة المرور</label>
            <input value={password} onChange={e => setPassword(e.target.value)} required type="password"
              className="w-full bg-[#0f0e0d] border border-[#3a3936] rounded-xl px-4 py-3 text-white text-sm focus:border-[#e74c3c] outline-none transition-all"
              placeholder="••••••••" />
          </div>
          {error && <div className="bg-[#3d1c18] border border-[#e74c3c]/30 text-[#e74c3c] text-sm px-4 py-2.5 rounded-xl">{error}</div>}
          <button type="submit" disabled={loading}
            className="w-full bg-[#e74c3c] hover:bg-[#c0392b] text-white font-black py-3.5 rounded-xl transition-all disabled:opacity-60">
            {loading ? 'جارٍ الدخول...' : 'دخول'}
          </button>
        </form>
        <p className="text-center text-[#5a5957] text-xs mt-4">المستخدم الافتراضي: admin / admin123</p>
      </div>
    </div>
  )
}
