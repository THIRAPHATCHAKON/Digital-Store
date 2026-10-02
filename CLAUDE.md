# Digital Store

## Architecture
- Frontend: Next.js
- Backend: Node.js + Express (REST API, JSON)
- Database: PostgreSQL
- Deploy: ทุกตัวอยู่บน VPS เดียวกัน รันด้วย docker compose
- Nginx: container ใน docker compose, reverse proxy
  - `/`     → http://<frontend-container>:<port>
  - `/api`  → http://<backend-container>:<port>
  - config: <path/nginx.conf>

## Platforms (ทุกตัวใช้ backend API ตัวเดียวกัน)
- Web: Next.js
- Mobile: MIT App Inventor (.apk) เรียก API ผ่าน Web component
  → auth ใช้ Bearer token ห้ามพึ่ง cookie
- Desktop: Electron (Windows) ใน `desktop/` เป็นแค่เปลือกที่เปิดเว็บจริง ไม่มี UI และไม่เรียก API เอง
  → แก้เว็บครั้งเดียว desktop ได้ตามทันที ไม่ต้อง build ใหม่

## Rules
- ใน repo นี้มี backend server, เว็บ (`web/`) และ desktop app (`desktop/`)
- Frontend เรียก API ผ่าน path `/api` (domain เดียวกัน → ไม่ต้องตั้ง CORS)

## Mypoper
- Domain: sukpat.dev
- subdomain: digital-store.sukpat.dev

## test
-- เครื่องนี้ไม่มี อปกรร์ให้ test ต้องpull เข้า server แล้วทดสอบใช้จริง
