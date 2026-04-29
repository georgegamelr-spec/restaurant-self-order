'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ROLE_LABELS } from '@/lib/auth'

interface User { id: string; username: string; name: string; role: string; active: boolean; created_at: string }

const ROLES = ['super_admin','manager','cashier','kitchen']
const ROLE_COLORS: Record<string,string> = {
  super_admin: 'bg-[#3d1c18] text-[#e74c3c]',
  manager:     'bg-[#0a2030] text-[#3498db]',
  cashier:     'bg-[#0a2010] text-[#2ecc71]',
  kitchen:     'bg-[#3d2e0a] text-[#f39c12]',
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'add'|'edit'|null>(null)
  const [editing, setEditing] = useState<User|null>(null)
  const [form, setForm] = useState({username:'',name:'',role:'cashier',password:'',active:true})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }
  useEffect(() => { loadUsers() }, [])

  const loadUsers = async () => {
    const { data } = await supabase.from('users').select('*').order('created_at')
    setUsers(data || []); setLoading(false)
  }

  const openAdd = () => { setEditing(null); setForm({username:'',name:'',role:'cashier',password:'',active:true}); setModal('add') }
  const openEdit = (u: User) => { setEditing(u); setForm({username:u.username,name:u.name,role:u.role,password:'',active:u.active}); setModal('edit') }

  const save = async () => {
    if (!form.username || !form.name) { showToast('❌ أدخل الاسم واسم المستخدم'); return }
    if (modal==='add' && !form.password) { showToast('❌ أدخل كلمة المرور'); return }
    setSaving(true)
    try {
      if (modal==='add') {
        const r = await fetch('/api/admin/users', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error)
      } else if (editing) {
        const r = await fetch('/api/admin/users', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({id:editing.id,...form}) })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error)
      }
      showToast(modal==='add'?'✅ تمت الإضافة':'✅ تم التعديل')
      await loadUsers(); setModal(null)
    } catch(e:unknown) { showToast('❌ '+(e as Error).message) }
    setSaving(false)
  }

  const toggleActive = async (u: User) => {
    await supabase.from('users').update({ active: !u.active }).eq('id', u.id)
    loadUsers()
  }
  const deleteUser = async (u: User) => {
    if (!confirm(`حذف المستخدم "${u.name}"؟`)) return
    await supabase.from('users').delete().eq('id', u.id)
    loadUsers(); showToast('🗑️ تم الحذف')
  }

  return (
    <div className="p-5 max-w-4xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white font-black text-2xl">👥 المستخدمين</h1>
          <p className="text-[#8a8884] text-sm">{users.filter(u=>u.active).length} نشط · {users.length} إجمالي</p>
        </div>
        <button onClick={openAdd} className="bg-[#e74c3c] hover:bg-[#c0392b] text-white font-bold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2">
          <span>+</span><span>إضافة مستخدم</span>
        </button>
      </div>

      {loading ? <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-20 bg-[#1a1917] rounded-2xl animate-pulse"/>)}</div> : (
        <div className="space-y-3">
          {users.map(u => (
            <div key={u.id} className={`bg-[#1a1917] border border-[#2c2b29] rounded-2xl p-4 flex items-center gap-4 ${!u.active&&'opacity-50'}`}>
              <div className="w-11 h-11 rounded-full bg-[#e74c3c] flex items-center justify-center text-white font-black text-lg flex-shrink-0">{u.name[0]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-bold">{u.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${ROLE_COLORS[u.role]}`}>{ROLE_LABELS[u.role]}</span>
                  {!u.active&&<span className="text-xs px-2 py-0.5 rounded-full bg-[#2a2927] text-[#5a5957]">موقوف</span>}
                </div>
                <div className="text-[#8a8884] text-xs mt-0.5">@{u.username} · {new Date(u.created_at).toLocaleDateString('ar-EG')}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={()=>openEdit(u)} className="text-[#8a8884] hover:text-white py-2 px-3 rounded-lg bg-[#2a2927] text-xs transition-all">✏️</button>
                <button onClick={()=>toggleActive(u)} className="text-[#8a8884] hover:text-white py-2 px-3 rounded-lg bg-[#2a2927] text-xs transition-all">{u.active?'🔒':'✅'}</button>
                <button onClick={()=>deleteUser(u)} className="text-[#8a8884] hover:text-[#e74c3c] py-2 px-3 rounded-lg bg-[#2a2927] text-xs transition-all">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={()=>setModal(null)} />
          <div className="relative bg-[#1a1917] border border-[#3a3936] rounded-3xl p-6 w-full max-w-md">
            <h2 className="text-white font-black text-lg mb-5">{modal==='add'?'➕ إضافة مستخدم':'✏️ تعديل مستخدم'}</h2>
            <div className="space-y-4">
              {[{k:'name',l:'الاسم الكامل *',ph:'محمد أحمد'},{k:'username',l:'اسم المستخدم *',ph:'ahmed2025'}].map(f=>(
                <div key={f.k}>
                  <label className="text-[#8a8884] text-xs font-bold block mb-1.5">{f.l}</label>
                  <input value={(form as Record<string,string>)[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph}
                    className="w-full bg-[#0f0e0d] border border-[#3a3936] rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#e74c3c] outline-none" />
                </div>
              ))}
              <div>
                <label className="text-[#8a8884] text-xs font-bold block mb-1.5">كلمة المرور {modal==='edit'&&'(اتركها فارغة للإبقاء)'}</label>
                <input type="password" value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))} placeholder="••••••••"
                  className="w-full bg-[#0f0e0d] border border-[#3a3936] rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#e74c3c] outline-none" />
              </div>
              <div>
                <label className="text-[#8a8884] text-xs font-bold block mb-1.5">الصلاحية</label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map(r=>(
                    <button key={r} onClick={()=>setForm(p=>({...p,role:r}))}
                      className={`py-2.5 rounded-xl text-sm font-bold border transition-all ${form.role===r?'bg-[#e74c3c] border-[#e74c3c] text-white':'bg-[#0f0e0d] border-[#3a3936] text-[#8a8884]'}`}>
                      {ROLE_LABELS[r]}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <div onClick={()=>setForm(p=>({...p,active:!p.active}))}
                  className={`w-12 h-6 rounded-full transition-all relative ${form.active?'bg-[#2ecc71]':'bg-[#3a3936]'}`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${form.active?'right-1':'right-7'}`} />
                </div>
                <span className="text-[#e8e6e1] text-sm">حساب نشط</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={save} disabled={saving} className="flex-1 bg-[#e74c3c] text-white font-black py-3 rounded-xl hover:bg-[#c0392b] disabled:opacity-60">{saving?'جارٍ الحفظ...':'حفظ'}</button>
              <button onClick={()=>setModal(null)} className="flex-1 bg-[#2a2927] text-[#8a8884] font-bold py-3 rounded-xl hover:text-white">إلغاء</button>
            </div>
          </div>
        </div>
      )}
      {toast&&<div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#e8e6e1] text-[#0f0e0d] px-5 py-3 rounded-full font-bold text-sm z-50 shadow-xl">{toast}</div>}
    </div>
  )
}
