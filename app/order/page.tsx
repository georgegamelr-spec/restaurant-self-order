'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { MenuItem, OrderItem } from '@/types'
import { MENU_ITEMS, CATEGORIES } from '@/lib/menu'

// ─── Session & Storage ───────────────────────────────────────────────────────

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

interface Snapshot {
  cart: OrderItem[]
  orderId: string | null
  submitted: boolean
  lockedQty: Record<string, number>
  guestCount: number | null
}

function load(table: string): Snapshot {
  if (typeof window === 'undefined') return { cart: [], orderId: null, submitted: false, lockedQty: {}, guestCount: null }
  try {
    const raw = sessionStorage.getItem(`snap_${table}`)
    if (raw) return JSON.parse(raw) as Snapshot
  } catch {}
  return { cart: [], orderId: null, submitted: false, lockedQty: {}, guestCount: null }
}
function save(table: string, snap: Snapshot) {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(`snap_${table}`, JSON.stringify(snap))
}

// ─── Status Display ───────────────────────────────────────────────────────────

const STATUS: Record<string, { ar: string; color: string; emoji: string }> = {
  submitted: { ar: 'تم استلام طلبك',   color: 'text-[#f39c12]', emoji: '⏳' },
  preparing: { ar: 'جارٍ التحضير',      color: 'text-[#3498db]', emoji: '👨‍🍳' },
  ready:     { ar: 'طلبك جاهز!',        color: 'text-[#2ecc71]', emoji: '✅' },
  done:      { ar: 'تم التسليم، شكراً', color: 'text-[#8a8884]', emoji: '🎉' },
}
const STATUS_STEPS = ['submitted', 'preparing', 'ready', 'done']

interface OrderData { id: string; items: OrderItem[]; status: string; total: number; notes: string }

// ─── Main Component ───────────────────────────────────────────────────────────

function OrderPage() {
  const params = useSearchParams()
  const table = params.get('table') || '1'

  const [cart, setCart]               = useState<OrderItem[]>([])
  const [orderId, setOrderId]         = useState<string | null>(null)
  const [submitted, setSubmitted]     = useState(false)
  // lockedQty: minimum qty per item — set at submit, updated after each addMore confirm
  const [lockedQty, setLockedQty]     = useState<Record<string, number>>({})
  const [orderStatus, setOrderStatus] = useState('submitted')
  const [notes, setNotes]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [showCart, setShowCart]       = useState(false)
  const [addingMore, setAddingMore]   = useState(false)
  const [guestCount, setGuestCount]   = useState<number | null>(null)
  const [activeCategory, setActiveCategory] = useState('starters')
  const [toast, setToast]             = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Load from storage on mount
  useEffect(() => {
    const snap = load(table)
    setCart(snap.cart)
    setOrderId(snap.orderId)
    setSubmitted(snap.submitted)
    setLockedQty(snap.lockedQty)
    setGuestCount(snap.guestCount ?? null)
  }, [table])

  // ── Poll order status
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

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  // ── Can we decrease / remove this item?
  // Rule: if item has a lockedQty, its qty can never go below that value
  const canDecrease = (id: string, currentQty: number) => {
    const min = lockedQty[id] ?? 0
    return currentQty > min
  }
  const canRemove = (id: string) => {
    // Can remove only if NOT locked (not in lockedQty at all)
    return lockedQty[id] === undefined
  }

  // ── Cart mutations
  const addItem = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.menu_item_id === item.id)
      const updated = existing
        ? prev.map(i => i.menu_item_id === item.id ? { ...i, qty: i.qty + 1 } : i)
        : [...prev, { menu_item_id: item.id, name: item.name, name_ar: item.name_ar, emoji: item.emoji, price: item.price, qty: 1 }]
      save(table, { cart: updated, orderId, submitted, lockedQty, guestCount })
      return updated
    })
    showToast(`✅ أُضيف: ${item.name_ar}`)
  }

  const changeQty = (id: string, delta: number) => {
    const item = cart.find(i => i.menu_item_id === id)
    if (!item) return
    if (delta < 0 && !canDecrease(id, item.qty)) return // 🔒 blocked
    const newQty = item.qty + delta
    if (newQty <= 0 && !canRemove(id)) return // 🔒 can't delete locked item
    setCart(prev => {
      const updated = prev
        .map(i => i.menu_item_id === id ? { ...i, qty: i.qty + delta } : i)
        .filter(i => i.qty > 0)
      save(table, { cart: updated, orderId, submitted, lockedQty })
      return updated
    })
  }

  const removeItem = (id: string) => {
    if (!canRemove(id)) return // 🔒 blocked
    setCart(prev => {
      const updated = prev.filter(i => i.menu_item_id !== id)
      save(table, { cart: updated, orderId, submitted, lockedQty, guestCount })
      return updated
    })
  }

  // ── Submit first order
  const submitOrder = async () => {
    if (!cart.length) return
    setLoading(true)
    try {
      const r = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_number: table, session_id: getSession(table), items: cart, notes, guest_count: guestCount }),
      })
      const d = await r.json() as { order?: OrderData; error?: string }
      if (!r.ok) throw new Error(d.error || 'Error')

      const newOrderId = d.order!.id
      // Lock current cart quantities
      const newLocked: Record<string, number> = {}
      cart.forEach(i => { newLocked[i.menu_item_id] = i.qty })

      setOrderId(newOrderId)
      setSubmitted(true)
      setOrderStatus('submitted')
      setLockedQty(newLocked)
      setShowCart(false)
      save(table, { cart, orderId: newOrderId, submitted: true, lockedQty: newLocked, guestCount })
      showToast('🎉 تم إرسال طلبك!')
    } catch (e: unknown) {
      showToast('❌ خطأ: ' + (e as Error).message)
    }
    setLoading(false)
  }

  // ── Submit addMore (only truly new items)
  const submitAddMore = async () => {
    if (!orderId) return
    // Items to send:
    // 1. Brand new items (not in lockedQty)
    // 2. Locked items whose qty was INCREASED (send the diff as qty)
    const itemsToSend: OrderItem[] = []
    cart.forEach(i => {
      const minQty = lockedQty[i.menu_item_id]
      if (minQty === undefined) {
        // New item — send full qty
        itemsToSend.push(i)
      } else if (i.qty > minQty) {
        // Locked item increased — send only the diff
        itemsToSend.push({ ...i, qty: i.qty - minQty })
      }
    })
    if (!itemsToSend.length) { setAddingMore(false); return }
    setLoading(true)
    try {
      const r = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_items', items: itemsToSend, session_id: getSession(table) }),
      })
      const d = await r.json() as { order?: OrderData; error?: string }
      if (!r.ok) throw new Error(d.error || 'Error')

      // Update locked qty for all items in the confirmed order
      const newLocked = { ...lockedQty }
      d.order!.items.forEach((i: OrderItem) => { newLocked[i.menu_item_id] = i.qty })

      setCart(d.order!.items)
      setLockedQty(newLocked)
      setAddingMore(false)
      save(table, { cart: d.order!.items, orderId, submitted: true, lockedQty: newLocked, guestCount })
      showToast('✅ تمت الإضافة!')
    } catch (e: unknown) {
      showToast('❌ خطأ: ' + (e as Error).message)
    }
    setLoading(false)
  }

  // ── Cancel addMore: remove any unlocked items from cart
  const cancelAddMore = () => {
    // Restore cart: keep locked items at their locked qty, remove new unlocked items
    const restored = cart
      .filter(i => lockedQty[i.menu_item_id] !== undefined)
      .map(i => ({ ...i, qty: lockedQty[i.menu_item_id] }))
    setCart(restored)
    save(table, { cart: restored, orderId, submitted, lockedQty, guestCount })
    setAddingMore(false)
  }

  // ─── Derived
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const tax = subtotal * 0.1
  const total = subtotal + tax
  const cartCount = cart.reduce((s, i) => s + i.qty, 0)
  const filteredItems = MENU_ITEMS.filter(i => i.category === activeCategory && i.available)

  // ─── Status screen (after submit, not in addingMore)
  if (submitted && !addingMore) {
    const sd = STATUS[orderStatus] || STATUS.submitted
    return (
      <div className="min-h-dvh bg-[#0f0e0d] flex flex-col" dir="rtl">
        <div className="bg-[#1a1917] border-b border-[#2c2b29] px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-white font-black text-lg">طاولة {table}</div>
            <div className="text-[#8a8884] text-xs">#{orderId?.slice(0,8)}</div>
          </div>
          <div className="text-2xl">{sd.emoji}</div>
        </div>
        <div className="p-4 space-y-4">
          {/* Status card */}
          <div className="bg-[#1a1917] border border-[#2c2b29] rounded-2xl p-5 text-center">
            <div className="text-5xl mb-3">{sd.emoji}</div>
            <div className={`text-xl font-black mb-1 ${sd.color}`}>{sd.ar}</div>
            <div className="text-[#8a8884] text-xs mb-3">يتم التحديث كل 5 ثوانٍ تلقائياً</div>
            <div className="flex justify-center gap-2">
              {STATUS_STEPS.map(s => (
                <div key={s} className={`w-2 h-2 rounded-full transition-all ${
                  s === orderStatus ? 'bg-[#e74c3c] scale-125' :
                  STATUS_STEPS.indexOf(s) < STATUS_STEPS.indexOf(orderStatus) ? 'bg-[#6daa45]' : 'bg-[#3a3936]'
                }`} />
              ))}
            </div>
          </div>

          {/* Order summary */}
          <div className="bg-[#1a1917] border border-[#2c2b29] rounded-2xl p-4">
            <div className="text-white font-bold mb-3 text-sm">ملخص طلبك</div>
            {cart.map(item => (
              <div key={item.menu_item_id} className="flex justify-between items-center py-2 border-b border-[#2c2b29] last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{item.emoji}</span>
                  <span className="text-[#e8e6e1] text-sm">{item.name_ar}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#8a8884] text-xs">x{item.qty}</span>
                  <span className="text-[#f39c12] text-sm font-bold">${(item.price * item.qty).toFixed(2)}</span>
                </div>
              </div>
            ))}
            <div className="flex justify-between mt-3 pt-2 border-t border-[#3a3936]">
              <span className="text-white font-black">الإجمالي</span>
              <span className="text-[#f39c12] font-black">${(subtotal * 1.1).toFixed(2)}</span>
            </div>
          </div>

          {/* Add more button */}
          {['submitted', 'preparing'].includes(orderStatus) && (
            <button onClick={() => setAddingMore(true)}
              className="w-full bg-[#1f1e1c] hover:bg-[#2a2927] border border-[#3a3936] text-white font-bold py-4 rounded-2xl transition-all text-sm">
              ➕ إضافة المزيد للطلب
            </button>
          )}
        </div>
        {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#e8e6e1] text-[#0f0e0d] px-5 py-3 rounded-full font-bold text-sm z-50 shadow-xl whitespace-nowrap">{toast}</div>}
      </div>
    )
  }

  // ─── Guest count screen (shown before menu if guestCount not set)
  if (guestCount === null) {
    return (
      <div className="min-h-dvh bg-[#0f0e0d] flex flex-col items-center justify-center p-6" dir="rtl">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🍽️</div>
            <h1 className="text-white font-black text-2xl mb-1">{process.env.NEXT_PUBLIC_RESTAURANT_NAME || 'Restaurant'}</h1>
            <p className="text-[#8a8884] text-sm">طاولة رقم {table}</p>
          </div>
          <div className="bg-[#1a1917] border border-[#2c2b29] rounded-3xl p-6">
            <h2 className="text-white font-black text-lg mb-1 text-center">أهلاً وسهلاً! 👋</h2>
            <p className="text-[#8a8884] text-sm text-center mb-6">كم عدد الأفراد على طاولتك؟</p>
            <div className="grid grid-cols-4 gap-3 mb-6">
              {[1,2,3,4,5,6,7,8].map(n => (
                <button key={n} onClick={() => {
                  setGuestCount(n)
                  save(table, { cart, orderId, submitted, lockedQty, guestCount: n })
                }}
                  className="aspect-square rounded-2xl bg-[#2a2927] border border-[#3a3936] text-white font-black text-xl hover:bg-[#e74c3c] hover:border-[#e74c3c] transition-all active:scale-90">
                  {n}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[#8a8884] text-sm whitespace-nowrap">أكثر من 8؟</span>
              <div className="flex items-center gap-2 flex-1">
                <button onClick={() => {
                  const n = parseInt(prompt('أدخل عدد الأفراد:') || '0')
                  if (n > 0) { setGuestCount(n); save(table, { cart, orderId, submitted, lockedQty, guestCount: n }) }
                }}
                  className="flex-1 bg-[#2a2927] border border-[#3a3936] text-[#8a8884] font-bold py-3 rounded-xl text-sm hover:border-white hover:text-white transition-all">
                  أدخل العدد يدوياً
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Menu screen (before submit OR during addingMore)
  return (
    <div className="min-h-dvh bg-[#0f0e0d] flex flex-col pb-28" dir="rtl">
      {/* Header */}
      <div className="bg-[#1a1917] border-b border-[#2c2b29] px-4 py-3 sticky top-0 z-20 flex items-center justify-between">
        <div>
          <div className="text-white font-black text-lg">{addingMore ? '➕ إضافة للطلب' : `🍽️ طاولة ${table}`}</div>
          <div className="text-[#8a8884] text-xs">{addingMore ? 'يمكنك إضافة أصناف جديدة' : `${process.env.NEXT_PUBLIC_RESTAURANT_NAME || 'Restaurant'} · ${guestCount} أفراد`}</div>
        </div>
        {addingMore && (
          <button onClick={cancelAddMore} className="text-[#8a8884] text-sm px-3 py-1.5 rounded-xl border border-[#3a3936] hover:border-white transition-all">
            إلغاء
          </button>
        )}
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto px-4 py-3 sticky top-[57px] bg-[#0f0e0d] z-10" style={{scrollbarWidth:'none'}}>
        {CATEGORIES.map(cat => (
          <button key={cat.key} onClick={() => setActiveCategory(cat.key)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all border ${activeCategory === cat.key ? 'bg-[#e74c3c] border-[#e74c3c] text-white' : 'bg-[#1a1917] border-[#3a3936] text-[#8a8884] hover:text-white'}`}>
            <span>{cat.emoji}</span><span>{cat.label_ar}</span>
          </button>
        ))}
      </div>

      {/* Menu items */}
      <div className="px-4 pb-4 grid grid-cols-1 gap-3">
        {filteredItems.map((item, idx) => {
          const inCart = cart.find(c => c.menu_item_id === item.id)
          const isLocked = lockedQty[item.id] !== undefined // was in a previous submitted order
          const atMin = inCart ? !canDecrease(item.id, inCart.qty) : true

          // During addingMore: locked items CAN be increased but NOT decreased below lockedQty
          if (addingMore && isLocked) {
            return (
              <div key={item.id} className="bg-[#1a1917] border border-[#2c2b29] rounded-2xl p-4 flex items-center gap-3">
                <div className="text-4xl flex-shrink-0">{item.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-bold text-sm">{item.name_ar}</div>
                  <div className="text-[#5a5957] text-xs mt-0.5 truncate">{item.description_ar}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[#f39c12] font-black">${item.price.toFixed(2)}</span>
                    <span className="text-[#5a5957] text-xs bg-[#2a2927] px-2 py-0.5 rounded-full">مرسل ✓</span>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {inCart ? (
                    <div className="flex items-center gap-2">
                      <button onClick={() => changeQty(item.id, -1)}
                        disabled={atMin}
                        className="w-8 h-8 rounded-full bg-[#2a2927] border border-[#3a3936] text-white font-bold disabled:opacity-20 flex items-center justify-center active:scale-90 transition-all">−</button>
                      <span className="text-white font-black w-5 text-center">{inCart.qty}</span>
                      <button onClick={() => addItem(item)}
                        className="w-8 h-8 rounded-full bg-[#e74c3c] text-white font-bold flex items-center justify-center active:scale-90 transition-all">+</button>
                    </div>
                  ) : (
                    <button onClick={() => addItem(item)}
                      className="w-10 h-10 rounded-full bg-[#e74c3c] hover:bg-[#c0392b] text-white font-black text-xl flex items-center justify-center transition-all active:scale-90">+</button>
                  )}
                </div>
              </div>
            )
          }

          return (
            <div key={item.id} className="bg-[#1a1917] border border-[#2c2b29] rounded-2xl p-4 flex items-center gap-3" style={{animationDelay:`${idx*30}ms`}}>
              <div className="text-4xl flex-shrink-0">{item.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-bold text-sm">{item.name_ar}</div>
                <div className="text-[#5a5957] text-xs mt-0.5 truncate">{item.description_ar}</div>
                <div className="text-[#f39c12] font-black mt-1">${item.price.toFixed(2)}</div>
              </div>
              <div className="flex-shrink-0">
                {inCart ? (
                  <div className="flex items-center gap-2">
                    <button onClick={() => changeQty(item.id, -1)}
                      disabled={atMin}
                      className="w-8 h-8 rounded-full bg-[#2a2927] border border-[#3a3936] text-white font-bold disabled:opacity-20 flex items-center justify-center active:scale-90 transition-all">−</button>
                    <span className="text-white font-black w-5 text-center">{inCart.qty}</span>
                    <button onClick={() => addItem(item)}
                      className="w-8 h-8 rounded-full bg-[#e74c3c] text-white font-bold flex items-center justify-center active:scale-90 transition-all">+</button>
                  </div>
                ) : (
                  <button onClick={() => addItem(item)}
                    className="w-10 h-10 rounded-full bg-[#e74c3c] hover:bg-[#c0392b] text-white font-black text-xl flex items-center justify-center transition-all active:scale-90">+</button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0f0e0d] via-[#0f0e0d]/90 to-transparent z-30">
          <button onClick={() => addingMore ? submitAddMore() : setShowCart(true)}
            disabled={loading}
            className="w-full bg-[#e74c3c] hover:bg-[#c0392b] text-white font-black py-4 rounded-2xl flex items-center justify-between px-5 transition-all shadow-2xl disabled:opacity-60 active:scale-[0.98]">
            <span className="bg-white/20 rounded-full w-7 h-7 flex items-center justify-center text-sm">{cartCount}</span>
            <span>{addingMore ? (loading ? 'جارٍ الإضافة...' : 'تأكيد الإضافة') : 'عرض الطلب'}</span>
            <span className="font-black">${total.toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* Cart drawer */}
      {showCart && !addingMore && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCart(false)} />
          <div className="relative bg-[#1a1917] rounded-t-3xl p-5 max-h-[85dvh] overflow-y-auto border-t border-[#3a3936]">
            <div className="w-12 h-1 bg-[#3a3936] rounded-full mx-auto mb-5" />
            <h2 className="text-white font-black text-xl mb-4">طلبك 🛒</h2>
            {cart.map(item => {
              const locked = lockedQty[item.menu_item_id] !== undefined
              const atMinQty = !canDecrease(item.menu_item_id, item.qty)
              return (
                <div key={item.menu_item_id} className="flex items-center gap-3 py-3 border-b border-[#2c2b29]">
                  <span className="text-2xl">{item.emoji}</span>
                  <div className="flex-1">
                    <div className="text-white text-sm font-bold">{item.name_ar}</div>
                    <div className="text-[#f39c12] text-xs font-bold">${(item.price * item.qty).toFixed(2)}</div>
                    {locked && <div className="text-[#5a5957] text-xs">مرسل — لا يمكن الحذف</div>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => changeQty(item.menu_item_id, -1)}
                      disabled={atMinQty}
                      className="w-7 h-7 rounded-full bg-[#2a2927] border border-[#3a3936] text-white flex items-center justify-center text-sm disabled:opacity-20 transition-all">−</button>
                    <span className="text-white font-black w-5 text-center">{item.qty}</span>
                    <button onClick={() => changeQty(item.menu_item_id, 1)}
                      className="w-7 h-7 rounded-full bg-[#e74c3c] text-white flex items-center justify-center text-sm transition-all">+</button>
                    {!locked && (
                      <button onClick={() => removeItem(item.menu_item_id)}
                        className="w-7 h-7 rounded-full bg-[#2a2927] text-[#8a8884] flex items-center justify-center text-xs mr-1 transition-all">✕</button>
                    )}
                  </div>
                </div>
              )
            })}
            <div className="mt-4 mb-4">
              <label className="text-[#8a8884] text-xs font-bold mb-1.5 block">ملاحظات (اختياري)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="مثال: بدون بصل، حساسية من المكسرات..."
                className="w-full bg-[#0f0e0d] border border-[#3a3936] rounded-xl p-3 text-white text-sm resize-none focus:border-[#e74c3c] outline-none" rows={2} />
            </div>
            <div className="bg-[#0f0e0d] rounded-xl p-4 mb-4">
              <div className="flex justify-between text-sm text-[#8a8884] mb-1.5"><span>المجموع الجزئي</span><span>${subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm text-[#8a8884] mb-3"><span>ضريبة (10%)</span><span>${tax.toFixed(2)}</span></div>
              <div className="flex justify-between font-black text-white text-lg border-t border-[#3a3936] pt-3"><span>الإجمالي</span><span className="text-[#f39c12]">${total.toFixed(2)}</span></div>
            </div>
            <button onClick={submitOrder} disabled={loading || !cart.length}
              className="w-full bg-[#e74c3c] hover:bg-[#c0392b] text-white font-black py-4 rounded-2xl text-lg transition-all disabled:opacity-60 active:scale-[0.98]">
              {loading ? '⏳ جارٍ الإرسال...' : '🚀 إرسال الطلب'}
            </button>
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#e8e6e1] text-[#0f0e0d] px-5 py-3 rounded-full font-bold text-sm z-50 shadow-xl whitespace-nowrap">{toast}</div>}
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
