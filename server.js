const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'database.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ma'lumotlar bazasini o'qish
function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return { settings: {}, articles: [], categories: [], advertisements: [], shorts: [], market_prices: [], weather_construction: [], roadmap_steps: [] };
    }
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error("Bazani o'qishda xatolik:", err);
    return { settings: {}, articles: [], categories: [], advertisements: [], shorts: [], market_prices: [], weather_construction: [], roadmap_steps: [] };
  }
}

// Ma'lumotlar bazasiga yozish
function writeDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error("Bazaga yozishda xatolik:", err);
    return false;
  }
}

// 1. Asosiy umumiy ma'lumotlar (Bosh sahifa va Admin uchun)
app.get('/api/data', (req, res) => {
  const db = readDB();
  res.json({
    articles: db.articles || [],
    settings: db.settings || {},
    categories: db.categories || [],
    advertisements: db.advertisements || [],
    shorts: db.shorts || [],
    market_prices: db.market_prices || [],
    weather_construction: db.weather_construction || [],
    roadmap_steps: db.roadmap_steps || []
  });
});

// 2. Maqolalar (Articles)
app.get('/api/articles', (req, res) => {
  const db = readDB();
  res.json(db.articles || []);
});

app.get('/api/articles/:id', (req, res) => {
  const db = readDB();
  const article = (db.articles || []).find(a => String(a.id) === String(req.params.id));
  if (!article) return res.status(404).json({ error: "Maqola topilmadi" });
  res.json(article);
});

// Yangi maqola qo'shish (Bilingual UZ/RU)
app.post('/api/articles', (req, res) => {
  const db = readDB();
  const articles = db.articles || [];
  
  const newArticle = {
    id: articles.length > 0 ? Math.max(...articles.map(a => Number(a.id) || 0)) + 1 : 1,
    title_uz: req.body.title_uz || req.body.title || "Sarlavhasiz maqola",
    title_ru: req.body.title_ru || "",
    lead_uz: req.body.lead_uz || req.body.lead || "",
    lead_ru: req.body.lead_ru || "",
    body_uz: req.body.body_uz || req.body.body || "",
    body_ru: req.body.body_ru || "",
    steps_uz: req.body.steps_uz || req.body.steps || "",
    steps_ru: req.body.steps_ru || "",
    category_uz: req.body.category_uz || req.body.category || "Qarorlar va qonunchilik",
    category_ru: req.body.category_ru || "Законодательство",
    category_id: req.body.category_id || "law",
    article_type: req.body.article_type || "official",
    image_url: req.body.image_url || "https://images.unsplash.com/photo-1541971875076-8f970d573be6?auto=format&fit=crop&w=1200&q=80",
    minutes: Number(req.body.minutes) || 5,
    views: Number(req.body.views) || 0,
    author: req.body.author || "Tahririyat",
    tags: req.body.tags || "",
    is_pinned: Number(req.body.is_pinned) || 0,
    is_featured: Number(req.body.is_featured) || 0,
    status: req.body.status || "published",
    published_at: req.body.published_at || new Date().toISOString().replace('T', ' ').substring(0, 19),
    created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
  };

  articles.unshift(newArticle);
  db.articles = articles;
  writeDB(db);

  // Telegramga avto-post tekshirish
  if (req.body.post_to_telegram && db.settings?.telegram_bot_token && db.settings?.telegram_channel_id) {
    sendTelegramPost(db.settings.telegram_bot_token, db.settings.telegram_channel_id, newArticle);
  }

  res.status(201).json(newArticle);
});

// Maqolani tahrirlash (Yangilash)
app.put('/api/articles/:id', (req, res) => {
  const db = readDB();
  const articles = db.articles || [];
  const index = articles.findIndex(a => String(a.id) === String(req.params.id));

  if (index === -1) {
    return res.status(404).json({ error: "Maqola topilmadi" });
  }

  articles[index] = {
    ...articles[index],
    ...req.body,
    id: articles[index].id
  };

  db.articles = articles;
  writeDB(db);

  res.json(articles[index]);
});

// Maqolani o'chirish
app.delete('/api/articles/:id', (req, res) => {
  const db = readDB();
  const articles = db.articles || [];
  const filtered = articles.filter(a => String(a.id) !== String(req.params.id));

  if (filtered.length === articles.length) {
    return res.status(404).json({ error: "Maqola topilmadi" });
  }

  db.articles = filtered;
  writeDB(db);

  res.json({ success: true, message: "Maqola muvaffaqiyatli o'chirildi" });
});

// 3. UZEX Bozor Narxlari (Market prices)
app.get('/api/market-prices', (req, res) => {
  const db = readDB();
  res.json(db.market_prices || []);
});

app.post('/api/market-prices', (req, res) => {
  const db = readDB();
  db.market_prices = req.body;
  writeDB(db);
  res.json({ success: true, market_prices: db.market_prices });
});

// UZEX sinxronizatsiya simulyatsiyasi (Yangilash)
app.post('/api/market-prices/sync-uzex', (req, res) => {
  const db = readDB();
  const prices = db.market_prices || [];
  const today = new Date().toISOString().substring(0, 10);

  // UZEX'dan yangi kotirovka bilan yangilash
  prices.forEach(p => {
    p.updated_date = today;
    if (p.id === 'cement') {
      p.uzex_ton_price = Math.round(640000 + (Math.random() * 20000 - 10000));
      p.retail_bag_price = Math.round((p.uzex_ton_price / 20) * 1.15 / 500) * 500;
      p.change = (Math.random() > 0.5 ? '+' : '-') + (Math.random() * 2).toFixed(1) + '%';
      p.trend = p.change.startsWith('+') ? 'up' : 'down';
    } else if (p.id === 'rebar') {
      p.uzex_ton_price = Math.round(9150000 + (Math.random() * 80000 - 40000));
      p.retail_bag_price = Math.round((p.uzex_ton_price / 1120) / 100) * 100;
      p.change = (Math.random() > 0.5 ? '+' : '-') + (Math.random() * 1.5).toFixed(1) + '%';
      p.trend = p.change.startsWith('+') ? 'up' : 'down';
    }
  });

  db.market_prices = prices;
  writeDB(db);
  res.json({ success: true, message: "UZEX narxlari muvaffaqiyatli sinxronlandi", market_prices: prices });
});

// 4. Qurilish Ob-havosi (Weather for Construction)
app.get('/api/weather', (req, res) => {
  const db = readDB();
  res.json(db.weather_construction || []);
});

// 5. Uy qurish yo'l xaritasi (Roadmap)
app.get('/api/roadmap', (req, res) => {
  const db = readDB();
  res.json(db.roadmap_steps || []);
});

// 6. Telegramga avto-post yuborish
function sendTelegramPost(botToken, channelId, article) {
  try {
    const text = `🏗 <b>${article.title_uz}</b>\n\n${article.lead_uz || ''}\n\n📌 <i>Rukn: #${article.category_uz.replace(/\s+/g, '_')}</i>\n\n🌐 Batafsil o‘qish uchun saytga kiring.`;
    const photoUrl = article.image_url;

    const postData = JSON.stringify({
      chat_id: channelId,
      photo: photoUrl,
      caption: text,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: "Saytda o‘qish ↗", url: "https://qurilishinfo.uz" }]
        ]
      }
    });

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${botToken}/sendPhoto`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (resp) => {
      let data = '';
      resp.on('data', chunk => data += chunk);
      resp.on('end', () => console.log("Telegram javobi:", data));
    });

    req.on('error', err => console.error("Telegramga yuborishda xatolik:", err));
    req.write(postData);
    req.end();
  } catch (err) {
    console.error("Telegram post xatolik:", err);
  }
}

app.post('/api/telegram/test', (req, res) => {
  const { bot_token, channel_id } = req.body;
  if (!bot_token || !channel_id) {
    return res.status(400).json({ error: "Bot token va kanal ID kiritilishi shart" });
  }

  const postData = JSON.stringify({
    chat_id: channel_id,
    text: req.body.custom_text || "✅ <b>QurilishInfo Telegram Avto-post tizimi muvaffaqiyatli ulandi!</b>\n\nEndi yangi maqolalar avtomatik ravishda ushbu kanalga joylanadi.",
    parse_mode: 'HTML'
  });

  const options = {
    hostname: 'api.telegram.org',
    port: 443,
    path: `/bot${bot_token}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const telegramReq = https.request(options, (resp) => {
    let data = '';
    resp.on('data', chunk => data += chunk);
    resp.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        if (parsed.ok) {
          res.json({ success: true, message: "Kanalga xabar yuborildi!" });
        } else {
          res.status(400).json({ error: parsed.description || "Telegram xatolik berdi" });
        }
      } catch (e) {
        res.status(500).json({ error: "Javobni tahlil qilib bo'lmadi" });
      }
    });
  });

  telegramReq.on('error', err => {
    res.status(500).json({ error: err.message });
  });

  telegramReq.write(postData);
  telegramReq.end();
});

// 7. Sozlamalar (Settings)
app.get('/api/settings', (req, res) => {
  const db = readDB();
  res.json(db.settings || {});
});

app.post('/api/settings', (req, res) => {
  const db = readDB();
  db.settings = { ...(db.settings || {}), ...req.body };
  writeDB(db);
  res.json(db.settings);
});

// 8. Reklamalar
app.get('/api/ads', (req, res) => {
  const db = readDB();
  res.json(db.advertisements || []);
});

app.post('/api/ads', (req, res) => {
  const db = readDB();
  db.advertisements = req.body;
  writeDB(db);
  res.json({ success: true, advertisements: db.advertisements });
});

// Ob-havo yangilash
app.post('/api/weather', (req, res) => {
  const db = readDB();
  db.weather_construction = req.body;
  writeDB(db);
  res.json({ success: true, weather: db.weather_construction });
});

// Roadmap yangilash
app.post('/api/roadmap', (req, res) => {
  const db = readDB();
  db.roadmap_steps = req.body;
  writeDB(db);
  res.json({ success: true, roadmap_steps: db.roadmap_steps });
});

// 9. Shorts
app.get('/api/shorts', (req, res) => {
  const db = readDB();
  res.json(db.shorts || []);
});

app.post('/api/shorts', (req, res) => {
  const db = readDB();
  db.shorts = req.body;
  writeDB(db);
  res.json({ success: true, shorts: db.shorts });
});

// 10. Kategoriyalar
app.get('/api/categories', (req, res) => {
  const db = readDB();
  res.json(db.categories || []);
});

app.post('/api/categories', (req, res) => {
  const db = readDB();
  db.categories = db.categories || [];
  if (Array.isArray(req.body)) {
    db.categories = req.body;
  } else if (req.body && req.body.id) {
    const idx = db.categories.findIndex(c => c.id === req.body.id);
    if (idx >= 0) {
      db.categories[idx] = { ...db.categories[idx], ...req.body };
    } else {
      db.categories.push(req.body);
    }
  } else {
    return res.status(400).json({ error: "Noto'g'ri kategoriya ma'lumotlari" });
  }
  writeDB(db);
  res.json({ success: true, categories: db.categories });
});

app.delete('/api/categories/:id', (req, res) => {
  const db = readDB();
  const id = req.params.id;
  if (id === 'all') {
    return res.status(400).json({ error: "'Barchasi' asosiy ruknini o'chirib bo'lmaydi" });
  }
  db.categories = (db.categories || []).filter(c => c.id !== id);
  writeDB(db);
  res.json({ success: true, categories: db.categories });
});

// 11. Baza tiklash
app.post('/api/backup/restore', (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: "Noto'g'ri ma'lumotlar formati" });
  }
  writeDB(req.body);
  res.json({ success: true, message: "Baza muvaffaqiyatli tiklandi" });
});

// 12. Lex.uz va Tashqi URL Scraper
function fetchUrlRaw(targetUrl, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error("Juda ko'p qayta yo'naltirish (Too many redirects)"));
    try {
      const u = new URL(targetUrl);
      const client = u.protocol === 'https:' ? https : http;
      const req = client.get(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'uz,ru,en;q=0.9'
        },
        timeout: 12000
      }, (resp) => {
        if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
          let nextUrl = resp.headers.location;
          if (!nextUrl.startsWith('http')) {
            nextUrl = new URL(nextUrl, targetUrl).toString();
          }
          return resolve(fetchUrlRaw(nextUrl, maxRedirects - 1));
        }

        let body = '';
        resp.on('data', chunk => body += chunk);
        resp.on('end', () => resolve(body));
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error("So'rov vaqti tugadi (Timeout)"));
      });
    } catch (e) {
      reject(e);
    }
  });
}

function parseScrapedHtml(html, url) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  let title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';

  // Lex.uz spesifik sarlavha qidirish
  const lexTitleMatch = html.match(/<div[^>]*class=["'][^"']*doc_title[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
    || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
    || html.match(/<div[^>]*class=["'][^"']*document-title[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  if (lexTitleMatch) {
    title = lexTitleMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  }

  // Tozalash
  let cleanHtml = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '');

  const lexBodyMatch = cleanHtml.match(/<div[^>]*id=["']doc_body["'][^>]*>([\s\S]*?)<\/div>/i)
    || cleanHtml.match(/<div[^>]*class=["'][^"']*doc_content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
    || cleanHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
    || cleanHtml.match(/<main[^>]*>([\s\S]*?)<\/main>/i);

  let rawContent = lexBodyMatch ? lexBodyMatch[1] : cleanHtml;

  let cleanText = rawContent
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();

  if (cleanText.length > 10000) {
    cleanText = cleanText.substring(0, 10000) + '\n\n... [matn hajmi qisqartirildi]';
  }

  return {
    url,
    title: title || "Lex.uz normativ hujjati",
    raw_text: cleanText,
    char_count: cleanText.length
  };
}

app.post('/api/ai/scrape-url', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "Havola (URL) kiritilmadi" });

  try {
    const rawHtml = await fetchUrlRaw(url);
    const result = parseScrapedHtml(rawHtml, url);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("Scraper xatosi:", err.message);
    res.status(500).json({ error: "Havolani yuklab bo'lmadi: " + err.message });
  }
});

// 13. Katta Til Modeli (LLM Proxy: Gemini, OpenAI, DeepSeek)
function postJsonRaw(urlStr, data, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(urlStr);
      const postBody = JSON.stringify(data);
      const options = {
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postBody),
          ...extraHeaders
        },
        timeout: 30000
      };
      const client = u.protocol === 'https:' ? https : http;
      const req = client.request(options, (resp) => {
        let body = '';
        resp.on('data', chunk => body += chunk);
        resp.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            if (resp.statusCode >= 400) {
              return reject(new Error(parsed.error?.message || parsed.error || `HTTP ${resp.statusCode}`));
            }
            resolve(parsed);
          } catch (e) {
            reject(new Error("Noto'g'ri JSON: " + body.substring(0, 150)));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error("AI server javob berish vaqti tugadi (Timeout)"));
      });

      req.write(postBody);
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

app.post('/api/ai/llm', async (req, res) => {
  const { provider, apiKey, prompt, systemPrompt, model } = req.body;
  if (!apiKey) return res.status(400).json({ error: "API kalit kiritilmadi" });

  try {
    if (provider === 'gemini') {
      const selectedModel = model || 'gemini-1.5-flash';
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [
          {
            role: "user",
            parts: [{ text: (systemPrompt ? systemPrompt + "\n\n" : "") + prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 3000
        }
      };

      const aiRes = await postJsonRaw(geminiUrl, payload);
      const text = aiRes.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return res.json({ success: true, text });
    } else if (provider === 'openai' || provider === 'deepseek') {
      const endpoint = provider === 'deepseek'
        ? 'https://api.deepseek.com/v1/chat/completions'
        : 'https://api.openai.com/v1/chat/completions';
      
      const selectedModel = model || (provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini');
      const payload = {
        model: selectedModel,
        messages: [
          ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
          { role: "user", content: prompt }
        ],
        temperature: 0.7
      };

      const aiRes = await postJsonRaw(endpoint, payload, { 'Authorization': `Bearer ${apiKey}` });
      const text = aiRes.choices?.[0]?.message?.content || "";
      return res.json({ success: true, text });
    } else {
      return res.status(400).json({ error: "Noma'lum AI provider: " + provider });
    }
  } catch (err) {
    console.error("LLM API xatosi:", err.message);
    res.status(500).json({ error: "AI model bilan bog'lanishda xatolik: " + err.message });
  }
});

// Barcha sahifalarni statik fayllarga yo'naltirish
app.get('*', (req, res) => {
  const file = path.join(__dirname, 'public', req.path);
  if (fs.existsSync(file) && fs.lstatSync(file).isFile()) {
    return res.sendFile(file);
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`QurilishInfo serveri ishga tushdi: http://localhost:${PORT}`);
});
