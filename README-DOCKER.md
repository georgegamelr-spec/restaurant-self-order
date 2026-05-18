# 🐳 تشغيل المشروع بدون إنترنت — Docker

## المتطلبات
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) مثبّت على الجهاز
- الملفات محملة من GitHub مرة واحدة

---

## التشغيل في 3 خطوات

### 1. حمّل المشروع
```bash
git clone https://github.com/georgegamelr-spec/restaurant-self-order.git
cd restaurant-self-order
```

### 2. جهّز ملف الإعدادات
```bash
cp .env.docker .env.local
```

### 3. شغّل كل حاجة
```bash
docker compose up -d
```

ده بس! انتظر دقيقتين وافتح المتصفح على:

| الرابط | الوصف |
|--------|-------|
| http://localhost:3000 | التطبيق الرئيسي |
| http://localhost:3000/admin/login | لوحة الإدارة |
| http://localhost:3000/order?table=1 | صفحة الزبون |
| http://localhost:3000/kitchen | شاشة المطبخ |

---

## بيانات الدخول
| اليوزر | الباسورد | الصلاحية |
|--------|----------|----------|
| admin | admin123 | مدير كامل |
| manager | manager123 | مشرف |
| cashier | cashier123 | كاشير |
| kitchen | kitchen123 | مطبخ |

---

## أوامر مفيدة

```bash
# إيقاف
docker compose down

# إيقاف + حذف البيانات (ابدأ من الأول)
docker compose down -v

# عرض اللوجز
docker compose logs -f app

# إعادة البناء بعد تعديل الكود
docker compose up -d --build
```

---

## المكونات
| Container | الوصف | Port |
|-----------|-------|------|
| restaurant_app | Next.js App | 3000 |
| restaurant_api | PostgREST (REST API) | 3001 |
| restaurant_db  | PostgreSQL 16 | 5432 |

> البيانات محفوظة في `postgres_data` Docker volume — مش بتتمسح لو أوقفت الكونتينرز.
