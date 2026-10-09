# HTTPS serverga joylashtirish

## Docker + Caddy

1. Docker Compose ishlaydigan serverga loyiha fayllarini ko‘chiring.
2. Domenning DNS A/AAAA yozuvini serverga yo‘naltiring. 80 va 443 portlari ochiq bo‘lsin.
3. Loyiha papkasida `.env` yarating:

```dotenv
DOMAIN=planner.example.com
```

4. Ishga tushiring:

```sh
docker compose up -d --build
docker compose logs --tail=100 app proxy
```

Caddy HTTPS sertifikatini oladi va so‘rovlarni ichki Node serverga uzatadi. `planner-data` volume SQLite ma’lumotlarini saqlaydi. `planner-backups` volume backup uchun ajratilgan. Domenni haqiqiy domeningizga almashtiring. Bu konfiguratsiya tayyorlangan; ushbu ish davomida Docker deployment ishga tushirilmagan.

## Docker ishlatmasdan

Node.js 24+, doimiy disk va HTTPS reverse proxy kerak.

```sh
npm ci
npm run build
```

Loyiha `.env` faylida:

```dotenv
APP_ORIGIN=https://planner.example.com
HOST=127.0.0.1
PORT=3000
DATABASE_PATH=/var/lib/daily-system/daily-system.sqlite
```

Database papkasiga server foydalanuvchisi yozish huquqiga ega bo‘lsin. Reverse proxy HTTPS so‘rovlarni 127.0.0.1:3000 ga yo‘naltirsin. `npm start` ni systemd yoki hostingdagi process manager bilan doimiy ishlating. `APP_ORIGIN` qiymatiga oxirgi slash qo‘ymang.

## Backup va yangilash

```sh
npm run backup
# Docker uchun:
docker compose exec app npm run backup
```

Bu SQLite backup API orqali butun bazaning izchil nusxasini oladi. `backups/` ichidagi fayllarni boshqa disk/serverda ham saqlang. Brauzerdagi Export Data esa faqat joriy workspace’ning JSON nusxasidir.

Bazani tiklashda app’ni to‘xtating; bazaning eski nusxasi va WAL/SHM fayllarini alohida saqlang, keyin backup SQLite faylini `DATABASE_PATH` manziliga qo‘ying. App’ni qayta ishga tushiring.

Kod yangilanganda qayta build/deploy qiling. Service worker yangi versiyani sahifalar yopilib qayta ochilgach qabul qiladi. `docker compose down -v` doimiy volume’larni o‘chiradi; oddiy yangilash uchun `docker compose up -d --build` yetarli.
