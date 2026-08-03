# NEXORA

Premium E-Commerce veb saytı və Excel ERP sistemi.

## Layihə Strukturu

```
nexora/
├── index.html                 # Ana səhifə
├── assets/{images,icons,fonts}
├── css/                       # Design system + layout.css
├── js/                        # app, shell, cart, wishlist, search, admin, …
├── pages/                     # Storefront + admin/index.html
├── includes/                  # header.html, footer.html (shell inject)
├── data/                      # JSON seed (products, users, coupons, …)
├── excel/
│   ├── NEXORA_ERP.xlsx
│   ├── templates/documents/   # 42 sənəd şablonu
│   ├── templates/email/       # 12+ email şablonu
│   ├── vba/                   # SKU, Documents, Email modulları
│   └── scripts/               # rebuild generatorları
└── README.md
```

### İşə salma (backend + sayt)

```bash
cd server
npm install
npm start
```

Aç: [http://127.0.0.1:8787](http://127.0.0.1:8787)  
API health: [http://127.0.0.1:8787/api/health](http://127.0.0.1:8787/api/health)

Express + SQLite backend: auth, məhsullar, sifarişlər, kuponlar. Ətraflı: `server/README.md`.

### Pulsuz production deploy

Addım-addım: **[DEPLOYMENT.md](./DEPLOYMENT.md)**  
Qısa yol: Render Blueprint (`render.yaml`) — API + storefront eyni servisdə.

Yalnız statik frontend üçün:

```bash
npx serve .
# və ya: python -m http.server 8080
```

## Brend Rəngləri

| Rəng | Hex | İstifadə |
|------|-----|----------|
| Primary Red | `#FF0000` | Əsas brend rəngi, CTA düymələr |
| Black | `#111111` | Başlıqlar, footer, qaranlıq elementlər |
| Dark Grey | `#1E1E1E` | Qaranlıq fon, kartlar |
| White | `#FFFFFF` | Əsas fon |
| Light Grey | `#E0E0E0` | Border, ayırıcı xətlər |

## Mərhələlər

| # | Mərhələ | Status |
|---|---------|--------|
| 1 | Design System & Components | ✅ Tamamlandı |
| 2 | Ana Səhifə | ✅ Tamamlandı |
| 3 | Məhsullar Səhifəsi | ✅ Tamamlandı |
| 4 | Məhsul Detal Səhifəsi | ✅ Tamamlandı |
| 5 | Kateqoriyalar Səhifəsi | ✅ Tamamlandı |
| 6 | Axtarış Sistemi | ✅ Tamamlandı |
| 7 | Səbət | ✅ Tamamlandı |
| 8 | Seçilmişlər (Wishlist) | ✅ Tamamlandı |
| 9 | Checkout | ✅ Tamamlandı |
| 10 | İstifadəçi Hesabı | ✅ Tamamlandı |
| 11 | Kampaniyalar | ✅ Tamamlandı |
| 12 | Brendlər | ✅ Tamamlandı |
| 13 | Haqqımızda | ✅ Tamamlandı |
| 14 | Əlaqə | ✅ Tamamlandı |
| 15 | FAQ | ✅ Tamamlandı |
| 16 | 404 Səhifə | ✅ Tamamlandı |
| 17 | Web Admin Panel | ✅ Tamamlandı |
| 18 | Excel ERP Sistemi | ✅ Tamamlandı |
| 19 | Sənəd Dövriyyəsi | ✅ Tamamlandı |
| 20 | Email Template Sistemi | ✅ Tamamlandı |

## Mərhələ 1 — Design System

### CSS Faylları

- **variables.css** — Bütün CSS custom properties (rənglər, spacing, typography, shadows, z-index)
- **typography.css** — Başlıqlar (h1-h6), body text, brend tipografiya, qiymət stilləri
- **buttons.css** — Primary, secondary, outline, ghost, danger, success variantları + ölçülər
- **cards.css** — Ümumi, məhsul, kateqoriya, stat kartları
- **forms.css** — Form qrupu, checkbox, radio, switch, input group, axtarış formu
- **inputs.css** — Text, select, textarea, floating label, range, file, quantity, OTP
- **modals.css** — Dialog, confirm, lightbox, drawer modallar
- **toasts.css** — Success, error, warning, info toast bildirişləri
- **icons.css** — İkon ölçüləri, rənglər, spinner, social icons

### JavaScript Komponentləri

```javascript
// İkonlar
NexoraIcons.create('cart', { size: 'md' });
NexoraIcons.render('#element', 'heart');
NexoraIcons.init(); // data-icon atributlarını işlədir

// Modallar
NexoraModal.open('#myModal');
NexoraModal.close('#myModal');
NexoraModal.confirm({ title: 'Təsdiq', message: '...', onConfirm: fn });

// Toast
NexoraToast.success('Sifariş yaradıldı!');
NexoraToast.error('Xəta baş verdi');
NexoraToast.warning('Stok azdır');
NexoraToast.info('Yeni kampaniya');
```

### HTML-də İstifadə

```html
<!-- CSS -->
<link rel="stylesheet" href="css/main.css">

<!-- İkon -->
<span class="icon icon-md" data-icon="cart"></span>

<!-- Düymə -->
<button class="btn btn-primary">Sifariş et</button>

<!-- JS -->
<script src="js/icons.js"></script>
<script src="js/components/modal.js"></script>
<script src="js/components/toast.js"></script>
<script src="js/main.js"></script>
```

## Design System Showcase

Mərhələ 1-i yoxlamaq üçün `pages/design-system.html` faylını brauzerdə açın.

## Mağaza (Mərhələ 2–17)

Lokal server ilə açın (JSON `fetch` üçün):

```bash
# nümunə
npx serve .
# və ya
python -m http.server 8080
```

Sonra `index.html` və ya `http://localhost:8080` açın.

### Əsas səhifələr

| Səhifə | Yol |
|--------|-----|
| Ana səhifə | `index.html` |
| Məhsullar | `pages/products.html` |
| Məhsul detalı | `pages/product.html?id=p001` |
| Kateqoriyalar | `pages/categories.html` |
| Axtarış | `pages/search.html?q=samsung` |
| Səbət | `pages/cart.html` |
| Seçilmişlər | `pages/wishlist.html` |
| Checkout | `pages/checkout.html` |
| Hesab | `pages/account.html` |
| Kampaniyalar | `pages/campaigns.html` |
| Brendlər | `pages/brands.html` |
| Haqqımızda / Əlaqə / FAQ / 404 | `pages/about.html`, `contact.html`, `faq.html`, `404.html` |
| Admin | `pages/admin/index.html` |

### Demo hesablar

- Müştəri: `demo@nexora.az` / `Demo1234`
- Admin: `admin@nexora.az` / `Admin1234`
- Kuponlar: `NEXORA10`, `SAVE50`, `PULSUZ`

### Təhlükəsizlik (client-side)

- Şifrələr **PBKDF2-SHA256** (120k iterasiya) ilə hash olunur
- Sessiyalar **HMAC** imzası + 8 saat expiry
- Rollar **roleSeal** ilə qorunur (localStorage-də `role: admin` yazmaq kifayət etmir)
- 5 uğursuz giriş → 15 dəq lockout
- XSS: `escapeHtml` / URL sanitize; CSP meta
- Admin rol dəyişimi / silmə → şifrə təsdiqi

> Qeyd: bu statik demodu — tam production təhlükəsizlik üçün server-side auth lazımdır.

### Shared shell

`includes/header.html` və `includes/footer.html` — runtime-da `js/shell.js` inject edir (`#site-header`, `#site-footer`).

## Texnologiyalar

- HTML5
- CSS3 (Custom Properties, Flexbox, Grid)
- JavaScript (Vanilla)
- Inter Font (Google Fonts)

## Responsive

Bütün komponentlər 3 breakpoint-də test edilib:
- **Desktop**: 1024px+
- **Tablet**: 768px — 1023px
- **Mobile**: 480px — 767px

## Dark Mode

`data-theme="dark"` atributu ilə qaranlıq tema aktivləşdirilir. Showcase səhifəsində tema dəyişdirmə düyməsi mövcuddur.
