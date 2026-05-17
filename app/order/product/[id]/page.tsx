'use client'

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { MENU_ITEMS, CATEGORIES } from '@/lib/menu'

function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const params  = useSearchParams()
  const table   = params.get('table') || '1'

  const item = MENU_ITEMS.find(m => m.id === id)

  if (!item) {
    return (
      <div className="min-h-dvh bg-[#0f0e0d] flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="text-6xl mb-4">🍽️</div>
          <p className="text-[#8a8884] mb-4">الصنف غير موجود</p>
          <button onClick={() => router.back()}
            className="text-[#e74c3c] font-bold text-sm">← رجوع</button>
        </div>
      </div>
    )
  }

  const category = CATEGORIES.find(c => c.key === item.category)
  const related  = MENU_ITEMS
    .filter(m => m.category === item.category && m.id !== item.id && m.available)
    .slice(0, 4)

  return (
    <div className="min-h-dvh bg-[#0f0e0d] pb-32" dir="rtl">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0f0e0d]/80 backdrop-blur-lg border-b border-[#2c2b29] px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-xl bg-[#1a1917] border border-[#2c2b29] flex items-center justify-center text-[#8a8884] hover:text-white transition-colors text-base">
          ←
        </button>
        <span className="text-[#8a8884] text-sm">{category?.emoji} {category?.label_ar}</span>
      </div>

      {/* Hero */}
      <div className="bg-gradient-to-b from-[#1a1917] to-[#0f0e0d] pt-10 pb-8 px-6 text-center">
        <div className="text-8xl mb-5 leading-none drop-shadow-2xl">{item.emoji}</div>
        <h1 className="text-white font-black text-3xl mb-1">{item.name_ar}</h1>
        <p className="text-[#5a5957] text-sm mb-5">{item.name}</p>
        <div className="inline-flex items-baseline gap-1">
          <span className="text-[#f39c12] font-black text-4xl">{item.price.toFixed(2)}</span>
          <span className="text-[#8a8884] text-sm">ج.م</span>
        </div>
        {!item.available && (
          <div className="mt-4 inline-block bg-[#3d0a0a] text-[#e74c3c] text-sm font-bold px-4 py-1.5 rounded-full">
            غير متاح حالياً
          </div>
        )}
      </div>

      {/* Description */}
      <div className="px-5 mb-4">
        <div className="bg-[#1a1917] border border-[#2c2b29] rounded-2xl p-4">
          <h2 className="text-white font-bold text-sm mb-2">📋 التفاصيل</h2>
          <p className="text-[#b8b6b1] text-sm leading-relaxed">{item.description_ar}</p>
          {item.description && (
            <p className="text-[#5a5957] text-xs mt-1.5 leading-relaxed">{item.description}</p>
          )}
        </div>
      </div>

      {/* Chips */}
      <div className="px-5 flex flex-wrap gap-2 mb-6">
        <span className="bg-[#1a1917] border border-[#2c2b29] text-[#8a8884] text-xs px-3 py-1.5 rounded-full">
          {category?.emoji} {category?.label_ar}
        </span>
        <span className={`text-xs px-3 py-1.5 rounded-full font-bold border ${
          item.available
            ? 'bg-[#0a2010] text-[#2ecc71] border-[#2ecc71]/20'
            : 'bg-[#3d0a0a] text-[#e74c3c] border-[#e74c3c]/20'
        }`}>
          {item.available ? '✅ متاح الآن' : '❌ نفد المخزون'}
        </span>
      </div>

      {/* Related Items */}
      {related.length > 0 && (
        <div className="px-5 mb-6">
          <h2 className="text-white font-bold text-sm mb-3">🍽️ أصناف مشابهة</h2>
          <div className="grid grid-cols-2 gap-2.5">
            {related.map(rel => (
              <button key={rel.id}
                onClick={() => router.push(`/order/product/${rel.id}?table=${table}`)}
                className="bg-[#1a1917] border border-[#2c2b29] rounded-2xl p-3.5 text-right hover:border-[#e74c3c]/40 transition-all active:scale-95">
                <div className="text-3xl mb-2">{rel.emoji}</div>
                <p className="text-white font-bold text-sm leading-tight mb-1">{rel.name_ar}</p>
                <p className="text-[#f39c12] font-black text-sm">{rel.price.toFixed(2)} ج.م</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sticky Add Button */}
      {item.available && (
        <div className="fixed bottom-0 inset-x-0 bg-[#0f0e0d]/95 backdrop-blur-lg border-t border-[#2c2b29] p-4 safe-bottom">
          <button
            onClick={() => router.push(`/order?table=${table}&add=${item.id}`)}
            className="w-full bg-[#e74c3c] hover:bg-[#c0392b] active:scale-[0.98] text-white font-black py-4 rounded-2xl text-base transition-all shadow-lg shadow-[#e74c3c]/20 flex items-center justify-center gap-2"
          >
            <span>🛒</span>
            <span>أضف للطلب — {item.price.toFixed(2)} ج.م</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default function ProductDetailPage() {
  return (
    <Suspense>
      <ProductDetail />
    </Suspense>
  )
}
