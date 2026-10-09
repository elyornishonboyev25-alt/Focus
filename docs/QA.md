# Tekshiruv qamrovi

## Create your plan — 2026-10-09

- Yangi workspace tayyor kundalik rejalarsiz ochiladi; avtomatik imtihonlar ham qo‘shilmaydi.
- Oldingi avtomatik rejalar va ularga bog‘liq completion/study sozlamalari tozalanadi; foydalanuvchi rejalari va nomi tahrirlangan rejalar saqlanadi.
- SQLite migration restartda revisionni yangilaydi, eski revision bilan yozishni rad qiladi va keyingi restartda takroriy o‘zgarish kiritmaydi.
- 7/7 Node testlari, syntax/function parity, production build va format tekshiruvi o‘tdi.
- Brauzer: Today’da Create your plan → birinchi reja → reload orqali tiklanish → o‘chirish orqali bo‘sh holatga qaytish tekshirildi.
- Weekly, All Days, Manage Plans va Plan Table bo‘sh holatlari hamda jadvaldagi Sat–Sun tugmasidan to‘g‘ri yaratish oynasi tekshirildi.
- 1440×960 desktop, 390×844 va 320×844 mobil suratlar olindi. Mobil o‘lchamlarda gorizontal overflow yo‘q.
- Suratlar: `output/playwright/create-plan-desktop.png`, `create-plan-mobile-390.png`, `create-plan-mobile-320.png`.

## Oldingi tekshiruv qamrovi

- Asl fayldagi 100 ta funksiya modullarda mavjudligini avtomatik tekshirish.
- Desktop: Today, Weekly, Plan Table, Exam Dates, All Days, Manage Plans, Pomodoro, Settings.
- Vazifa: qo‘shish, tahrirlash, belgilash, tartiblash, o‘chirish va qayta ochilganda tiklanish.
- Sana: oldingi/keyingi kun, Today, kelajakdagi vazifalarni belgilash cheklovi.
- Imtihon: qo‘shish, tahrirlash, sana hisoblash va o‘chirish.
- Pomodoro: start, pause, resume, reset, bloklar va sozlamalar; reload orqali tiklanish.
- Study Flow: boshlash, pause/resume, skip, kichraytirish va yopish.
- Hisob: ro‘yxatdan o‘tish, kirish, chiqish, mustaqil sessiyalar.
- Ma’lumot: JSON export/import, noto‘g‘ri backupni rad qilish, reset.
- Offline: mahalliy yozish, qayta ulanish, production service worker orqali qayta ochish.
- Server: SQLite restart, CSRF, noto‘g‘ri ma’lumot, revision conflict va workspace ajratilishi.
- Dizayn: 1440×960, 390×844, 320×740; modal va uzun matnlar, gorizontal overflow.

YouTube Brown Noise manbasi asl fayldagidek saqlanadi. U internet va brauzer autoplay siyosatiga bog‘liq; audio manbani tarmoqsiz eshitish tekshiruvi qamrovga kirmaydi.

## 2026-10-09 tekshiruv natijalari

- Syntax va function parity: 100 ta asl funksiya mavjud; barcha JS/MJS fayllari tekshirildi.
- Node integratsiya testlari: 4/4 o‘tdi (workspace, CSRF/revision, hisob, SQLite restart, backup validation).
- Vite production build va Prettier format tekshiruvi o‘tdi.
- Brauzerda vazifa qo‘shish/tahrirlash, completion va reload, tugmalar bilan tartiblash, Weekly/All Days va ikkala 30 kunlik jadval o‘tdi.
- Imtihon qo‘shish/tahrirlash/o‘chirish, Pomodoro start/pause/resume/reset/reload, blok sozlamalari, Study Flow pause/resume/skip/minimize/close o‘tdi.
- Guest ma’lumotlarini hisobga biriktirish, boshqa mustaqil brauzerdan login, logout izolyatsiyasi va server nusxasini tanlab conflict hal qilish o‘tdi.
- JSON export, valid/invalid import va workspace reset o‘tdi.
- Offline o‘zgarish va reconnect sync; production service worker bilan offline reload o‘tdi.
- Sana navigatsiyasi, kelajakdagi kun cheklovi, focus task tanlash, N/T qisqartmalari o‘tdi.
- Desktop barcha 8 ekran va 390 px/320 px mobil ko‘rinishlar tekshirildi; tekshirilgan ekranlarda gorizontal overflow topilmadi. Modal va Study Flow suratlari ko‘zdan kechirildi.
- SQLite live backup yaratish sinab ko‘rildi. Asl HTML nusxasi baytma-bayt tengligi tasdiqlandi.

Brauzer tekshiruvlari alohida QA bazalarida bajarildi. Test ma’lumotlari tarqatiladigan ZIP paketiga kiritilmaydi. YouTube audio eshitilishi va bildirishnoma ruxsatining OS darajasidagi natijasi tekshirilmagan. Docker/HTTPS deployment konfiguratsiyasi tayyor; actual hosting deployment bajarilmagan.
