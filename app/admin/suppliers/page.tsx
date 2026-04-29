'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Supplier { id:string; name:string; contact_name:string; phone:string; email:string; address:string; notes:string; active:boolean }
interface POItem { ingredient_id:string; qty:number; unit:string; unit_price:number; currency:string }
interface PO { id:string; supplier_id:string; status:string; currency:string; total_egp:number; notes:string; created_at:string; suppliers?:{name:string} }
interface Ingredient { id:string; name:string; unit:string }

const PO_STATUS: Record<string,{label:string;color:string}> = {
  draft:     { label:'مسودة',        color:'bg-[#2a2927] text-[#8a8884]' },
  sent:      { label:'مُرسل',         color:'bg-[#0a2030] text-[#3498db]' },
  received:  { label:'مُستلم ✅',     color:'bg-[#0a2010] text-[#2ecc71]' },
  cancelled: { label:'ملغي',          color:'bg-[#3d1c18] text-[#e74c3c]' },
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [pos, setPOs] = useState<PO[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [tab, setTab] = useState<'suppliers'|'orders'>('suppliers')
  const [modal, setModal] = useState<'supplier'|'po'|null>(null)
  const [editSupplier, setEditSupplier] = useState<Supplier|null>(null)
  const [sForm, setSForm] = useState<Partial<Supplier>>({active:true})
  const [poForm, setPoForm] = useState<{supplier_id:string;currency:string;notes:string;items:POItem[]}>({supplier_id:'',currency:'EGP',notes:'',items:[{ingredient_id:'',qty:0,unit:'',unit_price:0,currency:'EGP'}]})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [viewPO, setViewPO] = useState<PO|null>(null)

  const showToast = (msg:string) => { setToast(msg); setTimeout(()=>setToast(''),2500) }

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    const [{ data:s },{ data:p },{ data:i }] = await Promise.all([
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('purchase_orders').select('*, suppliers(name)').order('created_at',{ascending:false}),
      supabase.from('ingredients').select('id,name,unit').order('name'),
    ])
    setSuppliers(s||[]); setPOs(p||[]); setIngredients(i||[])
  }

  const openAddS = () => { setEditSupplier(null); setSForm({active:true}); setModal('supplier') }
  const openEditS = (s:Supplier) => { setEditSupplier(s); setSForm({...s}); setModal('supplier') }

  const saveSupplier = async () => {
    if (!sForm.name) { showToast('❌ أدخل اسم المورد'); return }
    setSaving(true)
    try {
      if (editSupplier) {
        await supabase.from('suppliers').update({ name:sForm.name,contact_name:sForm.contact_name,phone:sForm.phone,email:sForm.email,address:sForm.address,notes:sForm.notes,active:sForm.active }).eq('id',editSupplier.id)
        showToast('✅ تم التعديل')
      } else {
        await supabase.from('suppliers').insert({ name:sForm.name,contact_name:sForm.contact_name,phone:sForm.phone,email:sForm.email,address:sForm.address,notes:sForm.notes,active:sForm.active??true })
        showToast('✅ تمت الإضافة')
      }
      await loadAll(); setModal(null)
    } catch(e:unknown) { showToast('❌ '+(e as Error).message) }
    setSaving(false)
  }

  const savePO = async () => {
    if (!poForm.supplier_id) { showToast('❌ اختر المورد'); return }
    const validItems = poForm.items.filter(i=>i.ingredient_id && i.qty>0 && i.unit_price>0)
    if (!validItems.length) { showToast('❌ أضف صنفاً واحداً على الأقل'); return }
    setSaving(true)
    try {
      const rate = poForm.currency==='USD' ? 50 : 1
      const total = validItems.reduce((s,i)=>s+(i.qty*i.unit_price*rate),0)
      const { data:po, error } = await supabase.from('purchase_orders').insert({ supplier_id:poForm.supplier_id, currency:poForm.currency, exchange_rate:rate, total_egp:total, notes:poForm.notes, status:'draft' }).select().single()
      if (error||!po) throw error
      await supabase.from('po_items').insert(validItems.map(i=>({po_id:po.id,ingredient_id:i.ingredient_id,qty:i.qty,unit:i.unit,unit_price:i.unit_price,currency:poForm.currency})))
      showToast('✅ تم إنشاء طلب الشراء')
      await loadAll(); setModal(null)
    } catch(e:unknown) { showToast('❌ '+(e as Error).message) }
    setSaving(false)
  }

  const updatePOStatus = async (id:string, status:string, items?: {ingredient_id:string;qty:number}[]) => {
    await supabase.from('purchase_orders').update({ status }).eq('id',id)
    // If received → add to inventory
    if (status==='received' && items) {
      for (const item of items) {
        const ing = ingredients.find(i=>i.id===item.ingredient_id)
        if (!ing) continue
        await supabase.from('inventory_logs').insert({ ingredient_id:item.ingredient_id, type:'in', qty:item.qty, reason:'purchase_order', notes:`طلب شراء #${id.slice(0,8)}` })
        const { data:cur } = await supabase.from('ingredients').select('stock_qty').eq('id',item.ingredient_id).single()
        if (cur) await supabase.from('ingredients').update({ stock_qty: cur.stock_qty + item.qty }).eq('id',item.ingredient_id)
      }
    }
    await loadAll(); showToast('✅ تم تحديث الحالة')
  }

  const addPOItem = () => setPoForm(p=>({...p,items:[...p.items,{ingredient_id:'',qty:0,unit:'',unit_price:0,currency:p.currency}]}))
  const removePOItem = (idx:number) => setPoForm(p=>({...p,items:p.items.filter((_,i)=>i!==idx)}))
  const updatePOItem = (idx:number, key:string, val:string|number) => setPoForm(p=>({...p,items:p.items.map((it,i)=>i===idx?{...it,[key]:val,unit:key==='ingredient_id'?(ingredients.find(x=>x.id===val)?.unit||it.unit):it.unit}:it)}))

  return (
    <div className="p-5 max-w-5xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white font-black text-2xl">🚚 الموردين</h1>
          <p className="text-[#8a8884] text-sm">{suppliers.filter(s=>s.active).length} مورد نشط · {pos.length} طلب شراء</p>
        </div>
        <div className="flex gap-2">
          {tab==='suppliers' && <button onClick={openAddS} className="bg-[#e74c3c] hover:bg-[#c0392b] text-white font-bold px-4 py-2.5 rounded-xl text-sm">+ مورد جديد</button>}
          {tab==='orders' && <button onClick={()=>setModal('po')} className="bg-[#e74c3c] hover:bg-[#c0392b] text-white font-bold px-4 py-2.5 rounded-xl text-sm">+ طلب شراء</button>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {[{k:'suppliers',l:'الموردين 🚚'},{k:'orders',l:'طلبات الشراء 📋'}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k as 'suppliers'|'orders')}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-all ${tab===t.k?'bg-[#e74c3c] border-[#e74c3c] text-white':'bg-[#1a1917] border-[#3a3936] text-[#8a8884]'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {tab==='suppliers' && (
        <div className="space-y-3">
          {suppliers.map(s=>(
            <div key={s.id} className={`bg-[#1a1917] border border-[#2c2b29] rounded-2xl p-4 flex items-start gap-4 ${!s.active&&'opacity-50'}`}>
              <div className="w-11 h-11 rounded-full bg-[#2a2927] flex items-center justify-center text-xl flex-shrink-0">🚚</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white font-bold">{s.name}</span>
                  {!s.active&&<span className="text-xs bg-[#2a2927] text-[#5a5957] px-2 py-0.5 rounded-full">غير نشط</span>}
                </div>
                <div className="text-[#8a8884] text-xs mt-0.5 space-y-0.5">
                  {s.contact_name&&<div>👤 {s.contact_name}</div>}
                  {s.phone&&<div>📞 {s.phone}</div>}
                  {s.email&&<div>📧 {s.email}</div>}
                  {s.address&&<div>📍 {s.address}</div>}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={()=>openEditS(s)} className="text-[#8a8884] hover:text-white py-2 px-3 rounded-lg bg-[#2a2927] text-xs transition-all">✏️</button>
              </div>
            </div>
          ))}
          {!suppliers.length&&<p className="text-[#5a5957] text-sm text-center py-8">لا يوجد موردين بعد</p>}
        </div>
      )}

      {tab==='orders' && (
        <div className="space-y-3">
          {pos.map(po=>{
            const st = PO_STATUS[po.status]||PO_STATUS.draft
            return (
              <div key={po.id} className="bg-[#1a1917] border border-[#2c2b29] rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-white font-bold text-sm">{po.suppliers?.name||'-'}</span>
                    <span className="text-[#8a8884] text-xs mr-2">#{po.id.slice(0,8)}</span>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${st.color}`}>{st.label}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[#8a8884] text-xs">{new Date(po.created_at).toLocaleDateString('ar-EG')}</div>
                  <div className="text-[#f39c12] font-black">{po.total_egp.toFixed(0)} ج</div>
                </div>
                {po.status==='draft'&&(
                  <div className="flex gap-2 mt-3 pt-3 border-t border-[#2c2b29]">
                    <button onClick={()=>updatePOStatus(po.id,'sent')} className="flex-1 text-[#3498db] text-xs font-bold py-2 rounded-lg bg-[#0a2030] hover:bg-[#0d2a40] transition-all">📤 إرسال</button>
                    <button onClick={()=>updatePOStatus(po.id,'cancelled')} className="flex-1 text-[#e74c3c] text-xs font-bold py-2 rounded-lg bg-[#3d1c18] hover:bg-[#4d2420] transition-all">❌ إلغاء</button>
                  </div>
                )}
                {po.status==='sent'&&(
                  <button onClick={async()=>{
                    const {data:items}=await supabase.from('po_items').select('ingredient_id,qty').eq('po_id',po.id)
                    updatePOStatus(po.id,'received',items||[])
                  }} className="w-full mt-3 pt-3 border-t border-[#2c2b29] text-[#2ecc71] text-xs font-bold py-2 rounded-lg bg-[#0a2010] hover:bg-[#0d2a18] transition-all">
                    ✅ تأكيد الاستلام (يضاف للمخزون تلقائياً)
                  </button>
                )}
              </div>
            )
          })}
          {!pos.length&&<p className="text-[#5a5957] text-sm text-center py-8">لا توجد طلبات شراء بعد</p>}
        </div>
      )}

      {/* Supplier Modal */}
      {modal==='supplier' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={()=>setModal(null)} />
          <div className="relative bg-[#1a1917] border border-[#3a3936] rounded-3xl p-6 w-full max-w-md max-h-[90dvh] overflow-y-auto">
            <h2 className="text-white font-black text-lg mb-5">{editSupplier?'✏️ تعديل مورد':'➕ مورد جديد'}</h2>
            <div className="space-y-4">
              {[
                {k:'name',l:'اسم المورد *',ph:'شركة الخير للتوريدات'},
                {k:'contact_name',l:'اسم المسؤول',ph:'محمد علي'},
                {k:'phone',l:'رقم الهاتف',ph:'01012345678'},
                {k:'email',l:'البريد الإلكتروني',ph:'info@supplier.com'},
                {k:'address',l:'العنوان',ph:'القاهرة، مصر'},
                {k:'notes',l:'ملاحظات',ph:'...'},
              ].map(f=>(
                <div key={f.k}>
                  <label className="text-[#8a8884] text-xs font-bold block mb-1.5">{f.l}</label>
                  <input value={(sForm as Record<string,string>)[f.k]||''} onChange={e=>setSForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph}
                    className="w-full bg-[#0f0e0d] border border-[#3a3936] rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#e74c3c] outline-none" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={saveSupplier} disabled={saving} className="flex-1 bg-[#e74c3c] text-white font-black py-3 rounded-xl hover:bg-[#c0392b] disabled:opacity-60">{saving?'جارٍ الحفظ...':'حفظ'}</button>
              <button onClick={()=>setModal(null)} className="flex-1 bg-[#2a2927] text-[#8a8884] font-bold py-3 rounded-xl hover:text-white">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* PO Modal */}
      {modal==='po' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={()=>setModal(null)} />
          <div className="relative bg-[#1a1917] border border-[#3a3936] rounded-3xl p-6 w-full max-w-lg max-h-[90dvh] overflow-y-auto">
            <h2 className="text-white font-black text-lg mb-5">📋 طلب شراء جديد</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[#8a8884] text-xs font-bold block mb-1.5">المورد *</label>
                  <select value={poForm.supplier_id} onChange={e=>setPoForm(p=>({...p,supplier_id:e.target.value}))}
                    className="w-full bg-[#0f0e0d] border border-[#3a3936] rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#e74c3c] outline-none">
                    <option value="">اختر...</option>
                    {suppliers.filter(s=>s.active).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[#8a8884] text-xs font-bold block mb-1.5">العملة</label>
                  <div className="flex gap-2">
                    {['EGP','USD'].map(c=>(
                      <button key={c} onClick={()=>setPoForm(p=>({...p,currency:c}))}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${poForm.currency===c?'bg-[#e74c3c] border-[#e74c3c] text-white':'bg-[#0f0e0d] border-[#3a3936] text-[#8a8884]'}`}>{c}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[#8a8884] text-xs font-bold">الأصناف *</label>
                  <button onClick={addPOItem} className="text-[#e74c3c] text-xs font-bold">+ إضافة صنف</button>
                </div>
                <div className="space-y-2">
                  {poForm.items.map((item,idx)=>(
                    <div key={idx} className="bg-[#0f0e0d] border border-[#3a3936] rounded-xl p-3 space-y-2">
                      <div className="flex gap-2">
                        <select value={item.ingredient_id} onChange={e=>updatePOItem(idx,'ingredient_id',e.target.value)}
                          className="flex-1 bg-[#1a1917] border border-[#3a3936] rounded-lg px-3 py-2 text-white text-xs focus:border-[#e74c3c] outline-none">
                          <option value="">اختر مكون...</option>
                          {ingredients.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
                        </select>
                        {poForm.items.length>1&&<button onClick={()=>removePOItem(idx)} className="text-[#e74c3c] px-2 text-sm">✕</button>}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[#5a5957] text-xs">الكمية</label>
                          <input type="number" value={item.qty||''} onChange={e=>updatePOItem(idx,'qty',Number(e.target.value))} placeholder="0"
                            className="w-full bg-[#1a1917] border border-[#3a3936] rounded-lg px-2 py-1.5 text-white text-xs focus:border-[#e74c3c] outline-none" />
                        </div>
                        <div>
                          <label className="text-[#5a5957] text-xs">الوحدة</label>
                          <input value={item.unit} onChange={e=>updatePOItem(idx,'unit',e.target.value)} placeholder="kg"
                            className="w-full bg-[#1a1917] border border-[#3a3936] rounded-lg px-2 py-1.5 text-white text-xs focus:border-[#e74c3c] outline-none" />
                        </div>
                        <div>
                          <label className="text-[#5a5957] text-xs">السعر/{poForm.currency==='USD'?'$':'ج'}</label>
                          <input type="number" value={item.unit_price||''} onChange={e=>updatePOItem(idx,'unit_price',Number(e.target.value))} placeholder="0"
                            className="w-full bg-[#1a1917] border border-[#3a3936] rounded-lg px-2 py-1.5 text-white text-xs focus:border-[#e74c3c] outline-none" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[#8a8884] text-xs font-bold block mb-1.5">ملاحظات</label>
                <input value={poForm.notes} onChange={e=>setPoForm(p=>({...p,notes:e.target.value}))} placeholder="..."
                  className="w-full bg-[#0f0e0d] border border-[#3a3936] rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#e74c3c] outline-none" />
              </div>

              <div className="bg-[#0f0e0d] rounded-xl p-3 text-sm text-[#f39c12] font-black text-left">
                الإجمالي: {poForm.items.reduce((s,i)=>s+(i.qty*i.unit_price*(poForm.currency==='USD'?50:1)),0).toFixed(0)} ج
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={savePO} disabled={saving} className="flex-1 bg-[#e74c3c] text-white font-black py-3 rounded-xl hover:bg-[#c0392b] disabled:opacity-60">{saving?'جارٍ الحفظ...':'إنشاء الطلب'}</button>
              <button onClick={()=>setModal(null)} className="flex-1 bg-[#2a2927] text-[#8a8884] font-bold py-3 rounded-xl hover:text-white">إلغاء</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#e8e6e1] text-[#0f0e0d] px-5 py-3 rounded-full font-bold text-sm z-50 shadow-xl">{toast}</div>}
    </div>
  )
}
