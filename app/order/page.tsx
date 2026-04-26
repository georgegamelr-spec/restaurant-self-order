'use client'

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { MenuItem, OrderItem } from '@/types'
import { MENU_ITEMS, CATEGORIES } from '@/lib/menu'

function genSessionId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function getSession(table: string): string {
  const key = `session_${table}`
  if (typeof window === 'undefined') return genSessionId()
  let s = sessionStorage.getItem(key)
  if (!s) { s = genSessionId(); sessionStorage.setItem(key, s) }
  return s
}

interface SavedOrder { items: OrderItem[]; orderId: string | null; submitted: boolean }

function getSavedOrder(table: string): SavedOrder {
  if (typeof window === 'undefined') return { items: [], orderId: null, submitted: false }
  try {
    const raw = sessionStorage.getItem(`order_${table}`)
    if (raw) return JSON.parse(raw) as SavedOrder
  } catch {}
  return { items: [], orderId: null, submitted: false }
}

function saveOrder(table: string, data: SavedOrder) {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(`order_${table}`, JSON.stringify(data))
}

const STATUS_DISPLAY: Record<string, { ar: string; color: string; emoji: string }> = {
  submitted:  { ar: 'تم استلام طلبك',   color: 'text-[#f39c12]', emoji: '⏳' },
  preparing:  { ar: 'جارٍ التحضير',      color: 'text-[#3498db]', emoji: '👨‍🍳' },
  ready:      { ar: 'طلبك جاهز!',        color: 'text-[#2ecc71]', emoji: '✅' },
  done:       { ar: 'تم التسليم، شكراً', color: 'text-[#8a8884]', emoji: '🎉' },
}

interface OrderData { id: string; items: OrderItem[]; status: string; total: number; notes: string }

function OrderPage() {
  const params = useSearchParams()
  const table = params.get('table') || '1'

  const [activeCategory, setActiveCategory] = useState('starters')
  const [cart, setCart] = useState<OrderItem[]>([])
  const [orderId, setOrderId] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [submittedItems, setSubmittedItems] = useState<Record<string, number>>({}) // id → min qty (can't go below)
  const [orderStatus, setOrderStatus] = useState<string>('submitted')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [showCart, setShowCart] = useState(false)
  const [addingMore, setAddingMore] = useState(false)
  const [toast, setToast] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const saved = getSavedOrder(table)
    setCart(saved.items)
    setOrderId(saved.orderId)
    setSubmitted(saved.submitted)
    if (saved.submitted && saved.items.length > 0) {
      const mins: Record<string, number> = {}
      saved.items.forEach((i: OrderItem) => { mins[i.menu_item_id] = i.qty })
      setSubmittedItems(mins)
    }
  }, [table])

  useEffect(() => {
    if (!orderId || !submitted) return
    const poll = async () => {
      try {
        const r = await fetch(`/api/orders/${orderId}`)
        const d = await r.json() as { order?: OrderData }
        if (d.order) setOrderStatus(d.order.status)
      } catch {}
    }
    poll()
    pollRef.current = setInterval(poll, 5000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [orderId, submitted])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const addItem = useCallback((item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.menu_item_id === item.id)
      const updated = existing
        ? prev.map(i => i.menu_item_id === item.id ? { ...i, qty: i.qty + 1 } : i)
        : [...prev, { menu_item_id: item.id, name: item.name, name_ar: item.name_ar, emoji: item.emoji, price: item.price, qty: 1 }]
      saveOrder(table, { items: updated, orderId, submitted })
      return updated
    })
    showToast(`✅ أُضيف: ${item.name_ar}`)
  }, [table, orderId, submitted])

  const removeItem = useCallback((id: string) => {
    if (submitted && submittedItems[id] !== undefined) return // 🔒 can't remove submitted items
    setCart(prev => {
      const updated = prev.filter(i => i.menu_item_id !== id)
      saveOrder(table, { items: updated, orderId, submitted: false })
      return updated
    })
  }, [table, orderId])

  const changeQty = useCallback((id: string, delta: number) => {
    // 🔒 can't go below original submitted quantity
    if (submitted && delta < 0) {
      const minQty = submittedItems[id]
      if (minQty !== undefined) {
        const currentQty = cart.find(i => i.menu_item_id === id)?.qty ?? 0
        if (currentQty <= minQty) return
      }
    }
    setCart(prev => {
      const updated = prev.map(i => i.menu_item_id === id ? { ...i, qty: i.qty + delta } : i).filter(i => i.qty > 0)
      saveOrder(table, { items: updated, orderId, submitted })
      return updated
    })
  }, [table, orderId, submitted, submittedItems, cart])

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const tax = subtotal * 0.1
  const total = subtotal + tax

  const submitOrder = async () => {
    if (!cart.length) return
    setLoading(true)
    try {
      const session_id = getSession(table)
      const r = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_number: table, session_id, items: cart, notes }),
      })
      const d = await r.json() as { order?: OrderData; error?: string }
      if (!r.ok) throw new Error(d.error || 'Error')
      const newOrderId = d.order!.id
      setOrderId(newOrderId)
      setSubmitted(true)
      setOrderStatus('submitted')
      setShowCart(false)
      saveOrder(table, { items: cart, orderId: newOrderId, submitted: true })
      // Lock current quantities as minimums
      const mins: Record<string, number> = {}
      cart.forEach(i => { mins[i.menu_item_id] = i.qty })
      setSubmittedItems(mins)
      showToast('🎉 تم إرسال طلبك!')
    } catch (e: unknown) {
      showToast('❌ خطأ: ' + (e as Error).message)
    }
    setLoading(false)
  }

  const submitAddMore = async () => {
    if (!addingMore || !orderId) return
    const saved = getSavedOrder(table)
    const newItems = cart.filter(i => !saved.items.find((s: OrderItem) => s.menu_item_id === i.menu_item_id))
    if (!newItems.length) { setAddingMore(false); return }
    setLoading(true)
    try {
      const session_id = getSession(table)
      const r = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_items', items: newItems, session_id }),
      })
      const d = await r.json() as { order?: OrderData; error?: string }
      if (!r.ok) throw new Error(d.error || 'Error')
      setCart(d.order!.items)
      saveOrder(table, { items: d.order!.items, orderId, submitted: true })
      // Update minimums to include newly added items
      const newMins: Record<string, number> = {}
      d.order!.items.forEach((i: OrderItem) => { newMins[i.menu_item_id] = i.qty })
      setSubmittedItems(newMins)
      setAddingMore(false)
      showToast('✅ تمت الإضافة!')
    } catch (e: unknown) {
      showToast('❌ خطأ: ' + (e as Error).message)
    }
    setLoading(false)
  }

  const filteredItems = MENU_ITEMS.filter(i => i.category === activeCategory && i.available)
  const cartCount = cart.reduce((s, i) => s + i.qty, 0)

  if (submitted && !addingMore) {
    const sd = STATUS_DISPLAY[orderStatus] || STATUS_DISPLAY.submitted
    return (
      <div className="min-h-dvh bg-[#0f0e0d] flex flex-col" dir="rtl">
        <div className="bg-[#1a1917] border-b border-[#2c2b29] px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-white font-black text-lg">طاولة {table}</div>
            <div className="text-[#8a8884] text-xs">رقم الطلب: {orderId?.slice(0,8)}...</div>
          </div>
          <div className="text-2xl">{sd.emoji}</div>
        </div>
        <div className="p-4">
          <div className="bg-[#1a1917] border border-[#2c2b29] rounded-2xl p-5 text-center mb-4">
            <div className="text-5xl mb-3">{sd.emoji}</div>
            <div className={`text-xl font-black mb-1 ${sd.color}`}>{sd.ar}</div>
            <div className="text-[#8a8884] text-xs">يتم التحديث كل 5 ثوانٍ تلقائياً</div>
            <div className="flex justify-center gap-2 mt-3">
              {['submitted','preparing','ready','done'].map(s => (
                <div key={s} className={`w-2 h-2 rounded-full transition-all ${
                  s === orderStatus ? 'bg-[#e74c3c] scale-125' :
                  ['submitted','preparing','ready','done'].indexOf(s) < ['submitted','preparing','ready','done'].indexOf(orderStatus)
                    ? 'bg-[#6daa45]' : 'bg-[#3a3936]'
                }`} />
              ))}
            </div>
          </div>
          <div className="bg-[#1a1917] border border-[#2c2b29] rounded-2xl p-4 mb-4">
            <div className="text-white font-bold mb-3 text-sm">ملخص طلبك</div>
            {cart.map(item => (
              <div key={item.menu_item_id} className="flex justify-between items-center py-2 border-b border-[#2c2b29] last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{item.emoji}</span>
                  <span className="text-[#e8e6e1] text-sm">{item.name_ar}</span>
                </div>
                <div className="text-right">
                  <span className="text-[#8a8884] text-xs">x{item.qty}</span>
                  <span className="text-[#f39c12] text-sm font-bold mr-2">${(item.price * item.qty).toFixed(2)}</span>
                </div>
              </div>
            ))}
            <div className="flex justify-between mt-3 pt-2 border-t border-[#3a3936]">
              <span className="text-white font-black">الإجمالي</span>
              <span className="text-[#f39c12] font-black">${(cart.reduce((s,i)=>s+i.price*i.qty,0)*1.1).toFixed(2)}</span>
            </div>
          </div>
          {['submitted','preparing'].includes(orderStatus) && (
            <button onClick={() => setAddingMore(true)}
              className="w-full bg-[#1f1e1c] hover:bg-[#2a2927] border border-[#3a3936] text-white font-bold py-4 rounded-2xl transition-all text-sm">
              ➕ إضافة المزيد للطلب
            </button>
          )}
        </div>
        {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#e8e6e1] text-[#0f0e0d] px-5 py-3 rounded-full font-bold text-sm z-50 shadow-xl animate-fade-up">{toast}</div>}
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-[#0f0e0d] flex flex-col pb-24" dir="rtl">
      <div className="bg-[#1a1917] border-b border-[#2c2b29] px-4 py-3 sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-white font-black text-lg">{addingMore ? '➕ إضافة للطلب' : `🍽️ طاولة ${table}`}</div>
            <div className="text-[#8a8884] text-xs">{addingMore ? 'أضف أصناف جديدة فقط' : (process.env.NEXT_PUBLIC_RESTAURANT_NAME || 'Restaurant Self Order')}</div>
          </div>
          {addingMore && <button onClick={() => setAddingMore(false)} className="text-[#8a8884] text-sm px-3 py-1 rounded-lg border border-[#3a3936]">إلغاء</button>}
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto px-4 py-3 sticky top-[57px] bg-[#0f0e0d] z-10" style={{scrollbarWidth:'none'}}>
        {CATEGORIES.map(cat => (
          <button key={cat.key} onClick={() => setActiveCategory(cat.key)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all border ${activeCategory === cat.key ? 'bg-[#e74c3c] border-[#e74c3c] text-white' : 'bg-[#1a1917] border-[#3a3936] text-[#8a8884] hover:text-white'}`}>
            <span>{cat.emoji}</span><span>{cat.label_ar}</span>
          </button>
        ))}
      </div>
      <div className="px-4 pb-4 grid grid-cols-1 gap-3">
        {filteredItems.map((item, i) => {
          const inCart = cart.find(c => c.menu_item_id === item.id)
          return (
            <div key={item.id} className="bg-[#1a1917] border border-[#2c2b29] rounded-2xl p-4 flex items-center gap-3 animate-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
              <div className="text-4xl flex-shrink-0">{item.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-bold text-sm">{item.name_ar}</div>
                <div className="text-[#5a5957] text-xs mt-0.5 truncate">{item.description_ar}</div>
                <div className="text-[#f39c12] font-black mt-1">${item.price.toFixed(2)}</div>
              </div>
              <div className="flex-shrink-0">
                {inCart ? (
                  <div className="flex items-center gap-2">
                    <button onClick={() => changeQty(item.id, -1)} disabled={submitted && (cart.find(c=>c.menu_item_id===item.id)?.qty ?? 0) <= (submittedItems[item.id] ?? 0)}
                      className="w-8 h-8 rounded-full bg-[#2a2927] border border-[#3a3936] text-white font-bold disabled:opacity-30 flex items-center justify-center">−</button>
                    <span className="text-white font-black w-5 text-center">{inCart.qty}</span>
                    <button onClick={() => addItem(item)} className="w-8 h-8 rounded-full bg-[#e74c3c] text-white font-bold flex items-center justify-center">+</button>
                  </div>
                ) : (
                  <button onClick={() => addItem(item)} className="w-10 h-10 rounded-full bg-[#e74c3c] hover:bg-[#c0392b] text-white font-black text-xl flex items-center justify-center transition-all active:scale-90">+</button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0f0e0d] to-transparent z-30">
          <button onClick={() => addingMore ? submitAddMore() : setShowCart(true)} disabled={loading}
            className="w-full bg-[#e74c3c] hover:bg-[#c0392b] text-white font-black py-4 rounded-2xl flex items-center justify-between px-5 transition-all shadow-2xl disabled:opacity-60">
            <span className="bg-white/20 rounded-full w-7 h-7 flex items-center justify-center text-sm">{cartCount}</span>
            <span>{addingMore ? (loading ? 'جارٍ الإضافة...' : 'تأكيد الإضافة') : 'عرض الطلب'}</span>
            <span className="font-black">${total.toFixed(2)}</span>
          </button>
        </div>
      )}
      {showCart && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCart(false)} />
          <div className="relative bg-[#1a1917] rounded-t-3xl p-5 max-h-[85dvh] overflow-y-auto animate-fade-up border-t border-[#3a3936]">
            <div className="w-12 h-1 bg-[#3a3936] rounded-full mx-auto mb-5" />
            <h2 className="text-white font-black text-xl mb-4">طلبك 🛒</h2>
            {cart.map(item => (
              <div key={item.menu_item_id} className="flex items-center gap-3 py-3 border-b border-[#2c2b29]">
                <span className="text-2xl">{item.emoji}</span>
                <div className="flex-1">
                  <div className="text-white text-sm font-bold">{item.name_ar}</div>
                  <div className="text-[#f39c12] text-xs font-bold">${(item.price * item.qty).toFixed(2)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => changeQty(item.menu_item_id, -1)} disabled={submitted && item.qty <= (submittedItems[item.menu_item_id] ?? 0)} className="w-7 h-7 rounded-full bg-[#2a2927] border border-[#3a3936] text-white flex items-center justify-center text-sm disabled:opacity-20">−</button>
                  <span className="text-white font-black w-4 text-center">{item.qty}</span>
                  <button onClick={() => changeQty(item.menu_item_id, 1)} className="w-7 h-7 rounded-full bg-[#e74c3c] text-white flex items-center justify-center text-sm">+</button>
                  {(!submitted || submittedItems[item.menu_item_id] === undefined) && <button onClick={() => removeItem(item.menu_item_id)} className="w-7 h-7 rounded-full bg-[#2a2927] text-[#8a8884] flex items-center justify-center text-xs mr-1">✕</button>}
                </div>
              </div>
            ))}
            <div className="mt-4 mb-4">
              <label className="text-[#8a8884] text-xs font-bold mb-1.5 block">ملاحظات (اختياري)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="مثال: بدون بصل، حساسية من المكسرات..." className="w-full bg-[#0f0e0d] border border-[#3a3936] rounded-xl p-3 text-white text-sm resize-none focus:border-[#e74c3c] outline-none" rows={2} />
            </div>
            <div className="bg-[#0f0e0d] rounded-xl p-4 mb-4">
              <div className="flex justify-between text-sm text-[#8a8884] mb-1.5"><span>المجموع الجزئي</span><span>${subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm text-[#8a8884] mb-3"><span>ضريبة (10%)</span><span>${tax.toFixed(2)}</span></div>
              <div className="flex justify-between font-black text-white text-lg border-t border-[#3a3936] pt-3"><span>الإجمالي</span><span className="text-[#f39c12]">${total.toFixed(2)}</span></div>
            </div>
            <button onClick={submitOrder} disabled={loading || !cart.length} className="w-full bg-[#e74c3c] hover:bg-[#c0392b] text-white font-black py-4 rounded-2xl text-lg transition-all disabled:opacity-60 active:scale-[0.98]">
              {loading ? '⏳ جارٍ الإرسال...' : '🚀 إرسال الطلب'}
            </button>
          </div>
        </div>
      )}
      {toast && <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#e8e6e1] text-[#0f0e0d] px-5 py-3 rounded-full font-bold text-sm z-50 shadow-xl animate-fade-up whitespace-nowrap">{toast}</div>}
    </div>
  )
}

export default function OrderPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#0f0e0d] flex items-center justify-center text-white">جارٍ التحميل...</div>}>
      <OrderPage />
    </Suspense>
  )
}
