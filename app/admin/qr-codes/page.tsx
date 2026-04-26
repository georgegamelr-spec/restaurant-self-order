'use client'

import { useEffect, useRef, useState } from 'react'

const TABLES = Array.from({ length: 20 }, (_, i) => i + 1)

declare global { interface Window { QRCode: any } }

export default function QRCodesPage() {
  const [baseUrl, setBaseUrl] = useState('')
  const [selectedTable, setSelectedTable] = useState<number | null>(null)
  const qrRef = useRef<HTMLDivElement>(null)
  const [qrLoaded, setQrLoaded] = useState(false)

  useEffect(() => {
    setBaseUrl(window.location.origin)
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
    script.onload = () => setQrLoaded(true)
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    if (!qrLoaded || !selectedTable || !qrRef.current) return
    qrRef.current.innerHTML = ''
    new window.QRCode(qrRef.current, {
      text: `${baseUrl}/order?table=${selectedTable}`,
      width: 220, height: 220,
      colorDark: '#0f0e0d', colorLight: '#ffffff',
      correctLevel: window.QRCode?.CorrectLevel?.H,
    })
  }, [qrLoaded, selectedTable, baseUrl])

  const printQR = () => window.print()

  return (
    <div className="min-h-dvh bg-[#0f0e0d] p-5" dir="rtl">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-white font-black text-2xl mb-1">🔲 QR Codes للطاولات</h1>
        <p className="text-[#8a8884] text-sm mb-6">اختر رقم الطاولة لتوليد QR Code</p>

        {/* Base URL */}
        <div className="bg-[#1a1917] border border-[#3a3936] rounded-2xl p-4 mb-5">
          <label className="text-[#8a8884] text-xs font-bold mb-1.5 block">رابط الموقع (Base URL)</label>
          <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
            className="w-full bg-[#0f0e0d] border border-[#3a3936] rounded-xl px-3 py-2.5 text-white text-sm focus:border-[#e74c3c] outline-none font-mono" />
        </div>

        {/* Tables Grid */}
        <div className="grid grid-cols-5 gap-2 mb-6">
          {TABLES.map(t => (
            <button key={t} onClick={() => setSelectedTable(t)}
              className={`py-3 rounded-xl font-black text-sm transition-all border ${
                selectedTable === t
                  ? 'bg-[#e74c3c] border-[#e74c3c] text-white'
                  : 'bg-[#1a1917] border-[#3a3936] text-[#8a8884] hover:border-[#e74c3c] hover:text-white'
              }`}>
              {t}
            </button>
          ))}
        </div>

        {/* QR Display */}
        {selectedTable && (
          <div className="bg-white rounded-3xl p-8 text-center mb-4 print:shadow-none">
            <p className="text-[#0f0e0d] font-black text-lg mb-1">🍽️ {process.env.NEXT_PUBLIC_RESTAURANT_NAME || 'Restaurant'}</p>
            <p className="text-[#5a5957] text-sm mb-4">طاولة رقم {selectedTable}</p>
            <div className="flex justify-center mb-4" ref={qrRef} />
            <p className="text-[#8a8884] text-xs">امسح الكود لتصفح المنيو وتقديم طلبك</p>
            <p className="text-[#bab9b4] text-[10px] mt-1 font-mono break-all">
              {baseUrl}/order?table={selectedTable}
            </p>
          </div>
        )}

        {selectedTable && (
          <div className="flex gap-3">
            <button onClick={printQR}
              className="flex-1 bg-[#e74c3c] hover:bg-[#c0392b] text-white font-bold py-3.5 rounded-2xl transition-all">
              🖨️ طباعة QR
            </button>
            <button onClick={() => {
              const url = `${baseUrl}/order?table=${selectedTable}`
              navigator.clipboard?.writeText(url)
              alert('تم نسخ الرابط!')
            }}
              className="flex-1 bg-[#1a1917] border border-[#3a3936] text-white font-bold py-3.5 rounded-2xl transition-all hover:border-white">
              📋 نسخ الرابط
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
