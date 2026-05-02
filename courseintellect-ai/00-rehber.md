# CourseIntellect AI — Rehber

> Sadece ders/akademik konularda yanıt veren, bizim ekosistemimize ait bir asistan inşa etme stratejisi. Bu doküman; **mimari kararı**, **teknoloji yığını**, **veri toplama planı**, **fazlı yol haritası** ve **bütçe-yasal sınırları** kapsar.

## TL;DR — Önerilen yol

- **Yaklaşım**: Sıfırdan LLM eğitme **HAYIR**. Hazır LLM + **RAG (Retrieval-Augmented Generation)** **EVET**.
- **MVP (1-2 hafta)**: Cloud LLM (OpenAI `gpt-4o-mini` veya Anthropic Claude Haiku) + sıkı sistem promptu + 0 veri = "sadece eğitim" filtreli chat. Anında çalışır.
- **Faz 2 (2-4 hafta)**: Kurum kendi PDF/ders materyallerini yükler → embedding → pgvector → RAG. Cevaplar artık kurumun kendi içeriğine dayanır + kaynak gösterir.
- **Faz 3 (4+ hafta)**: Kamuya açık Türkçe eğitim kaynakları (MEB, Wikipedia, üniversite open-courseware) toplanır → ortak korpusa eklenir.
- **Faz 4 (opsiyonel)**: Maliyet kontrolü için self-host (Ollama + Llama 3.1 / Qwen 2.5).

---

## 1. Neden sıfırdan model eğitmiyoruz?

| Yaklaşım | Maliyet | Süre | Kalite | Bakım |
|---|---|---|---|---|
| Sıfırdan ön-eğitim (pretraining) | $5M–$50M | 6+ ay | Belirsiz | Sürekli ekip |
| Mevcut modeli **fine-tune** | $1K–$50K + GPU | 2-4 hafta | Orta-iyi | Her veri eklendiğinde tekrar |
| **RAG** (hazır LLM + kendi veri) | $0–$1K/ay | 1-3 hafta | İyi-mükemmel | Sadece veri ekle |
| API + sistem promptu | $50–$500/ay | 1 hafta | İyi (genel) | Yok |

**Kararımız**: **RAG** — domain-specific asistanlar için modern altın standart. Apple, Notion AI, GitHub Copilot Chat hepsi bu mimaride çalışıyor. Sıfırdan model eğitmek bizim gibi ekipler için tek başına pazarlama / çeşitlilik / risk açılarından mantıksız.

> **"Kendi yapay zekamız" ne demek olacak?** — RAG ile ürün şu özelliklerle "bizim AI'mız" olur: (1) Ders dışı sorulara cevap **vermez**. (2) Cevaplar **bizim verdiğimiz dokümanlardan** üretilir, genel "halüsinasyon" olmaz. (3) Marka ve davranış tamamen bizim kontrolümüzde. (4) Kaynak gösterir (öğrenci hangi kitap-konu-sayfada bulacağını bilir). LLM marka olarak kullanıcıya görünmez — kullanıcı için bu **CourseIntellect AI**'dir.

---

## 2. Mimari — Yüksek seviye

```
┌──────────────────────────────────────────────────────────────┐
│  KULLANICI (Öğrenci) — Desktop / Mobile / Web                │
│  "Asit-baz reaksiyonlarını anlatır mısın?"                   │
└─────────────────┬────────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────────┐
│  AI Service (FastAPI)                                        │
│  1) Topic gate: bu soru eğitimle ilgili mi?                  │
│  2) Embedding üret: soru → 1024-boyutlu vektör               │
│  3) Vector search: pgvector'dan en yakın 5-8 chunk getir     │
│  4) Prompt inşa et: sistem + retrieved chunks + soru         │
│  5) LLM'e gönder (OpenAI/Claude/Ollama)                      │
│  6) Yanıt + kaynak referansları döndür                       │
└─────────────────┬────────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────────┐
│  PostgreSQL + pgvector                                       │
│  - course_documents     (kurum yüklemeleri)                  │
│  - public_documents     (MEB / Wikipedia / üniversite)       │
│  - document_chunks      (embedding + metin + kaynak)         │
│  - chat_sessions        (öğrenci konuşma geçmişi)            │
└──────────────────────────────────────────────────────────────┘
                  ▲
                  │ ingestion pipeline (offline)
┌─────────────────┴────────────────────────────────────────────┐
│  Veri Toplama Pipeline'ı                                     │
│  - Kurum yüklemeleri: PDF/Word/Slayt → parse → chunk → embed │
│  - Web kazıma: izinli kaynaklardan → dedup → embed           │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Teknoloji yığını — somut seçimler

| Katman | Seçim | Neden |
|---|---|---|
| **AI Servis dili** | Python 3.12 + FastAPI | LLM ekosistemi (LangChain/LlamaIndex/HF) Python'da. Mevcut .NET backend ile HTTP üzerinden konuşur. |
| **LLM (MVP)** | OpenAI `gpt-4o-mini` | Türkçesi iyi, $0.15/$0.60 per 1M token, çok ucuz. Anthropic Claude Haiku alternatif. |
| **LLM (self-host)** | Ollama + `llama3.1:8b-instruct-q4_K_M` veya `qwen2.5:14b-instruct` | Tek RTX 4060 (8GB) veya 4090 yeter. Türkçe Qwen daha güçlü. |
| **Embedding modeli** | `intfloat/multilingual-e5-large` (Hugging Face) | Açık kaynak, Türkçe + İngilizce + matematik dengeli. 1024-boyutlu. CPU'da bile koşar. |
| **Vector DB** | **pgvector** (Postgres extension) | Mevcut PostgreSQL'in üstüne ekler, ayrı sistem yok. İlk 100K chunk için yeterli. Daha sonra Qdrant'a geçilebilir. |
| **Dokümen parser** | `unstructured.io` (Apache 2) + `pypdf2` | Office/PDF/HTML kapsamlı destek. |
| **Web scraping** | Playwright (Microsoft, Apache 2) | JS-heavy siteleri de çekebilir. |
| **Orkestrasyon** | LangChain veya LlamaIndex | RAG zincirleri, prompt template, retriever soyutlamaları hazır. |
| **Reranker (Faz 2.5)** | `BAAI/bge-reranker-v2-m3` | Top-50 chunk → top-5 kalite filtresi, doğruluk %15-25 artar. |
| **Cost & rate-limit** | Redis + token bucket | Kurum başına aylık quota, anti-abuse. |

---

## 4. "Sadece ders" kısıtı — savunma katmanları

Tek katman yetmez, üst üste 3 katman:

### Katman A — Sistem Promptu (zorunlu)

```text
Sen CourseIntellect AI'sın. SADECE Türk eğitim sistemine ait akademik konularda
yardımcı olursun: matematik, fen bilimleri (fizik/kimya/biyoloji), Türkçe,
edebiyat, tarih, coğrafya, felsefe, yabancı dil, ders ödevleri, sınav hazırlığı,
çalışma teknikleri, üniversite seçimi, kariyer rehberliği.

KESİNLİKLE YANITLAMAYACAĞIN konular: siyaset, dini fıkıh, tıbbi tanı, hukuki
danışmanlık, yatırım tavsiyesi, kişisel ilişkiler, eğlence içerikleri (film,
müzik, oyun yorumu), yetişkin içeriği, şiddet, illegal aktiviteler, başka
markalar/şirketler hakkında karşılaştırmalar.

Eğer soru kapsam dışıysa nazikçe reddet:
"Bu yardımcı sadece ders ve eğitim konularında yardımcı olur. Ders konunu
sorarsan severek anlatırım."

Yanıtların aşağıdaki BAĞLAM'da verilen belgelere DAYANMALI. Belgelerde olmayan
şeyleri uydurma; bilmiyorsan "bu konuda yeterli kaynağım yok" de. Her cevap
sonunda kullandığın belgelerin kaynak başlıklarını listele.

BAĞLAM:
{retrieved_chunks}

SORU: {user_question}
```

### Katman B — Topic Gate (kod)

LLM çağrılmadan önce hızlı bir kontrol:
- Soru ≤ 8 kelime ise: tamamı küçük harf, küfür/argo dictionary'sinde mi?
- 200+ embedding örneği oluşturulan "ders" prototip vektörlerine ile cosine similarity. Eşik altında ise reddedilir (LLM hiç çağrılmaz, ücretsiz red).
- TR-only normalize (ı, ğ, ş, ç → standartlanır)

### Katman C — Çıktı kontrolü

LLM çıktısı dönerken:
- Yanıt belgelerden alıntı yapıyor mu? (en az 1 kaynak referansı kontrol edilir)
- Yanıtta forbidden phrases mi var? (hak ihlal eden marka adı, başka platform önerisi)
- Yoksa fallback yanıta düş

---

## 5. Veri toplama planı — yasal Türkçe eğitim kaynakları

> ⚠️ **Yasal not**: Telif altındaki kitap/test PDFlerini izinsiz scrape etmek SUÇTUR. Aşağıdaki kaynaklar **açık lisans** veya **kamu malı**. Her birini ekledikten sonra `data/sources.md` dosyasına lisans + tarih kaydedilir.

### Birinci öncelik — yüksek kalite, açık lisans
| Kaynak | Lisans | İçerik | Format |
|---|---|---|---|
| **Vikipedi (Türkçe)** | CC BY-SA 3.0 | Tüm ansiklopedik konular | XML dump + API |
| **MEB EBA Açık Kaynaklar** | Kamu | Ortaöğretim ders kitapları PDF | PDF |
| **MEB Müfredat** | Kamu | Tüm sınıflar müfredat dokümanları | PDF |
| **Khan Academy Türkçe** | CC BY-NC-SA | Matematik, fen, ekonomi | API + scrape |
| **Açık Erişim Yayınları (DergiPark, Tubitak)** | Çoğu CC BY | Akademik makaleler | PDF |
| **TÜBA-Tübitak Kitaplıkları** | Bağışlanmış | Bilim kitapları | PDF |
| **Boğaziçi/ITU/METU OpenCourseWare** | Bazıları CC | Üniversite ders notları | HTML/PDF |
| **Wikiversity TR** | CC BY-SA | Eğitim kursu materyalleri | API |

### İkinci öncelik — kurumun kendi içeriği (zaten elimizde)
- Tenant'ların yüklediği ders notları (`/api/files`)
- Ödev şablonları, sınav arşivi
- Bu **otomatik** RAG'a girer; ekstra çalışma gerekmez.

### Üçüncü öncelik — ileride
- Talim Terbiye Kurulu kararları
- Üniversite ders katalogları
- YÖK Ulusal Tez Merkezi (özetler kamu malı)

### Tamamen hayır
- ❌ Test kitapları PDF'leri (Yayınevi telifli)
- ❌ Özel okul materyalleri
- ❌ Ücretli platform içerikleri
- ❌ Forum/dershane scraping (telif belirsiz)

---

## 6. Veri pipeline'ı — nasıl çalışır

```
1. Kaynak indir (Wikipedia dump, MEB PDF, vb.)
2. Parse: unstructured.io → temiz text bölümleri (başlık, paragraf, tablo, formül)
3. Temizle: HTML kaldır, Unicode normalize, diakritikleri düzelt
4. Chunk: 500-800 token boyutunda, 100 token örtüşmeli
5. Metadata ekle: kaynak adı, URL, tarih, lisans, sınıf seviyesi, ders kategorisi
6. Embed: multilingual-e5-large → 1024-d vektör
7. Yaz: pgvector tablosuna
8. Index: HNSW indeksi (hızlı arama)
```

İlk hedef: **50.000 chunk** ortak korpusa. Bu yaklaşık:
- ~5.000 Wikipedia ders ilgili sayfa
- ~50 MEB ders kitabı
- ~3.000 Khan Academy konu
- ~10.000 ek doküman (üniversite, açık erişim)

---

## 7. Faz planı — somut çıktılar

### 🚀 Faz 0 — Hazırlık (3-5 gün)
- [ ] OpenAI / Anthropic / Google API anahtarları
- [ ] Python servisi iskeleti (`courseintellect-ai/service/`)
- [ ] pgvector eklentisi `course_intellect` veritabanına eklenir
- [ ] `chat_sessions`, `chat_messages`, `document_chunks` tablo migration'ları
- [ ] AI servisi için ayrı port (`8001`) + .NET backend'den HTTP proxy

### 🔥 Faz 1 — MVP Asistan (1-2 hafta)
**Çıktı**: Her öğrenci/öğretmen sorabileceği, sadece ders cevap veren chat.
- [ ] FastAPI: `/ai/chat` endpoint
- [ ] Sistem promptu (Madde 4'teki) tam uygulanmış
- [ ] Topic gate (basit anahtar kelime + cosine similarity)
- [ ] Sohbet geçmişi (oturum bazlı)
- [ ] Frontend: desktop'ta varolan AI sayfasını gerçek API'ye bağla
- [ ] Mobile: aynı endpoint'e basitçe bağla
- [ ] Rate limit: kurum başına günlük 1000 mesaj, kullanıcı başına 50

### 📚 Faz 2 — Kurum İçeriği RAG (2-4 hafta)
**Çıktı**: Kurum yüklediği materyallerden cevap üreten asistan.
- [ ] PDF/Word ingestion endpoint: `/ai/ingest/document`
- [ ] Background job: parse → chunk → embed → pgvector
- [ ] Multi-tenant filtering: tenant'ın kendi koleksiyonu + ortak public koleksiyon
- [ ] Reranker eklenmesi (top-50 → top-5 kalite filtresi)
- [ ] Kaynak gösterimi UI'da: "Bu yanıt **9.Sınıf Matematik · Bölüm 4 · sf 87**'den"
- [ ] Embedding model'i Türkçe-tuned versiyona geçişin değerlendirmesi

### 🌐 Faz 3 — Açık Web Korpusu (4+ hafta)
**Çıktı**: 50K+ chunk açık eğitim korpusu, kurumlar arası ortak.
- [ ] Wikipedia TR dump indirici + ders-ilgili sayfa filtresi
- [ ] MEB PDF batch ingestion
- [ ] Khan Academy API entegrasyonu
- [ ] Quality scoring: chunk başına güven skoru
- [ ] Periyodik güncelleme (ayda 1 re-ingestion)

### 💸 Faz 4 — Self-host (opsiyonel, 4+ hafta)
**Çıktı**: Aylık maliyet düşer, KVKK avantajı (veri Türkiye'de kalır).
- [ ] GPU sunucu temini (RTX 4090 24GB veya A100 40GB)
- [ ] Ollama deployment
- [ ] vLLM ile production-grade serving
- [ ] A/B test: cloud vs self-host kalite karşılaştırması
- [ ] Maliyet yeterince düştüğünde tam geçiş

---

## 8. Yasal & Etik

- **KVKK uyumu**: Öğrenci sorularında kişisel veri olabilir. API'ye gönderirken **PII scrubbing** (ad, T.C., adres regex temizleme).
- **Cloud LLM provider'lar veri saklıyor mu?** OpenAI Enterprise tier'da "no training, 30-day retention". Sözleşme şart.
- **Telif**: Yukarıdaki sadece açık lisans listesi. Ekstra kaynak eklemek istersen önce yasal kontrol.
- **Halüsinasyon riski**: RAG bunu büyük ölçüde önler ama %0 değil. Frontend'de uyarı: "Yanıtlar yapay zeka tarafından üretilir, kritik bilgileri öğretmenine doğrulat."
- **Çocuk koruma**: Tüm sohbetler kayıt altına alınır, kurum yöneticisi denetleyebilir. Uygunsuz içerik tetiklerse bildirim.

---

## 9. Maliyet tahmini

### MVP (Faz 1) — 1000 öğrenci, ortalama 30 mesaj/ay
- **OpenAI gpt-4o-mini**: 30K mesaj × ~600 token (in) + 200 token (out) ≈ 24M token/ay
  - Maliyet: 24M × ($0.15 in + $0.60 out)/1M = **~$5/ay**
- **Embedding** (e5-large): kendi sunucuda, CPU yeterli, **$0**
- **pgvector**: mevcut Postgres üstüne, **$0**
- **TOPLAM**: $5-15/ay (1000 aktif öğrenci için)

### Faz 2 — 10K öğrenci aktif
- LLM: ~$50-100/ay
- Doküman ingestion'ı one-time, veri saklama negligible

### Faz 4 — Self-host
- GPU sunucu kira (Hetzner / OVH): ~$200-500/ay
- 50K+ öğrenci için OpenAI faturasından düşük

**Karşılaştırma**: Sıfırdan eğitim $5M+. Bizim plan $50-500/ay ile production-grade asistan.

---

## 10. Bir sonraki adım — sen karar ver

Bu rehberi okuduktan sonra benim sana sorularım:

1. **LLM provider tercihi**: 
   - **A.** OpenAI (`gpt-4o-mini`) — en ucuz, hızlı, Türkçesi iyi
   - **B.** Anthropic (Claude Haiku) — Türkçesi çok iyi, biraz pahalı
   - **C.** Google Gemini Flash — orta
   - **D.** Self-host'a hemen başla — düşük maliyet, daha çok mühendislik
   
   *Önerim: **A** ile başla, Faz 4'te D'ye geç.*

2. **Faz 1'i ne kadar minimal istiyorsun?**
   - **A.** Saf sistem promptu, hiç RAG yok — 3 günde çalışır
   - **B.** Wikipedia TR ile lite RAG — 1-2 haftada çalışır, daha kaliteli yanıt
   
   *Önerim: **B** — RAG'siz çıkmak halüsinasyon riski yüksek.*

3. **Veri toplama önceliği**: Önce kendi öğretmen materyallerimi mi (kurum kullanıcıları yükleyince) yoksa public Türkçe korpus mu (Wikipedia/MEB)?
   - *Önerim: **public korpus önce**, kurum içeriği yükleme akışı paralel kurulur.*

4. **Ödev/sınav konuları için "doğru cevabı doğrudan ver" politikası**:
   - **A.** Direkt cevap ver
   - **B.** İpucu ver, çözüm adımlarını söyle ama nihai cevabı verme (öğretici tarz)
   - **C.** Kurum yöneticisi seçer
   
   *Önerim: **C** — eğitim politikası kuruma göre değişir.*

---

## Dosya yapısı (oluşacak)

```
courseintellect-ai/
├── 00-rehber.md            ← bu doküman
├── 01-mimari-detay.md      ← daha sonra: tablo şemaları, prompt template'leri
├── 02-veri-pipeline.md     ← scraper rehberleri, lisans takibi
├── 03-deployment.md        ← Docker compose, GPU server kurulum
├── service/                ← Python FastAPI projesi
│   ├── app/
│   │   ├── main.py
│   │   ├── topic_gate.py
│   │   ├── retriever.py
│   │   ├── llm_client.py
│   │   └── prompts/
│   ├── ingestion/
│   │   ├── wikipedia.py
│   │   ├── meb_pdf.py
│   │   └── pipeline.py
│   ├── pyproject.toml
│   └── Dockerfile
├── data/
│   ├── sources.md          ← her kaynak için lisans + tarih kaydı
│   └── raw/                ← (gitignore) ham indirilen dosyalar
└── prompts/
    ├── system.tr.md
    ├── refusal.tr.md
    └── citation.tr.md
```

---

## Özet — şu anki konum

✅ **Bu rehber yazıldı.**
⏳ Bekleyen: kararlar (Madde 10'daki 4 soru)
⏳ Sonra: Faz 0 başlangıcı — Python servisi iskeleti + pgvector migration

Karar verdiğinde, kararına göre **Faz 0**'ı somutlaştırırım: gerçek kod, gerçek migration, gerçek prompt'lar. Hadi başlayalım.
