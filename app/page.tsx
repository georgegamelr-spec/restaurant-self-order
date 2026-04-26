import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-8 p-6 bg-[#0f0e0d]">
      <div className="text-center">
        <div className="text-6xl mb-4">🍽️</div>
        <h1 className="text-3xl font-black text-white mb-2">Restaurant Self Order</h1>
        <p className="text-[#8a8884] text-sm">نظام الطلب الذاتي عبر QR</p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link href="/order?table=1"
          className="bg-[#e74c3c] hover:bg-[#c0392b] text-white font-bold py-4 px-6 rounded-2xl text-center transition-all text-lg">
          📱 تجربة صفحة الزبون (طاولة 1)
        </Link>
        <Link href="/kitchen"
          className="bg-[#1f1e1c] hover:bg-[#2a2927] border border-[#3a3936] text-white font-bold py-4 px-6 rounded-2xl text-center transition-all text-lg">
          👨‍🍳 Kitchen Display
        </Link>
        <Link href="/admin/qr-codes"
          className="bg-[#1f1e1c] hover:bg-[#2a2927] border border-[#3a3936] text-white font-bold py-4 px-6 rounded-2xl text-center transition-all text-lg">
          🔲 توليد QR Codes
        </Link>
      </div>
    </main>
  )
}
