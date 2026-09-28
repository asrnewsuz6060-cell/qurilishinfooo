# QurilishInfo — Render.com platformasiga bepul yuklash (Deployment) yo‘riqnomasi

Ushbu loyiha Render.com ga 1 bosishda to‘liq bepul joylash uchun 100% tayyorlangan (`render.yaml`, `package.json`, `server.js` va barcha API lari bilan).

---

## 1-qadam: GitHub ga yuklash

Loyihangizni o‘z GitHub profilingizga joylang:
```bash
git init
git add .
git commit -m "QurilishInfo v3.0 - AI Agent, Lex.uz va Admin markazi"
git branch -M main
git remote add origin https://github.com/SIZNING_PROFILINGIZ/qurilishinfo.git
git push -u origin main
```

---

## 2-qadam: Render.com da bepul Web Service yaratish

1. [https://render.com](https://render.com) saytiga kiring va bepul ro‘yxatdan o‘ting (GitHub orqali kirish tavsiya etiladi).
2. Yuqoridagi **"New +"** tugmasini bosing va **"Web Service"** ni tanlang.
3. O‘zingizning `qurilishinfo` GitHub repozitoriysini tanlang.
4. Render avtomatik ravishda `render.yaml` faylini aniqlaydi. Yoki qo‘lda quyidagicha to‘ldiring:
   - **Name**: `qurilishinfo`
   - **Region**: `Frankfurt (EU Central)`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan type**: `Free` (0$/oy, bepul)
5. **"Create Web Service"** tugmasini bosing.

---

## 3-qadam: Bepul Domen va SSL Sertifikati

Taxminan 1-2 daqiqada Render serverni ishga tushiradi va sizga bepul HTTPS domen taqdim etadi:
👉 `https://qurilishinfo.onrender.com`

- Bosh sahifa: `https://qurilishinfo.onrender.com`
- Admin va AI Markazi: `https://qurilishinfo.onrender.com/admin.html`
- Barcha funksiyalar:
  - Lex.uz havolalarini avtomatik o‘qish
  - Google Gemini / OpenAI / DeepSeek integratsiyasi
  - UZEX kotirovkalari
  - Telegram bot orqali kanalga xabar yuborish
  - 30+ dolzarb mavzular banki
  - News Re-writer (yangiliklarni qayta ishlash)
  - Word-style vizual WYSIWYG tahrirlash
