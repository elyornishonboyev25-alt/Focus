# Forest & Linen — Daily System redizayni

2026-10-09. Daily System uchun interaktiv kirish sahifasi va sakkizta ichki ekran.

## Yo‘nalish

Premium, sokin, maqsadga yo‘naltirilgan ish muhiti. To‘q forest yashil, sage accent va iliq och linen fon; katta kirish sarlavhalari va Georgia kursiv aksenti. Tizim shriftlari ishlatiladi, tashqi font yoki 3D kutubxona yuklanmaydi.

## Natija

- `/`: sahna ichida sekin aylanadigan WebGL trefoil knot. Yorug‘lik, yaltirash, sirt detali va pointer orqali burilish. Scroll reveal, floating yozuvlar va hover holatlari.
- `/today`: kundalik progress halqasi, haqiqiy session/minute statistikasi, mini taymer, imtihon countdown va reja ro‘yxati.
- `/weekly`: klaviatura orqali ham ochiladigan kun tugmalari; haftalik bajarilgan rejalar soni va har kunning foizli grafikasi.
- `/all`: oy bo‘yicha ajratilgan timeline; har kunning rejalarini native details orqali ochib-yopish.
- `/table`, `/exams`, `/manage`, `/pomodoro`, `/settings`: bir xil ranglar, typografika, input, card, navigation va modal uslubi.
- Mini taymer boshlash/to‘xtatish tugmasi dashboardning o‘zida ishlaydi. Asosiy Start focus tugmasi Pomodoro sahifasiga o‘tadi.
- Brand ikonasi, favicon va manifest ranglari yangilandi.

## Kod

- `src/styles/motion.css`: umumiy dizayn, responsive layout va motion.
- `src/features/sculpture.js`: local WebGL geometriya, shader, pointer, resize va context recovery.
- `src/features/experience.js`: kirish/ish muhiti, browser history, scroll reveal va sahifa o‘tishlari.
- `src/features/icons.js`: umumiy SVG ikonalar.
- `src/features/views.js`: mavjud ma’lumotlardan yangi ekranlar.

Asl UI fayllarining redizayndan oldingi nusxalari `output/redesign-backup/` ichida. `docs/design/original.html` va standalone eski HTML dizayn arxivi sifatida qoldirilgan.

## Motion va brauzer holatlari

Reduced-motion holatida CSS animatsiyalari va uzluksiz 3D aylanish to‘xtaydi; barcha reveal kontenti ko‘rinadi. 3D sahna ekrandan chiqsa yoki tab yashirilsa render loop to‘xtaydi. WebGL mavjud bo‘lmasa CSS shakli ko‘rsatiladi. GPU context qayta tiklansa eski observer va event listenerlar tozalanib, sahna qayta ochiladi.

## QA qamrovi

| Tekshiruv            | Tekshirilgan holat                                                     |
| -------------------- | ---------------------------------------------------------------------- |
| Kirish sahifasi      | Desktop va mobil; real WebGL, CTA, scroll bo‘limlari                   |
| Barcha 8 ichki route | 1440 px desktop va 390 px mobile; navigation va gorizontal overflow    |
| Ekran kengligi       | Kirish va Today: 320, 768, 1440 px; gorizontal overflow yo‘q           |
| Reja bajarilishi     | Belgilash progressni yangilaydi; oldingi holatga qaytarildi            |
| Modal                | Add plan, focus picker, account; Escape bilan yopish                   |
| Mini taymer          | Today ichida start/pause                                               |
| Pomodoro             | Start, pause, resume, reset                                            |
| Weekly               | Haqiqiy aggregate sonlar va Shape your routine navigatsiyasi           |
| Timeline             | Details ochish/yopish                                                  |
| Browser history      | Landing → planner → back → forward                                     |
| Reduced motion       | Brauzer emulyatsiyasi: 0 faol CSS animatsiya, reveal opacity 1         |
| WebGL yo‘q           | WebGL kontekstini testda o‘chirib, CSS fallback ko‘rinishi tekshirildi |

Desktop/mobile suratlari `output/playwright/` ichida. Bu tekshiruv redizayn qamroviga tegishli; barcha eski account/backup/conflict oqimlari qaytadan to‘liq end-to-end sinovdan o‘tkazilmadi. Mavjud API integratsiya testlarining 4 tasi o‘tdi. Syntax tekshiruvi barcha asl 100 funksiya saqlanganligini tasdiqlaydi.

Ko‘rish: `npm run dev`, keyin `http://127.0.0.1:3000/`. Production frontend: `npm run build`.

Yakuniy natija: production build, syntax/funksiyalarni saqlash tekshiruvi va loyiha format tekshiruvi muvaffaqiyatli o‘tdi. Brauzer pageerror hodisalari: 0. WebGL context loss/recovery ham tekshirildi.
