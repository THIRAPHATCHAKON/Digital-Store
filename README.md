# Digital Store

ร้านขายสินค้าดิจิทัล (เทมเพลต ซอร์สโค้ด ไฟล์กราฟิก คอร์ส อีบุ๊ก) ชำระเงินผ่าน Stripe (test mode)
ใช้ backend API ตัวเดียวกันทั้งเว็บ, แอปมือถือ (MIT App Inventor) และ desktop

- **Backend:** Node.js 24 + Express 5 + PostgreSQL 17 — `src/`
- **Frontend:** Next.js 15 — `web/` (หน้าตาตามไฟล์ Figma "Digital Store · Foundations 1.0")
- **Deploy:** docker compose บน VPS, nginx reverse proxy → `https://digital-store.sukpat.dev`

## โครงสร้าง

```
db/schema.sql            ตารางทั้งหมด + หมวดหมู่เริ่มต้น (รันอัตโนมัติครั้งแรกที่สร้าง volume ของ Postgres)
src/app.js               Express app, error handler, mount routes
src/lib.js               DB pool, รหัสผ่าน, session token, signed download URL, ค่าตั้งร้าน, CSV
src/auth.js              สมัคร / ล็อกอิน / Google / ล็อกอินแอดมิน / โปรไฟล์ / logout
src/shop.js              หมวดหมู่, สินค้า, รีวิว, ตะกร้า, checkout, Stripe webhook, คำสั่งซื้อ, คลัง, ดาวน์โหลด
src/admin.js             แดชบอร์ด, สินค้า, หมวดหมู่, คำสั่งซื้อ, ลูกค้า, ไฟล์, การชำระเงิน, นำเข้า/ส่งออก, ตั้งค่า
test/                    node:test
web/app/(shop)/          หน้าลูกค้า: หน้าแรก ร้านค้า หมวดหมู่ สินค้า ตะกร้า checkout คำสั่งซื้อ คลัง โปรไฟล์
web/app/login/           เข้าสู่ระบบ / สมัครสมาชิก (เต็มจอ ไม่มีแถบนำทาง)
web/app/admin/           หน้าแอดมิน (desktop ≥1280px เท่านั้น)
web/components/          ui.js (ชิ้นส่วนร่วม), checkout.js, admin.js
web/app/globals.css      design tokens + class ทั้งหมด
```

## ติดตั้งบน server

```bash
git clone https://github.com/mekzqza/Digital-Store.git
cd Digital-Store
cp .env.example .env        # เติมค่าจริง (ดูตารางด้านล่าง)
docker compose up -d --build
curl http://localhost/api/health   # ผ่าน nginx → {"ok":true}
```

| ตัวแปร | ความหมาย |
|---|---|
| `POSTGRES_PASSWORD` | รหัสผ่าน DB |
| `APP_SECRET` | ใช้เซ็นลิงก์ดาวน์โหลด — สุ่มด้วย `openssl rand -hex 32` (ไม่ตั้ง = API ดาวน์โหลดไม่ทำงาน) |
| `STRIPE_SECRET_KEY` | `sk_test_…` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` จากหน้า webhook ของ Stripe |
| `NEXT_PUBLIC_STRIPE_PK` | `pk_test_…` — ฝังตอน build หน้าเว็บ เปลี่ยนแล้วต้อง `docker compose build web` |
| `GOOGLE_CLIENT_ID` | ไม่บังคับ — OAuth client ID (Web application) สำหรับปุ่ม "ดำเนินการต่อด้วย Google" เว้นว่าง = ไม่แสดงปุ่ม ฝังตอน build เช่นกัน |

> **ฐานข้อมูล:** `db/schema.sql` รันเฉพาะตอน volume `pgdata` ถูกสร้างครั้งแรก ถ้าเคยรัน schema รุ่นก่อนไว้แล้ว
> ต้องลบ volume (`docker compose down -v` — ข้อมูลหายทั้งหมด) หรือเขียน migration เอง

### nginx

nginx เป็น container ของ project `lab-docker` บน VPS — compose นี้ต่อ `api`/`web` เข้า network `lab-docker_default`
ด้วย alias `ds-api` / `ds-web` (ชื่อ `api` ชนกับ project อื่น)

ต้องมี cert ที่ `/etc/letsencrypt/live/digital-store.sukpat.dev/` ก่อน แล้ว:

```bash
cp nginx/digital-store.sukpat.dev.conf ~/lab-docker/nginx/conf.d/
docker exec lab-docker-nginx-1 nginx -t && docker exec lab-docker-nginx-1 nginx -s reload
```

### Stripe webhook

Stripe Dashboard (Test mode) → Developers → Webhooks → Add endpoint

- URL: `https://digital-store.sukpat.dev/api/stripe/webhook`
- Events: `payment_intent.succeeded`, `payment_intent.payment_failed`

สถานะ PAID / FAILED มาจาก webhook เท่านั้น — ถ้าจ่ายแล้ว order ค้าง PENDING ให้เช็กตรงนี้ก่อน

### Google sign-in (ไม่บังคับ)

Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web application)
เพิ่ม `https://digital-store.sukpat.dev` ใน Authorized JavaScript origins แล้วใส่ client ID ใน `GOOGLE_CLIENT_ID`

บัญชีที่สมัครด้วยรหัสผ่านไว้ก่อน แล้วมาเข้าด้วย Google อีเมลเดียวกัน: รหัสผ่านเดิมจะถูกล้าง
(การสมัครไม่ได้ยืนยันอีเมล จึงไม่รู้ว่าใครตั้งรหัสนั้น) ตั้งรหัสใหม่ได้ที่หน้าโปรไฟล์ — แอดมินที่ใช้หน้า `/admin/login` ต้องมีรหัสผ่าน

### สร้างแอดมิน

ไม่มีหน้าสมัครแอดมิน สมัครเป็นลูกค้าก่อนแล้วเปลี่ยน role ใน DB:

```bash
docker compose exec db psql -U shop -c "UPDATE users SET role='admin' WHERE email='you@example.com';"
```

แล้วเข้า `/admin/login`

### ทดสอบการจ่ายเงิน

- สำเร็จ: `4242 4242 4242 4242` · วันหมดอายุอนาคตใดก็ได้ · CVC 3 หลักใดก็ได้
- ถูกปฏิเสธ: `4000 0000 0000 0002`

## พัฒนาในเครื่อง

```bash
npm install && npm test                       # backend unit test
npm run dev                                   # ต้องมี .env + Postgres
cd web && npm install
API_ORIGIN=http://localhost:4000 npm run dev  # proxy /api ไปที่ backend
```

## API (สรุป)

ทุก endpoint อยู่ใต้ `/api` · auth ใช้ `Authorization: Bearer <token>` (ไม่ใช้ cookie เพื่อให้ App Inventor ใช้ได้)
error ตอบเป็น `{ "error": "ข้อความ", ...extra }` · validation ตอบ 422 พร้อม `errors: { field: msg }`

| Method | Path | Auth | หมายเหตุ |
|---|---|---|---|
| POST | `/auth/register` | – | `{name,email,password}` → `{token,user}` |
| POST | `/auth/login` | – | `{email,password,remember}` · ผิด 5 ครั้งล็อก 15 นาที (423) · บัญชีถูกระงับ → 403 |
| POST | `/auth/google` | – | `{credential}` (ID token จาก Google Identity Services) · ไม่ได้ตั้ง `GOOGLE_CLIENT_ID` → 501 |
| POST | `/auth/admin/login` | – | รหัสถูกแต่ไม่ใช่แอดมิน → 403 |
| POST | `/auth/logout` · GET `/auth/me` | user | `me` คืน `cartCount` และ `user.has_password` |
| PATCH | `/auth/me` | user | `{name}` และ/หรือ `{currentPassword,newPassword}` (เปลี่ยนรหัส = อุปกรณ์อื่นถูกออกจากระบบ) |
| GET | `/categories` · `/settings` | – | หมวดหมู่ (พร้อมสีและจำนวนสินค้า) · ชื่อร้าน อีเมลช่วยเหลือ ข้อความหน้าแรก |
| GET | `/products?q&category&min&max&rating&file&license&sort&page&limit` | – | sort: `popular` (ค่าเริ่มต้น) `newest` `rating` `price_asc` `price_desc` · file: `zip` `pdf` `mp4` · license: `personal` `commercial` |
| GET | `/products/:id` | optional | มี `rating`, `review_count`, `reviews`, `owned_since`, `in_cart`, `related` |
| POST | `/products/:id/reviews` | user | `{rating 1–5, body}` เฉพาะผู้ที่ซื้อแล้ว (403) · ส่งซ้ำ = แก้รีวิวเดิม |
| GET · POST · DELETE | `/cart` · `/cart/:productId` | user | POST `{productId}` หรือ `{productIds:[]}` |
| POST | `/checkout` | user | `{productIds?, billing?: {name,email,country,address}}` (ไม่ส่ง productIds = ทั้งตะกร้า) → `{orderNo,clientSecret}` |
| GET | `/orders?status&year` · `/orders/:orderNo` | user | year เป็น พ.ศ. · เลขคำสั่งซื้อรูปแบบ `DS-10001` |
| GET | `/library` | user | เฉพาะ order ที่ PAID · `has_update` = สินค้าถูกแก้หลังดาวน์โหลดครั้งล่าสุด |
| POST | `/library/:itemId/download` | user | ใช้สิทธิ์ 1 ครั้ง (จำนวนและอายุสิทธิ์ตั้งในหน้าตั้งค่า) → signed URL อายุ 5 นาที |
| GET | `/files/:itemId?exp&sig` | ลายเซ็น | ลิงก์ที่ได้จากข้อบน |
| POST | `/stripe/webhook` | Stripe | |
| GET | `/admin/stats?days` | admin | ยอดขาย คำสั่งซื้อ ลูกค้า สินค้า กราฟ หมวดหมู่ขายดี |
| GET · POST | `/admin/products` | admin | POST เป็น multipart: fields + `file` (zip/pdf/mp4) + `cover` (jpg/png ไม่บังคับ) |
| PATCH | `/admin/products` | admin | `{ids,status}` |
| GET · PUT · DELETE | `/admin/products/:id` | admin | ลบสินค้าที่มีคนซื้อแล้ว → 409 `{buyers}` |
| GET · POST | `/admin/categories` | admin | POST `{name,slug,color}` |
| PUT · DELETE | `/admin/categories/:slug` | admin | slug แก้ไม่ได้ · ลบหมวดที่ยังมีสินค้า → 409 |
| GET | `/admin/orders?q&status&from&to&page` · `/admin/orders/:orderNo` | admin | |
| POST | `/admin/orders/:orderNo/refund` | admin | เฉพาะ PAID → REFUNDED (ตัดสิทธิ์ดาวน์โหลด) |
| GET | `/admin/customers?q&status&page` | admin | status: `active` `disabled` |
| PATCH | `/admin/customers/:id` | admin | `{disabled}` ระงับ = ออกจากระบบทุกอุปกรณ์และล็อกอินไม่ได้ |
| GET | `/admin/files?q&type&page` · `/admin/payments?q&status&page` | admin | |
| GET | `/admin/export/:type?format=csv\|json` | admin | type: `products` `orders` `customers` `payments` `files` |
| POST | `/admin/import/products?dryRun=1` | admin | body เป็น `text/csv` · คอลัมน์บังคับ `name,category,price` · สร้างเป็น DRAFT ทั้งไฟล์หรือไม่สร้างเลย |
| GET · PUT | `/admin/settings` | admin | `store_name` `support_email` `hero_title` `hero_text` `download_limit` `download_days` |

## แอปมือถือ (App Inventor)

- เก็บ token จาก `/auth/login` แล้วส่ง header `Authorization: Bearer …` ทุก request
- WebViewer ดาวน์โหลดไฟล์เองไม่ได้: หน้าเว็บเรียก `window.AppInventor.setWebViewString(url)`
  → ในแอปเพิ่ม block `WebViewer.WebViewStringChange` → `ActivityStarter` (Action `android.intent.action.VIEW`, DataUri = ค่าที่ได้) เพื่อเปิดใน Chrome
- `/checkout` ไม่บังคับ `billing` — ไม่ส่งก็ใช้ชื่อและอีเมลของบัญชี

## ยังไม่ได้ทำ

ลืมรหัสผ่าน · ยืนยันอีเมลตอนสมัคร · โค้ดส่วนลด · ใบเสร็จ PDF · แกลเลอรีภาพตัวอย่าง · ตัวเล่นคอร์ส · rich text editor (ตอนนี้ใช้ textarea + Markdown)
