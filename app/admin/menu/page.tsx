'use client'
import { useState } from 'react'
import { MENU_ITEMS, CATEGORIES } from '@/lib/menu'
import { MenuItem } from '@/types'

export default function MenuPage() {
  const [items, setItems] = useState<MenuItem[]>(MENU_ITEMS)
  const [activeCategory, setActiveCategory] = useState('all')
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<Partial<MenuItem>>({})
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const filtered = items.filter(i =>
    (activeCategory === 'all' || i.category === activeCategory) &&
    (i.name_ar.includes(search) || i.name.toLowerCase().includes(search.toLowerCase()))
  )

  const openEdit = (item: MenuItem) => { setEditing(item); setForm({...item}); setAdding(false) }
  const openAdd = () => { setEditing(null); setAdding(true); setForm({ category: (activeCategory !== 'all' ? activeCategory : 'starters') as MenuItem['category'], available: true, price: 0 }) }

  const save = () => {
    if (!form.name_ar || !form.price) { showToast('❌ أدخل الاسم والسعر'); return }
    if (editing) {
      setItems(prev => prev.map(i => i.id === editing.id ? { ...i, ...form } as MenuItem : i))
      showToast('✅ تم التعديل')
    } else {
      const newItem: MenuItem = {
        id: 'm' + Date.now(),
        name: form.name || form.name_ar || '',
        name_ar: form.name_ar!,
        description: form.description || '',
        description_ar: form.description_ar || '',
        emoji: form.emoji || '🍽️',
        price: Number(form.price),
        category: form.category || 'starters',
        available: form.available ?? true,
        image: '',
      }
      setItems(prev => [...prev, newItem])
      showToast('✅ تمت الإضافة')
    }
    setEditing(null); setAdding(false); setForm({})
  }

  const toggleAvailable = (id: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, available: !i.available } : i))
  }

  const deleteItem = (id: string) => {
    if (!confirm('حذف هذا الصنف؟')) return
    setItems(prev => prev.filter(i => i.id !== id))
    showToast('🗑️ تم الحذف')
  }

  return (
    <div className="p-5 max-w-6xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white font-black text-2xl">🍽️ المنيو</h1>
          <p className="text-[#8a8884] text-sm">{items.length} صنف إجمالي · {items.filter(i=>i.available).length} متاح</p>
        </div>
        <button onClick={openAdd} className="bg-[#e74c3c] hover:bg-[#c0392b] text-white font-bold px-5 py-2.5 rounded-xl transition-all text-sm flex items-center gap-2">
          <span>+</span><span>إضافة صنف</span>
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 بحث..."
          className="flex-1 bg-[#1a1917] border border-[#3a3936] rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#e74c3c] outline-none" />
        <div className="flex gap-2 overflow-x-auto">
          <button onClick={() => setActiveCategory('all')}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${activeCategory==='all'?'bg-[#e74c3c] border-[#e74c3c] text-white':'bg-[#1a1917] border-[#3a3936] text-[#8a8884]'}`}>
            الكل
          </button>
          {CATEGORIES.map(c => (
            <button key={c.key} onClick={() => setActiveCategory(c.key)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${activeCategory===c.key?'bg-[#e74c3c] border-[#e74c3c] text-white':'bg-[#1a1917] border-[#3a3936] text-[#8a8884]'}`}>
              {c.emoji} {c.label_ar}
            </button>
          ))}
        </div>
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(item => (
          <div key={item.id} className={`bg-[#1a1917] border rounded-2xl p-4 transition-all ${item.available ? 'border-[#2c2b29]' : 'border-[#3a3936] opacity-60'}`}>
            <div className="flex items-start gap-3">
              <span className="text-3xl">{item.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="text-white font-bold text-sm">{item.name_ar}</div>
                <div className="text-[#8a8884] text-xs truncate mt-0.5">{item.description_ar}</div>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[#f39c12] font-black">{item.price.toFixed(2)} ج</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${item.available ? 'bg-[#0a2010] text-[#2ecc71]' : 'bg-[#2a2927] text-[#8a8884]'}`}>
                    {item.available ? 'متاح' : 'غير متاح'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-3 pt-3 border-t border-[#2c2b29]">
              <button onClick={() => openEdit(item)} className="flex-1 text-[#8a8884] hover:text-white text-xs font-bold py-2 rounded-lg bg-[#2a2927] hover:bg-[#3a3936] transition-all">✏️ تعديل</button>
              <button onClick={() => toggleAvailable(item.id)} className="flex-1 text-[#8a8884] hover:text-white text-xs font-bold py-2 rounded-lg bg-[#2a2927] hover:bg-[#3a3936] transition-all">
                {item.available ? '🔒 إيقاف' : '✅ تفعيل'}
              </button>
              <button onClick={() => deleteItem(item.id)} className="text-[#8a8884] hover:text-[#e74c3c] text-xs font-bold py-2 px-3 rounded-lg bg-[#2a2927] hover:bg-[#3d1c18] transition-all">🗑️</button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {(editing || adding) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { setEditing(null); setAdding(false) }} />
          <div className="relative bg-[#1a1917] border border-[#3a3936] rounded-3xl p-6 w-full max-w-md max-h-[90dvh] overflow-y-auto">
            <h2 className="text-white font-black text-lg mb-5">{adding ? '➕ إضافة صنف جديد' : '✏️ تعديل الصنف'}</h2>
            <div className="space-y-4">
              {[
                { key: 'name_ar', label: 'الاسم بالعربي *', placeholder: 'برجر لحم' },
                { key: 'name', label: 'الاسم بالإنجليزي', placeholder: 'Beef Burger' },
                { key: 'description_ar', label: 'الوصف بالعربي', placeholder: 'برجر لحم طازج...' },
                { key: 'emoji', label: 'الإيموجي', placeholder: '🍔' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-[#8a8884] text-xs font-bold block mb-1.5">{f.label}</label>
                  <input value={(form as Record<string,unknown>)[f.key] as string || ''} onChange={e => setForm(p => ({...p,[f.key]:e.target.value}))}
                    placeholder={f.placeholder}
                    className="w-full bg-[#0f0e0d] border border-[#3a3936] rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#e74c3c] outline-none" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[#8a8884] text-xs font-bold block mb-1.5">السعر (ج) *</label>
                  <input type="number" value={form.price || ''} onChange={e => setForm(p => ({...p,price:Number(e.target.value)}))}
                    className="w-full bg-[#0f0e0d] border border-[#3a3936] rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#e74c3c] outline-none" />
                </div>
                <div>
                  <label className="text-[#8a8884] text-xs font-bold block mb-1.5">القسم</label>
                  <select value={form.category || 'starters'} onChange={e => setForm(p => ({...p,category:e.target.value}))}
                    className="w-full bg-[#0f0e0d] border border-[#3a3936] rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#e74c3c] outline-none">
                    {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label_ar}</option>)}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <div onClick={() => setForm(p => ({...p,available:!p.available}))}
                  className={`w-12 h-6 rounded-full transition-all relative ${form.available ? 'bg-[#2ecc71]' : 'bg-[#3a3936]'}`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${form.available ? 'right-1' : 'right-7'}`} />
                </div>
                <span className="text-[#e8e6e1] text-sm">متاح في المنيو</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={save} className="flex-1 bg-[#e74c3c] text-white font-black py-3 rounded-xl transition-all hover:bg-[#c0392b]">حفظ</button>
              <button onClick={() => { setEditing(null); setAdding(false) }} className="flex-1 bg-[#2a2927] text-[#8a8884] font-bold py-3 rounded-xl transition-all hover:text-white">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#e8e6e1] text-[#0f0e0d] px-5 py-3 rounded-full font-bold text-sm z-50 shadow-xl">{toast}</div>}
    </div>
  )
}
