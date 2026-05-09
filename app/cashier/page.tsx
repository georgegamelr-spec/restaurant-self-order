'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { OrderItem } from '@/types'

interface Product {
  id: string
  name_ar: string
  name_en: string
  price: number
  category: string
  emoji: string
  available: boolean
}

interface CartItem extends OrderItem {
  product_id: string
}

const CANCEL_REASONS = [
  'العميل غيّر رأيه',
  'خطأ في الطلب',
  'انتهى الصنف',
  'طلب مكرر',
  'سبب آخر',
]

const TABLES = Array.from({ length: 20 }, (_, i) => i + 1)

export default function CashierPage() {
  const [products, setProducts]       = useState<Product[]>([])
  const [cart, setCart]               = useState<CartItem[]>([])
  const [activeCategory, setActive]   = useState('all')
  const [selectedTable, setTable]     = useState<number>(1)
  const [notes, setNotes]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [loadingProducts, setLP]      = useState(true)
  const [toast, setToast]             = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

  // Cancel modal
  const [cancelOrderId, setCancelOrderId]   = useState<string | null>(null)
  const [cancelReason, setCancelReason]     = useState(CANCEL_REASONS[0])
  const [managerPass, setManagerPass]       = useState('')
  const [cancelError, setCancelError]       = useState('')
  const [cancelLoading, setCancelLoading]   = useState(false)
  const [lastOrderId, setLastOrderId]       = useState<string | null>(null)
  const [existingOrderId, setExistingOrderId] = useState<string | null>(null)
  const [tableLoading, setTableLoading]       = useState(false)

  useEffect(() => { loadProducts() }, [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadTableOrder(selectedTable) }, [selectedTable])

  const loadTableOrder = async (table: number) => {
    setTableLoading(true)
    setCart([])
    setExistingOrderId(null)
    try {
      const res = await fetch('/api/orders?table=' + table + '&status=submitted')
      const data = await res.json()
      const orders = (data.orders || []) as Array<{id: string; table_number: string; status: string; items: Array<{product_id?: string; menu_item_id: string; name: string; name_ar: string; emoji: string; price: number; qty: number}>}>
      const latest = orders.find(o => o.table_number === String(table) && o.status === 'submitted')
      if (latest) {
        setExistingOrderId(latest.id)
        setLastOrderId(latest.id)
        setCart(latest.items.map(item => ({
          ...item,
          product_id: item.product_id || item.menu_item_id,
        })))
      }
    } catch (_) {}
    setTableLoading(false)
  }

  const loadProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('available', true)
      .order('category')
    setProducts(data || [])
    setLP(false)
  }

  const categories = ['all', ...Array.from(new Set(products.map(p => p.category)))]

  const filtered = activeCategory === 'all'
    ? products
    : products.filter(p => p.category === activeCategory)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const addToCart = (product: Product) => {
    setCart(prev => {
      const ex = prev.find(i => i.product_id === product.id)
      if (ex) return prev.map(i => i.product_id === product.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, {
        product_id: product.id,
        menu_item_id: product.id,
        name: product.name_en,
        name_ar: product.name_ar,
        emoji: product.emoji,
        price: product.price,
        qty: 1,
      }]
    })
  }

  const changeQty = (id: string, delta: number) => {
    setCart(prev =>
      prev.map(i => i.product_id === id ? { ...i, qty: i.qty + delta } : i)
          .filter(i => i.qty > 0)
    )
  }

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const tax      = subtotal * 0.1
  const total    = subtotal + tax
  const cartCount = cart.reduce((s, i) => s + i.qty, 0)

  const submitOrder = async () => {
    if (!cart.length) return
    setLoading(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_number: String(selectedTable),
          session_id: `cashier_${Date.now()}`,
          items: cart,
          notes,
          guest_count: 1,
          source: 'cashier',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      setLastOrderId(data.order?.id || null)
      setCart([])
      setNotes('')
      setShowConfirm(false)
      showToast(`🎉 تم إرسال الطلب للطاولة ${selectedTable}!`)
    } catch (e: unknown) {
      showToast('❌ خطأ: ' + (e as Error).message)
    }
    setLoading(false)
  }

  const openCancelModal = () => {
    if (!lastOrderId) return
    setCancelOrderId(lastOrderId)
    setManagerPass('')
    setCancelReason(CANCEL_REASONS[0])
    setCancelError('')
  }

  const submitCancel = async () => {
    if (!cancelOrderId) return
    setCancelLoading(true)
    setCancelError('')
    const res = await fetch('/api/cancel-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: cancelOrderId, managerPassword: managerPass, reason: cancelReason }),
    })
    const data = await res.json()
    setCancelLoading(false)
    if (!res.ok) { setCancelError(data.error || 'حدث خطأ'); return }
    setCancelOrderId(null)
    setLastOrderId(null)
    showToast('✅ تم إلغاء الطلب')
  }

  return (
    <div className="min-h-screen bg-[#0f0e0d] text-white flex flex-col" dir="rtl">

      {/* ── Header ── */}
      <header className="bg-[#1a1917] border-b border-[#2a2927] px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black">🧾 واجهة الكاشير</h1>
          <p className="text-[#8a8884] text-xs mt-0.5">Bella Vista</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Table selector */}
          <div className="flex items-center gap-2">
            <span className="text-[#8a8884] text-sm">🪑</span>
            <div className="flex items-center gap-1 bg-[#2a2927] rounded-xl p-1">
              <button onClick={() => setTable(t => Math.max(1, t-1))} className="w-7 h-7 rounded-lg bg-[#3a3937] text-white font-black text-base hover:bg-[#4a4947] transition-all flex items-center justify-center">−</button>
              <span className="text-white font-black text-lg min-w-[2.5rem] text-center">{tableLoading ? "⏳" : existingOrderId ? "🟢 " : ""} طاولة {selectedTable}</span>
              <button onClick={() => setTable(t => Math.min(20, t+1))} className="w-7 h-7 rounded-lg bg-[#e67e22] text-white font-black text-base hover:bg-[#f39c12] transition-all flex items-center justify-center">+</button>
            </div>
          </div>
          {/* Cancel last order */}
          {lastOrderId && (
            <button
              onClick={openCancelModal}
              className="text-xs font-bold px-3 py-2 rounded-xl bg-[#2a1515] border border-[#e74c3c]/30 text-[#e74c3c] hover:bg-[#e74c3c]/20 transition-all"
            >
              ❌ إلغاء آخر طلب
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Products Panel ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Categories */}
          <div className="flex gap-2 px-4 py-3 overflow-x-auto border-b border-[#2a2927] bg-[#111110]">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActive(cat)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
                  activeCategory === cat
                    ? 'bg-[#e74c3c] border-[#e74c3c] text-white'
                    : 'bg-[#1a1917] border-[#2a2927] text-[#8a8884] hover:text-white'
                }`}
              >
                {cat === 'all' ? '🍽️ الكل' : cat}
              </button>
            ))}
          </div>

          {/* Products Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {loadingProducts ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="bg-[#1a1917] rounded-2xl h-28 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {filtered.map(product => {
                  const inCart = cart.find(i => i.product_id === product.id)
                  return (
                    <button
                      key={product.id}
                      onClick={() => addToCart(product)}
                      className={`relative bg-[#1a1917] border rounded-2xl p-4 text-right transition-all hover:border-[#e74c3c]/50 active:scale-95 ${
                        inCart ? 'border-[#e74c3c]/60 bg-[#1f1210]' : 'border-[#2a2927]'
                      }`}
                    >
                      <div className="text-3xl mb-2">{product.emoji}</div>
                      <div className="font-bold text-sm leading-tight">{product.name_ar}</div>
                      <div className="text-[#e74c3c] font-black text-sm mt-1">{product.price} ج</div>
                      {inCart && (
                        <div className="absolute top-2 left-2 bg-[#e74c3c] text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center">
                          {inCart.qty}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Cart Panel ── */}
        <div className="w-80 bg-[#1a1917] border-r border-[#2a2927] flex flex-col">
          <div className="px-5 py-4 border-b border-[#2a2927]">
            <h2 className="font-black text-lg">🛒 طلب طاولة {selectedTable}</h2>
            <p className="text-[#8a8884] text-xs mt-0.5">{cartCount} صنف</p>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {cart.length === 0 ? (
              <div className="text-center text-[#8a8884] py-12">
                <div className="text-4xl mb-3">🛒</div>
                <p className="text-sm">اضغط على أي صنف لإضافته</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.product_id} className="flex items-center justify-between bg-[#111110] rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span>{item.emoji}</span>
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{item.name_ar}</p>
                      <p className="text-[#e74c3c] text-xs font-black">{(item.price * item.qty).toFixed(0)} ج</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mr-2">
                    <button
                      onClick={() => changeQty(item.product_id, -1)}
                      className="w-7 h-7 rounded-full bg-[#2a2927] text-white font-bold flex items-center justify-center hover:bg-[#3a3936] transition-all"
                    >−</button>
                    <span className="w-5 text-center font-black text-sm">{item.qty}</span>
                    <button
                      onClick={() => changeQty(item.product_id, 1)}
                      className="w-7 h-7 rounded-full bg-[#e74c3c] text-white font-bold flex items-center justify-center hover:bg-[#c0392b] transition-all"
                    >+</button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Notes */}
          <div className="px-4 pb-2">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="ملاحظات (اختياري)..."
              rows={2}
              className="w-full bg-[#111110] border border-[#2a2927] rounded-xl p-3 text-white text-sm resize-none focus:border-[#e74c3c] outline-none"
            />
          </div>

          {/* Totals + Submit */}
          <div className="px-4 pb-5 pt-2 border-t border-[#2a2927]">
            <div className="space-y-1.5 mb-4">
              <div className="flex justify-between text-sm text-[#8a8884]">
                <span>المجموع</span><span>{subtotal.toFixed(0)} ج</span>
              </div>
              <div className="flex justify-between text-sm text-[#8a8884]">
                <span>ضريبة 10%</span><span>{tax.toFixed(0)} ج</span>
              </div>
              <div className="flex justify-between font-black text-lg text-white border-t border-[#2a2927] pt-2">
                <span>الإجمالي</span>
                <span className="text-[#e74c3c]">{total.toFixed(0)} ج</span>
              </div>
            </div>
            <button
              onClick={() => setShowConfirm(true)}
              disabled={!cart.length || loading}
              className="w-full bg-[#e74c3c] hover:bg-[#c0392b] text-white font-black py-4 rounded-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              🚀 إرسال للمطبخ
            </button>
          </div>
        </div>
      </div>

      {/* ── Confirm Modal ── */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-40 p-4">
          <div className="bg-[#1a1917] border border-[#3a3936] rounded-3xl w-full max-w-sm p-6" dir="rtl">
            <div className="text-center mb-5">
              <div className="text-4xl mb-2">🚀</div>
              <h3 className="text-xl font-black">تأكيد الطلب</h3>
              <p className="text-[#8a8884] text-sm mt-1">طاولة {selectedTable} · {cartCount} صنف · {total.toFixed(0)} ج</p>
            </div>
            <div className="space-y-2 mb-5 max-h-40 overflow-y-auto">
              {cart.map(item => (
                <div key={item.product_id} className="flex justify-between text-sm">
                  <span>{item.emoji} {item.name_ar} x{item.qty}</span>
                  <span className="text-[#e74c3c] font-bold">{(item.price * item.qty).toFixed(0)} ج</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 bg-[#2a2927] text-[#8a8884] font-bold py-3 rounded-xl hover:bg-[#3a3936] transition-all"
              >تراجع</button>
              <button
                onClick={submitOrder}
                disabled={loading}
                className="flex-1 bg-[#e74c3c] text-white font-black py-3 rounded-xl hover:bg-[#c0392b] transition-all disabled:opacity-40"
              >{loading ? '...' : 'تأكيد ✅'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel Modal ── */}
      {cancelOrderId && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1917] border border-[#e74c3c]/30 rounded-3xl w-full max-w-sm p-6" dir="rtl">
            <div className="text-center mb-5">
              <div className="text-4xl mb-2">🔐</div>
              <h3 className="text-xl font-black">إلغاء الطلب</h3>
              <p className="text-[#8a8884] text-sm mt-1">يتطلب موافقة المدير</p>
            </div>
            <div className="mb-4">
              <label className="text-sm text-[#8a8884] mb-2 block">سبب الإلغاء</label>
              <select
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                className="w-full bg-[#111110] border border-[#3a3936] rounded-xl px-4 py-3 text-white text-sm focus:border-[#e74c3c] outline-none"
              >
                {CANCEL_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="mb-4">
              <label className="text-sm text-[#8a8884] mb-2 block">باسورد المدير</label>
              <input
                type="password"
                value={managerPass}
                onChange={e => { setManagerPass(e.target.value); setCancelError('') }}
                placeholder="••••••••"
                className="w-full bg-[#111110] border border-[#3a3936] rounded-xl px-4 py-3 text-white text-sm focus:border-[#e74c3c] outline-none text-center tracking-widest"
                onKeyDown={e => e.key === 'Enter' && submitCancel()}
              />
            </div>
            {cancelError && (
              <div className="bg-[#3d0a0a] border border-[#e74c3c]/30 rounded-xl px-4 py-3 text-[#e74c3c] text-sm text-center mb-4">
                ⚠️ {cancelError}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setCancelOrderId(null)}
                className="flex-1 bg-[#2a2927] text-[#8a8884] font-bold py-3 rounded-xl hover:bg-[#3a3936] transition-all"
              >تراجع</button>
              <button
                onClick={submitCancel}
                disabled={!managerPass || cancelLoading}
                className="flex-1 bg-[#e74c3c] text-white font-black py-3 rounded-xl hover:bg-[#c0392b] transition-all disabled:opacity-40"
              >{cancelLoading ? '...' : 'تأكيد الإلغاء'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#e8e6e1] text-[#0f0e0d] px-6 py-3 rounded-full font-bold text-sm z-50 shadow-xl whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  )
}
