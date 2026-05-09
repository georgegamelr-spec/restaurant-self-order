'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Product{id:string;name_ar:string;name_en:string;price:number;category:string;emoji:string;available:boolean;description:string}
interface Cat{key:string;label:string;emoji:string}

const DEFAULT_CATS:Cat[] = [
  {key:'starters', label:'مقبلات',        emoji:'🥗'},
  {key:'mains',    label:'أطباق رئيسية',  emoji:'🍽️'},
  {key:'drinks',   label:'مشروبات',       emoji:'🥤'},
  {key:'desserts', label:'حلويات',        emoji:'🍰'},
]
const EMPTY_P = {name_ar:'',name_en:'',price:0,category:'mains',emoji:'🍽️',description:'',available:true}
const EMPTY_C = {key:'',label:'',emoji:'🍽️'}

export default function MenuPage(){
  const [products,setProducts]   = useState<Product[]>([])
  const [cats,setCats]           = useState<Cat[]>(DEFAULT_CATS)
  const [loading,setLoading]     = useState(true)
  const [saving,setSaving]       = useState(false)
  const [cat,setCat]             = useState('all')
  const [q,setQ]                 = useState('')
  const [editing,setEditing]     = useState<Product|null>(null)
  const [adding,setAdding]       = useState(false)
  const [form,setForm]           = useState<Partial<Product>>(EMPTY_P)
  const [toast,setToast]         = useState('')
  const [delId,setDelId]         = useState<string|null>(null)
  const [catModal,setCatModal]   = useState(false)
  const [catForm,setCatForm]     = useState<Partial<Cat>>(EMPTY_C)
  const [editCat,setEditCat]     = useState<Cat|null>(null)
  const [delCat,setDelCat]       = useState<string|null>(null)

  useEffect(()=>{ load() },[])

  const msg = (t:string)=>{ setToast(t); setTimeout(()=>setToast(''),3000) }
  const load = async()=>{
    setLoading(true)
    const{data}=await supabase.from('products').select('*').order('category').order('name_ar')
    setProducts(data||[])
    setLoading(false)
  }
  const f  = (k:string,v:unknown)=>setForm(p=>({...p,[k]:v}))
  const cf = (k:string,v:string)=>setCatForm(p=>({...p,[k]:v}))

  const filtered = products.filter(p=>
    (cat==='all'||p.category===cat)&&
    (p.name_ar.includes(q)||(p.name_en||'').toLowerCase().includes(q.toLowerCase()))
  )

  const save = async()=>{
    if(!form.name_ar||!form.price){msg('❌ الاسم والسعر مطلوبان');return}
    setSaving(true)
    try{
      if(editing){
        const res=await fetch('/api/products/'+editing.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)})
        const d=await res.json(); if(!res.ok)throw new Error(d.error)
        setProducts(prev=>prev.map(p=>p.id===editing.id?d.product:p)); msg('✅ تم التعديل')
      }else{
        const res=await fetch('/api/products',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)})
        const d=await res.json(); if(!res.ok)throw new Error(d.error)
        setProducts(prev=>[...prev,d.product]); msg('✅ تمت الإضافة')
      }
      setEditing(null);setAdding(false);setForm(EMPTY_P)
    }catch(e:unknown){msg('❌ '+(e as Error).message)}
    setSaving(false)
  }

  const toggle = async(p:Product)=>{
    const res=await fetch('/api/products/'+p.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({available:!p.available})})
    if(res.ok){setProducts(prev=>prev.map(x=>x.id===p.id?{...x,available:!x.available}:x));msg(p.available?'🔒 تم الإيقاف':'✅ تم التفعيل')}
  }

  const del = async(id:string)=>{
    const res=await fetch('/api/products/'+id,{method:'DELETE'})
    if(res.ok){setProducts(prev=>prev.filter(p=>p.id!==id));msg('🗑️ تم الحذف')}
    setDelId(null)
  }

  const saveCat = ()=>{
    if(!catForm.key||!catForm.label){msg('❌ المفتاح والاسم مطلوبان');return}
    const slug=catForm.key.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'')
    if(editCat){
      setCats(prev=>prev.map(c=>c.key===editCat.key?{key:slug,label:catForm.label!,emoji:catForm.emoji||'🍽️'}:c))
      msg('✅ تم تعديل القائمة')
    }else{
      if(cats.find(c=>c.key===slug)){msg('❌ هذا المفتاح موجود بالفعل');return}
      setCats(prev=>[...prev,{key:slug,label:catForm.label!,emoji:catForm.emoji||'🍽️'}])
      msg('✅ تمت إضافة القائمة')
    }
    setEditCat(null);setCatForm(EMPTY_C);setCatModal(false)
  }

  const removeCat = (key:string)=>{
    const has=products.some(p=>p.category===key)
    if(has){msg('❌ لا يمكن حذف قائمة تحتوي على أصناف');setDelCat(null);return}
    setCats(prev=>prev.filter(c=>c.key!==key))
    if(cat===key)setCat('all')
    msg('🗑️ تم حذف القائمة');setDelCat(null)
  }

  const catLabel=(key:string)=>cats.find(c=>c.key===key)?.label||key

  return(
    <div className="p-5 max-w-6xl mx-auto" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white font-black text-2xl">🍽️ إدارة المنيو</h1>
          <p className="text-[#6a6864] text-sm mt-0.5">{products.length} صنف · {products.filter(p=>p.available).length} متاح · {products.filter(p=>!p.available).length} موقف</p>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>{setEditCat(null);setCatForm(EMPTY_C);setCatModal(true)}} className="text-[#8a8884] hover:text-white text-sm px-3 py-2.5 rounded-xl bg-[#1c1b19] border border-[#2c2b29] hover:border-[#3a3936] transition-all">⚙️ القوائم</button>
          <button onClick={load} className="text-[#8a8884] hover:text-white text-sm px-3 py-2.5 rounded-xl bg-[#1c1b19] border border-[#2c2b29] hover:border-[#3a3936] transition-all">🔄</button>
          <button onClick={()=>{setEditing(null);setAdding(true);setForm({...EMPTY_P,category:cat!=='all'?cat:'mains'})}} className="bg-[#e67e22] hover:bg-[#d35400] text-white font-bold px-5 py-2.5 rounded-xl transition-all text-sm">＋ إضافة صنف</button>
        </div>
      </div>

      {/* Cat Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {cats.map(c=>{
          const total=products.filter(p=>p.category===c.key).length
          const avail=products.filter(p=>p.category===c.key&&p.available).length
          return(
            <div key={c.key} onClick={()=>setCat(c.key)} className={`bg-[#1c1b19] border rounded-2xl p-3 text-center cursor-pointer transition-all ${cat===c.key?'border-[#e67e22]':'border-[#2c2b29] hover:border-[#3a3936]'}`}>
              <div className="text-2xl mb-1">{c.emoji}</div>
              <div className="text-white font-black text-lg">{total}</div>
              <div className="text-[#6a6864] text-xs">{c.label}</div>
              <div className="text-[#2ecc71] text-xs">{avail} متاح</div>
            </div>
          )
        })}
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="🔍 بحث..."
          className="flex-1 bg-[#1c1b19] border border-[#2c2b29] rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#e67e22] outline-none"/>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[{key:'all',label:'الكل',emoji:'📋'},...cats].map(c=>(
            <button key={c.key} onClick={()=>setCat(c.key)} className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${cat===c.key?'bg-[#e67e22] border-[#e67e22] text-white':'bg-[#1c1b19] border-[#2c2b29] text-[#8a8884] hover:text-white'}`}>{c.emoji} {c.label}</button>
          ))}
        </div>
      </div>

      {/* Products */}
      {loading?<div className="text-center py-20 text-[#6a6864]">⏳ جاري التحميل...</div>:(
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p=>(
            <div key={p.id} className={`bg-[#1c1b19] border rounded-2xl p-4 transition-all ${p.available?'border-[#2c2b29]':'border-[#2c2b29] opacity-60'}`}>
              <div className="flex items-start gap-3">
                <span className="text-3xl">{p.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-bold text-sm">{p.name_ar}</div>
                  <div className="text-[#6a6864] text-xs">{p.name_en}</div>
                  {p.description&&<div className="text-[#4a4845] text-xs mt-1 truncate">{p.description}</div>}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-[#f39c12] font-black">{p.price} ج</span>
                    <span className="text-[#4a4845] text-xs bg-[#242321] px-2 py-0.5 rounded-full">{catLabel(p.category)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${p.available?'bg-[#0a2010] text-[#2ecc71]':'bg-[#242321] text-[#6a6864]'}`}>{p.available?'✅ متاح':'🔒 موقف'}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t border-[#242321]">
                <button onClick={()=>{setEditing(p);setForm({...p});setAdding(false)}} className="flex-1 text-[#6a6864] hover:text-white text-xs font-bold py-2 rounded-lg bg-[#242321] hover:bg-[#2c2b29] transition-all">✏️ تعديل</button>
                <button onClick={()=>toggle(p)} className="flex-1 text-[#6a6864] hover:text-white text-xs font-bold py-2 rounded-lg bg-[#242321] hover:bg-[#2c2b29] transition-all">{p.available?'🔒 إيقاف':'✅ تفعيل'}</button>
                <button onClick={()=>setDelId(p.id)} className="text-[#6a6864] hover:text-[#e74c3c] text-xs font-bold py-2 px-3 rounded-lg bg-[#242321] hover:bg-[#3d1c18] transition-all">🗑️</button>
              </div>
            </div>
          ))}
          {filtered.length===0&&<div className="col-span-3 text-center py-16"><div className="text-4xl mb-3">🍽️</div><div className="text-[#6a6864]">لا توجد منتجات</div></div>}
        </div>
      )}

      {/* ── Add/Edit Product Modal ── */}
      {(editing||adding)&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={()=>{setEditing(null);setAdding(false)}}/>
          <div className="relative bg-[#1c1b19] border border-[#3a3936] rounded-3xl p-6 w-full max-w-md max-h-[90dvh] overflow-y-auto shadow-2xl">
            <h2 className="text-white font-black text-lg mb-5">{adding?'➕ إضافة صنف':'✏️ تعديل الصنف'}</h2>
            <div className="space-y-4">
              <div><label className="text-[#6a6864] text-xs font-bold block mb-1.5">الاسم بالعربي *</label>
                <input value={form.name_ar||''} onChange={e=>f('name_ar',e.target.value)} placeholder="برجر لحم" className="w-full bg-[#0f0e0d] border border-[#3a3936] rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#e67e22] outline-none"/></div>
              <div><label className="text-[#6a6864] text-xs font-bold block mb-1.5">الاسم بالإنجليزي</label>
                <input value={form.name_en||''} onChange={e=>f('name_en',e.target.value)} placeholder="Beef Burger" className="w-full bg-[#0f0e0d] border border-[#3a3936] rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#e67e22] outline-none"/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[#6a6864] text-xs font-bold block mb-1.5">السعر (ج) *</label>
                  <input type="number" min="0" value={form.price||''} onChange={e=>f('price',Number(e.target.value))} className="w-full bg-[#0f0e0d] border border-[#3a3936] rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#e67e22] outline-none"/></div>
                <div><label className="text-[#6a6864] text-xs font-bold block mb-1.5">الإيموجي</label>
                  <input value={form.emoji||''} onChange={e=>f('emoji',e.target.value)} placeholder="🍔" className="w-full bg-[#0f0e0d] border border-[#3a3936] rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#e67e22] outline-none text-center text-xl"/></div>
              </div>
              <div><label className="text-[#6a6864] text-xs font-bold block mb-1.5">القسم</label>
                <select value={form.category||'mains'} onChange={e=>f('category',e.target.value)} className="w-full bg-[#0f0e0d] border border-[#3a3936] rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#e67e22] outline-none">
                  {cats.map(c=><option key={c.key} value={c.key}>{c.emoji} {c.label}</option>)}
                </select></div>
              <div><label className="text-[#6a6864] text-xs font-bold block mb-1.5">الوصف</label>
                <textarea value={form.description||''} onChange={e=>f('description',e.target.value)} placeholder="وصف مختصر..." rows={2} className="w-full bg-[#0f0e0d] border border-[#3a3936] rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#e67e22] outline-none resize-none"/></div>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div onClick={()=>f('available',!form.available)} className={`w-12 h-6 rounded-full transition-all relative ${form.available?'bg-[#2ecc71]':'bg-[#3a3936]'}`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${form.available?'right-1':'right-7'}`}/>
                </div>
                <span className="text-[#e8e6e1] text-sm">متاح في المنيو</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={save} disabled={saving} className="flex-1 bg-[#e67e22] hover:bg-[#d35400] disabled:opacity-50 text-white font-black py-3 rounded-xl transition-all">{saving?'⏳ جاري الحفظ...':'💾 حفظ'}</button>
              <button onClick={()=>{setEditing(null);setAdding(false)}} className="flex-1 bg-[#242321] text-[#6a6864] hover:text-white font-bold py-3 rounded-xl transition-all">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Categories Manager Modal ── */}
      {catModal&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={()=>{setCatModal(false);setEditCat(null);setCatForm(EMPTY_C)}}/>
          <div className="relative bg-[#1c1b19] border border-[#3a3936] rounded-3xl p-6 w-full max-w-lg max-h-[90dvh] overflow-y-auto shadow-2xl">
            <h2 className="text-white font-black text-lg mb-5">⚙️ إدارة القوائم</h2>

            {/* Existing cats */}
            <div className="space-y-2 mb-6">
              {cats.map(c=>(
                <div key={c.key} className="flex items-center gap-3 bg-[#242321] rounded-xl p-3">
                  <span className="text-xl">{c.emoji}</span>
                  <div className="flex-1">
                    <div className="text-white text-sm font-bold">{c.label}</div>
                    <div className="text-[#6a6864] text-xs">{c.key} · {products.filter(p=>p.category===c.key).length} صنف</div>
                  </div>
                  <button onClick={()=>{setEditCat(c);setCatForm({...c});}} className="text-[#6a6864] hover:text-white text-xs px-2 py-1 rounded-lg bg-[#2c2b29] transition-all">✏️</button>
                  <button onClick={()=>setDelCat(c.key)} className="text-[#6a6864] hover:text-[#e74c3c] text-xs px-2 py-1 rounded-lg bg-[#2c2b29] transition-all">🗑️</button>
                </div>
              ))}
            </div>

            {/* Add/Edit form */}
            <div className="border-t border-[#2c2b29] pt-5">
              <h3 className="text-white font-bold text-sm mb-4">{editCat?'✏️ تعديل القائمة':'➕ إضافة قائمة جديدة'}</h3>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="col-span-2">
                  <label className="text-[#6a6864] text-xs font-bold block mb-1.5">اسم القائمة *</label>
                  <input value={catForm.label||''} onChange={e=>cf('label',e.target.value)} placeholder="وجبات سريعة"
                    className="w-full bg-[#0f0e0d] border border-[#3a3936] rounded-xl px-3 py-2.5 text-white text-sm focus:border-[#e67e22] outline-none"/>
                </div>
                <div>
                  <label className="text-[#6a6864] text-xs font-bold block mb-1.5">الإيموجي</label>
                  <input value={catForm.emoji||''} onChange={e=>cf('emoji',e.target.value)} placeholder="🍔"
                    className="w-full bg-[#0f0e0d] border border-[#3a3936] rounded-xl px-3 py-2.5 text-white text-sm focus:border-[#e67e22] outline-none text-center text-xl"/>
                </div>
                <div className="col-span-3">
                  <label className="text-[#6a6864] text-xs font-bold block mb-1.5">المفتاح (بالإنجليزي) *</label>
                  <input value={catForm.key||''} onChange={e=>cf('key',e.target.value)} placeholder="fast-food"
                    className="w-full bg-[#0f0e0d] border border-[#3a3936] rounded-xl px-3 py-2.5 text-white text-sm focus:border-[#e67e22] outline-none" dir="ltr"/>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveCat} className="flex-1 bg-[#e67e22] hover:bg-[#d35400] text-white font-bold py-2.5 rounded-xl text-sm transition-all">{editCat?'حفظ التعديل':'إضافة القائمة'}</button>
                {editCat&&<button onClick={()=>{setEditCat(null);setCatForm(EMPTY_C)}} className="px-4 bg-[#242321] text-[#6a6864] hover:text-white font-bold py-2.5 rounded-xl text-sm transition-all">إلغاء</button>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Product Confirm ── */}
      {delId&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={()=>setDelId(null)}/>
          <div className="relative bg-[#1c1b19] border border-[#e74c3c]/30 rounded-2xl p-6 w-full max-w-sm text-center">
            <div className="text-4xl mb-3">🗑️</div>
            <h3 className="text-white font-black text-lg mb-2">تأكيد الحذف</h3>
            <p className="text-[#6a6864] text-sm mb-5">لا يمكن التراجع عن هذا الإجراء</p>
            <div className="flex gap-3">
              <button onClick={()=>del(delId)} className="flex-1 bg-[#e74c3c] hover:bg-[#c0392b] text-white font-bold py-3 rounded-xl">حذف</button>
              <button onClick={()=>setDelId(null)} className="flex-1 bg-[#242321] text-[#6a6864] hover:text-white font-bold py-3 rounded-xl">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Category Confirm ── */}
      {delCat&&(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={()=>setDelCat(null)}/>
          <div className="relative bg-[#1c1b19] border border-[#e74c3c]/30 rounded-2xl p-6 w-full max-w-sm text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <h3 className="text-white font-black text-lg mb-2">حذف القائمة</h3>
            <p className="text-[#6a6864] text-sm mb-5">سيتم حذف القائمة <span className="text-white font-bold">"{cats.find(c=>c.key===delCat)?.label}"</span></p>
            <div className="flex gap-3">
              <button onClick={()=>removeCat(delCat)} className="flex-1 bg-[#e74c3c] hover:bg-[#c0392b] text-white font-bold py-3 rounded-xl">حذف</button>
              <button onClick={()=>setDelCat(null)} className="flex-1 bg-[#242321] text-[#6a6864] hover:text-white font-bold py-3 rounded-xl">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {toast&&<div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#e8e6e1] text-[#0f0e0d] px-5 py-3 rounded-full font-bold text-sm z-50 shadow-xl">{toast}</div>}
    </div>
  )
}
