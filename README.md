# Daily System

Focus repozitoriyining asosiy ilovasi — Daily System. Oldingi mustaqil FOKUS sahifasi `legacy/fokus.html` arxivida saqlangan. Yangi ilova Node.js server bilan ishlaydi.

Asl `daily_planner (1).html` ilovasining funksiyalarini saqlagan, Forest & Linen uslubida qayta ishlangan, server va SQLite bilan ishlaydigan web ilova. Frontend ES modullarga ajratilgan va Vite bilan production uchun yig‘iladi.

## Lokal ishga tushirish

Node.js 24 yoki undan yangi versiya kerak. PowerShell’da:

```powershell
cd D:\Desktop\Focus\daily-system
npm ci
npm run dev
```

Brauzer: **http://127.0.0.1:3000**. Terminalni ochiq qoldiring; to‘xtatish uchun Ctrl+C. O‘rnatilgan paketlar mavjud bo‘lsa, keyingi safar faqat `npm run dev` yetarli.

## Yangi dizayn

`/` — interaktiv WebGL 3D obyekt va scroll animatsiyalari bilan kirish sahifasi. **Create your plan** orqali `/today` rejalashtirgichga o‘tiladi. Yangi foydalanuvchilar bo‘sh workspace va birinchi rejasini yaratish uchun qisqa yo‘riqnoma bilan boshlaydi. Ichki sakkizta sahifa yangi umumiy uslubda: to‘q yashil sidebar, och fon, progress halqasi, haftalik statistika, ochib-yopiladigan timeline va fokus taymeri. Harakatni kamaytirish sozlamasi qo‘llanadi; WebGL mavjud bo‘lmasa, CSS shakli ko‘rsatiladi.

Dizayn va tekshirish tafsilotlari: [Redizayn](docs/design/REDESIGN.md).

## Saqlangan imkoniyatlar

Today, Weekly, Plan Table, Exam Dates, All Days, Manage Plans, Pomodoro va Settings. Vazifa qo‘shish/tahrirlash/o‘chirish, drag orqali va tugmalar bilan tartiblash, bajarilgan holat, kelajak kunlarini cheklash, Study Flow, taymerni qayta ochishda tiklash, ovoz, bildirishnomalar, Brown Noise, JSON import/eksport va klaviatura qisqartmalari saqlangan. `npm run check` asl 100 ta funksiya mavjudligini tekshiradi.

Oldingi versiyalar avtomatik qo‘shgan kundalik rejalar server ochilganda va lokal cache yuklanganda tozalanadi. Foydalanuvchi yaratgan yoki nomini o‘zgartirgan rejalar saqlanadi. Yangi workspace, reset va hisobdan chiqish tayyor rejalar yoki imtihonlar qo‘shmaydi. Ish kunlari va dam olish kunlari uchun rejalar mustaqil yaratiladi.

## Serverda saqlash va hisob

Guest workspace hisob yaratmasdan ishlaydi. Settings → Manage account orqali hisob yaratsangiz, shu guest rejalari yangi hisobingizga biriktiriladi. Boshqa qurilmada Sign in orqali ular ochiladi. Sign out alohida guest workspace ochadi. Parollar scrypt bilan xeshlanadi, sessiya HttpOnly cookie orqali saqlanadi.

Har bir o‘zgarish avval shu qurilmaga yoziladi, so‘ng serverga yuboriladi. Internet bo‘lmasa o‘zgarish navbatda qoladi. Ikki qurilma bir xil ma’lumot turini o‘zgartirsa, ilova `Changes need review` ko‘rsatadi; hisob oynasida qaysi nusxani saqlashni tanlaysiz. Hozirgi qurilmadagi taymer sessiyalari boshqa qurilmaga ko‘chirilmaydi, hisobdagi reja va sozlamalar sinxronlanadi. Ochiq sahifaga boshqa qurilmaning o‘zgarishlari push qilinmaydi; qayta ochishda yuklanadi.

Production build’da service worker birinchi online tashrifdan keyin ilova fayllarini keshlaydi. Shundan so‘ng ilovani offline qayta ochish ham ishlaydi. Development rejimida service worker ro‘yxatdan o‘tkazilmaydi. Brown Noise asl YouTube manbasidan ishlaydi; internet va autoplay ruxsatiga bog‘liq.

## Eski ma’lumotlarni ko‘chirish

Eski HTML’ni oching → Settings → Export Data. Yangi ilovada Settings → Import Data orqali JSON’ni tanlang. `file://` HTML va `http://` sayt brauzerda turli storage hududlaridan foydalanadi; shu sabab eski fayldagi ma’lumotlar o‘z-o‘zidan olinmaydi. Asl fayl o‘zgartirilmagan.

## Tekshirish va yig‘ish

```powershell
npm run check
npm test
npm run build
npm run format:check
```

Server integratsiya testlari, production build, offline reload, ikki brauzerdagi hisob va conflict oqimlari tekshirildi. Qamrov: [docs/QA.md](docs/QA.md).

## Fayllar va dizayn

- `src/core/` — asl rejalar, umumiy holat, sanalar va hisoblashlar.
- `src/features/` — ekranlar, rejalar, imtihonlar, taymerlar, audio va hisob.
- `src/services/` — offline storage, serverga yozish, routing va accessibility.
- `server/` — HTTP API, sessiyalar, parol xeshlash va SQLite.
- `shared/schema.js` — frontend/backend uchun bir xil backup va ma’lumot tekshiruvi.
- `docs/design/` — asl dizayn arxivi va yangi redizayn qo‘llanmasi. Yangi brauzer suratlari `output/playwright/` ichida.
- `dist/` — `npm run build` orqali tayyorlangan production frontend.

[Arxitektura](docs/ARCHITECTURE.md) · [Deploy yo‘riqnomasi](docs/DEPLOYMENT.md) · [Dizayn qo‘llanmasi](docs/design/README.md).

## Internetga joylashtirish

Docker + Caddy fayllari tayyor. Domenni serverga ulang va [deploy yo‘riqnomasi](docs/DEPLOYMENT.md) bo‘yicha ishga tushiring. `npm start` HTTPS `APP_ORIGIN` talab qiladi. SQLite uchun doimiy disk/volume zarur; bir nechta mustaqil server nusxasini bir SQLite fayliga tarqatmang. Hozir sayt ommaviy domen yoki hostingga joylashtirilmagan.
