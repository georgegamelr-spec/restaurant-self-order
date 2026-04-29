'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Ingredient { id:string; name:string; unit:string; stock_qty:number; min_stock:number; cost_per_unit:number }
interface LogEntry { id:string; ingredient_id:string; type:string; qty:number; reason:string; notes:string; created_at:string; ingredients?:{name:string;unit:string} }

const UNITS = ['kg','g','L','ml','pcs','علبة','كيلو','جرام','لتر']
const LOG_TYPES: Record<string,{label:string;color:string;emoji:string}> = {
  in:     { label:'إضافة',   color:'text-[#2ecc71]', emoji:'⬆️' },
  out:    { label:'سحب',     color:'text-[#e74c3c]', emoji:'⬇️' },
  adjust: { label:'تسوية',  color:'text-[#f39c12]', emoji:'🔄' },
}

export default function InventoryPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [tab, setTab] = useState<'items'|'logs'|'recipes'>('items')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'ingredient'|'log'|null>(null)
  const [editIngredient, setEditIngredient] = useState<Ingredient|null>(null)
  const [form, setForm] = useState<Partial<Ingredient>>({})
  const [logForm, setLogForm] = useState<{ingredient_id:string;type:string;qty:string;notes:string}>({ingredient_id:'',type:'in',qty:'',notes:''})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [search, setSearch] = useState('')

  const showToast = (msg:string) => { setToast(msg); setTimeout(()=>setToast(''),2500) }

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    const [{ data: ings }, { data: lg }] = await Promise.all([
      supabase.from('ingredients').select('*').order('name'),
      supabase.from('inventory_logs').select('*, ingredients(name,unit)').order('created_at',{ascending:false}).limit(100),
    ])
    setIngredients(ings || [])
    setLogs(lg || [])
    setLoading(false)
  }

  const openAddIng = () => { setEditIngredient(null); setForm({unit:'kg',stock_qty:0,min_stock:0,cost_per_unit:0}); setModal('ingredient') }
  const openEditIng = (i:Ingredient) => { setEditIngredient(i); setForm({...i}); setModal('ingredient') }

  const saveIngredient = async () => {
    if (!form.name) { showToast('❌ أدخل الاسم'); return }
    setSaving(true)
    try {
      if (editIngredient) {
        const { error } = await supabase.from('ingredients').update({ name:form.name, unit:form.unit, min_stock:form.min_stock||0, cost_per_unit:form.cost_per_unit||0 }).eq('id',editIngredient.id)
        if (error) throw error
        showToast('✅ تم التعديل')
      } else {
        const { error } = await supabase.from('ingredients').insert({ name:form.name, unit:form.unit||'kg', stock_qty:form.stock_qty||0, min_stock:form.min_stock||0, cost_per_unit:form.cost_per_unit||0 })
        if (error) throw error
        showToast('✅ تمت الإضافة')
      }
      await loadAll(); setModal(null)
    } catch(e:unknown) { showToast('❌ '+(e as Error).message) }
    setSaving(false)
  }

  const saveLog = async () => {
    if (!logForm.ingredient_id || !logForm.qty) { showToast('❌ اختر المكون وأدخل الكمية'); return }
    setSaving(true)
    try {
      const qty = Number(logForm.qty)
      const { error: logErr } = await supabase.from('inventory_logs').insert({
        ingredient_id: logForm.ingredient_id, type: logForm.type,
        qty, reason: 'manual_adjust', notes: logForm.notes,
      })
      if (logErr) throw logErr
      // Update stock_qty
      const ing = ingredients.find(i=>i.id===logForm.ingredient_id)
      if (ing) {
        const delta = logForm.type==='in' ? qty : logForm.type==='out' ? -qty : 0
        const newQty = logForm.type==='adjust' ? qty : ing.stock_qty + delta
        await supabase.from('ingredients').update({ stock_qty: Math.max(0,newQty) }).eq('id',ing.id)
      }
      showToast('✅ تم تسجيل الحركة')
      await loadAll(); setModal(null)
      setLogForm({ingredient_id:'',type:'in',qty:'',notes:''})
    } catch(e:unknown) { showToast('❌ '+(e as Error).message) }
    setSaving(false)
  }

  const deleteIng = async (id:string) => {
    if (!confirm('حذف هذا المكون؟')) return
    await supabase.from('ingredients').delete().eq('id',id)
    loadAll(); showToast('🗑️ تم الحذف')
  }

  const filtered = ingredients.filter(i=>i.name.includes(search))
  const lowStock = ingredients.filter(i=>i.stock_qty<=i.min_stock)

  return (
    <div className="p-5 max-w-5xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white font-black text-2xl">📦 المخزون</h1>
          <p className="text-[#8a8884] text-sm">{ingredients.length} مكون · <span className="text-[#e74c3c]">{lowStock.length} تنبيه مخزون</span></p>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>setModal('log')} className="bg-[#1a1917] hover:bg-[#2a2927] border border-[#3a3936] text-white font-bold px-4 py-2.5 rounded-xl transition-all text-sm">📝 تسجيل حركة</button>
          <button onClick={openAddIng} className="bg-[#e74c3c] hover:bg-[#c0392b] text-white font-bold px-4 py-2.5 rounded-xl transition-all text-sm">+ إضافة</button>
        </div>
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div className="bg-[#3d1c18] border border-[#e74c3c]/30 rounded-2xl p-4 mb-5">
          <div className="text-[#e74c3c] font-black text-sm mb-2">⚠️ تنبيه: مخزون منخفض</div>
          <div className="flex flex-wrap gap-2">
            {lowStock.map(i=>(
              <span key={i.id} className="bg-[#0f0e0d] text-[#e74c3c] text-xs px-3 py-1 rounded-full border border-[#e74c3c]/30">
                {i.name}: {i.stock_qty} {i.unit} (الحد الأدنى: {i.min_stock})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {[{k:'items',l:'المكونات 📦'},{k:'logs',l:'الحركات 📋'}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k as 'items'|'logs')}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-all ${tab===t.k?'bg-[#e74c3c] border-[#e74c3c] text-white':'bg-[#1a1917] border-[#3a3936] text-[#8a8884]'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {tab==='items' && (
        <>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 بحث في المكونات..."
            className="w-full bg-[#1a1917] border border-[#3a3936] rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#e74c3c] outline-none mb-4" />
          {loading ? <div className="space-y-3">{[1,2,3,4].map(i=><div key={i} className="h-16 bg-[#1a1917] rounded-2xl animate-pulse"/>)}</div> : (
            <div className="space-y-2">
              {filtered.map(ing=>{
                const isLow = ing.stock_qty <= ing.min_stock
                return (
                  <div key={ing.id} className={`bg-[#1a1917] border rounded-2xl px-4 py-3 flex items-center gap-4 ${isLow?'border-[#e74c3c]/40':'border-[#2c2b29]'}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold text-sm">{ing.name}</span>
                        {isLow && <span className="text-xs bg-[#3d1c18] text-[#e74c3c] px-2 py-0.5 rounded-full">منخفض</span>}
                      </div>
                      <div className="text-[#8a8884] text-xs mt-0.5">الحد الأدنى: {ing.min_stock} {ing.unit} · التكلفة: {ing.cost_per_unit} ج/{ing.unit}</div>
                    </div>
                    <div className="text-center">
                      <div className={`font-black text-lg ${isLow?'text-[#e74c3c]':'text-[#2ecc71]'}`}>{ing.stock_qty}</div>
                      <div className="text-[#8a8884] text-xs">{ing.unit}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={()=>openEditIng(ing)} className="text-[#8a8884] hover:text-white text-xs py-2 px-3 rounded-lg bg-[#2a2927] hover:bg-[#3a3936] transition-all">✏️</button>
                      <button onClick={()=>deleteIng(ing.id)} className="text-[#8a8884] hover:text-[#e74c3c] text-xs py-2 px-3 rounded-lg bg-[#2a2927] hover:bg-[#3d1c18] transition-all">🗑️</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {tab==='logs' && (
        <div className="space-y-2">
          {logs.map(log=>{
            const lt = LOG_TYPES[log.type] || LOG_TYPES.adjust
            return (
              <div key={log.id} className="bg-[#1a1917] border border-[#2c2b29] rounded-2xl px-4 py-3 flex items-center gap-4">
                <span className="text-2xl">{lt.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold text-sm">{log.ingredients?.name || '-'}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${lt.color} bg-[#2a2927]`}>{lt.label}</span>
                  </div>
                  <div className="text-[#8a8884] text-xs mt-0.5">{log.notes || '-'} · {new Date(log.created_at).toLocaleString('ar-EG')}</div>
                </div>
                <div className={`font-black ${lt.color}`}>
                  {log.type==='in'?'+':log.type==='out'?'-':''}{log.qty} {log.ingredients?.unit}
                </div>
              </div>
            )
          })}
          {!logs.length && <p className="text-[#5a5957] text-sm text-center py-8">لا توجد حركات بعد</p>}
        </div>
      )}

      {/* Ingredient Modal */}
      {modal==='ingredient' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={()=>setModal(null)} />
          <div className="relative bg-[#1a1917] border border-[#3a3936] rounded-3xl p-6 w-full max-w-md">
            <h2 className="text-white font-black text-lg mb-5">{editIngredient?'✏️ تعديل مكون':'➕ إضافة مكون'}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-[#8a8884] text-xs font-bold block mb-1.5">اسم المكون *</label>
                <input value={form.name||''} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="لحم مفروم"
                  className="w-full bg-[#0f0e0d] border border-[#3a3936] rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#e74c3c] outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[#8a8884] text-xs font-bold block mb-1.5">الوحدة</label>
                  <select value={form.unit||'kg'} onChange={e=>setForm(p=>({...p,unit:e.target.value}))}
                    className="w-full bg-[#0f0e0d] border border-[#3a3936] rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#e74c3c] outline-none">
                    {UNITS.map(u=><option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[#8a8884] text-xs font-bold block mb-1.5">الكمية الحالية</label>
                  <input type="number" value={form.stock_qty??''} onChange={e=>setForm(p=>({...p,stock_qty:Number(e.target.value)}))} disabled={!!editIngredient}
                    className="w-full bg-[#0f0e0d] border border-[#3a3936] rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#e74c3c] outline-none disabled:opacity-40" />
                </div>
                <div>
                  <label className="text-[#8a8884] text-xs font-bold block mb-1.5">الحد الأدنى للتنبيه</label>
                  <input type="number" value={form.min_stock??''} onChange={e=>setForm(p=>({...p,min_stock:Number(e.target.value)}))}
                    className="w-full bg-[#0f0e0d] border border-[#3a3936] rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#e74c3c] outline-none" />
                </div>
                <div>
                  <label className="text-[#8a8884] text-xs font-bold block mb-1.5">التكلفة / وحدة (ج)</label>
                  <input type="number" value={form.cost_per_unit??''} onChange={e=>setForm(p=>({...p,cost_per_unit:Number(e.target.value)}))}
                    className="w-full bg-[#0f0e0d] border border-[#3a3936] rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#e74c3c] outline-none" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={saveIngredient} disabled={saving} className="flex-1 bg-[#e74c3c] text-white font-black py-3 rounded-xl hover:bg-[#c0392b] disabled:opacity-60">{saving?'جارٍ الحفظ...':'حفظ'}</button>
              <button onClick={()=>setModal(null)} className="flex-1 bg-[#2a2927] text-[#8a8884] font-bold py-3 rounded-xl hover:text-white">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Log Modal */}
      {modal==='log' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={()=>setModal(null)} />
          <div className="relative bg-[#1a1917] border border-[#3a3936] rounded-3xl p-6 w-full max-w-md">
            <h2 className="text-white font-black text-lg mb-5">📝 تسجيل حركة مخزون</h2>
            <div className="space-y-4">
              <div>
                <label className="text-[#8a8884] text-xs font-bold block mb-1.5">المكون *</label>
                <select value={logForm.ingredient_id} onChange={e=>setLogForm(p=>({...p,ingredient_id:e.target.value}))}
                  className="w-full bg-[#0f0e0d] border border-[#3a3936] rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#e74c3c] outline-none">
                  <option value="">اختر مكون...</option>
                  {ingredients.map(i=><option key={i.id} value={i.id}>{i.name} (الحالي: {i.stock_qty} {i.unit})</option>)}
                </select>
              </div>
              <div>
                <label className="text-[#8a8884] text-xs font-bold block mb-1.5">نوع الحركة</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(LOG_TYPES).map(([k,v])=>(
                    <button key={k} onClick={()=>setLogForm(p=>({...p,type:k}))}
                      className={`py-2.5 rounded-xl text-sm font-bold border transition-all ${logForm.type===k?'bg-[#e74c3c] border-[#e74c3c] text-white':'bg-[#0f0e0d] border-[#3a3936] text-[#8a8884]'}`}>
                      {v.emoji} {v.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[#8a8884] text-xs font-bold block mb-1.5">الكمية *</label>
                <input type="number" value={logForm.qty} onChange={e=>setLogForm(p=>({...p,qty:e.target.value}))} placeholder="0"
                  className="w-full bg-[#0f0e0d] border border-[#3a3936] rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#e74c3c] outline-none" />
              </div>
              <div>
                <label className="text-[#8a8884] text-xs font-bold block mb-1.5">ملاحظات</label>
                <input value={logForm.notes} onChange={e=>setLogForm(p=>({...p,notes:e.target.value}))} placeholder="سبب الحركة..."
                  className="w-full bg-[#0f0e0d] border border-[#3a3936] rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#e74c3c] outline-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={saveLog} disabled={saving} className="flex-1 bg-[#e74c3c] text-white font-black py-3 rounded-xl hover:bg-[#c0392b] disabled:opacity-60">{saving?'جارٍ الحفظ...':'تسجيل'}</button>
              <button onClick={()=>setModal(null)} className="flex-1 bg-[#2a2927] text-[#8a8884] font-bold py-3 rounded-xl hover:text-white">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#e8e6e1] text-[#0f0e0d] px-5 py-3 rounded-full font-bold text-sm z-50 shadow-xl">{toast}</div>}
    </div>
  )
}
