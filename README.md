# 🍽️ Restaurant Self Order

نظام الطلب الذاتي عبر QR للمطاعم — الزبون يسكن الكود، يتصفح المنيو، ويطلب مباشرةً.

## Features
- 📱 **Customer QR Menu** — mobile-first, Arabic RTL
- 🔒 **Submit Lock** — يمنع الحذف بعد الإرسال، يسمح بالإضافة فقط
- 👨‍🍳 **Kitchen Display** — Realtime updates via Supabase
- 🔲 **QR Generator** — لكل طاولة QR منفصل
- 📊 **Order Tracking** — الزبون يتابع حالة طلبه

## Stack
- Next.js 14 (App Router)
- Supabase (PostgreSQL + Realtime)
- Tailwind CSS
- TypeScript

## Setup

### 1. Supabase Migration
اذهب إلى **Supabase Dashboard → SQL Editor** وشغّل محتوى `SUPABASE_MIGRATION.sql`

### 2. Environment Variables
```bash
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
```

### 3. Run locally
```bash
npm install
npm run dev
```

### 4. Deploy to Vercel
```bash
npx vercel --prod
# Add env variables in Vercel dashboard
```

## Pages
| Path | Description |
|------|-------------|
| `/` | Home |
| `/order?table=1` | Customer order page (QR target) |
| `/kitchen` | Kitchen display (realtime) |
| `/admin/qr-codes` | QR code generator |

## Order Flow
```
QR Scan → /order?table=5
  ↓ Customer adds items
  ↓ Submit → POST /api/orders
  ↓ Realtime → Kitchen Display
  ↓ Customer can only ADD more (no delete)
  ↓ Kitchen updates status → Customer sees it
```
