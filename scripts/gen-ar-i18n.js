'use strict';

const fs = require('fs');
const path = require('path');

const i18nPath = path.join(__dirname, '..', 'js', 'i18n.js');
let src = fs.readFileSync(i18nPath, 'utf8');

// Pull EN block as base for key list (same keys as AZ)
const enMatch = src.match(/\n    en: \{([\s\S]*?)\n    \}\n  \};/);
if (!enMatch) {
  console.error('Could not find en dict block');
  process.exit(1);
}

const enBody = enMatch[1];
const enPairs = {};
enBody.replace(/(\w+):\s*'((?:\\'|[^'])*)'/g, function (_, k, v) {
  enPairs[k] = v.replace(/\\'/g, "'");
  return _;
});

/** Arabic UI translations for storefront chrome */
const arMap = {
  search_ph: 'ابحث عن منتج أو علامة أو SKU...',
  search_btn: 'بحث',
  home: 'الرئيسية',
  products: 'المنتجات',
  categories: 'الفئات',
  campaigns: 'العروض',
  lookbook: 'لوك بوك',
  consultant: 'مستشار الذكاء الاصطناعي',
  office_builder: 'منشئ المكتب',
  offer_generator: 'عرض PDF',
  compare: 'مقارنة',
  brands: 'العلامات',
  news: 'أخبار',
  news_sub: 'تحديثات Apple وSamsung وNVIDIA وIntel وAMD وSony',
  news_home: 'أخبار التقنية',
  news_home_sub: 'أحدث العلامات — بنظرة واحدة',
  about: 'من نحن',
  contact: 'اتصل بنا',
  faq: 'الأسئلة الشائعة',
  track: 'تتبع الطلب',
  business: 'لوحة الأعمال',
  cart: 'السلة',
  wishlist: 'المفضلة',
  account: 'الحساب',
  theme: 'المظهر',
  add_cart: 'أضف إلى السلة',
  out_of_stock: 'غير متوفر',
  sold_out: 'نفدت الكمية',
  shop: 'المتجر',
  lang: 'اللغة',
  support: 'الدعم',
  company: 'الشركة',
  view_all: 'عرض الكل',
  more: 'المزيد',
  register: 'إنشاء حساب',
  login: 'تسجيل الدخول',
  auth_gate_title: 'أنشئ حساباً أولاً',
  auth_gate_cart: 'للإضافة إلى السلة سجّل أولاً. مجاناً ويستغرق 20 ثانية!',
  auth_to_checkout: 'تسجيل / دخول — لإتمام الطلب',
  auth_required_cart: 'يلزم التسجيل للإضافة إلى السلة',
  sales: 'تخفيضات',
  all_brands: 'كل العلامات',
  new_arrivals: 'وصل حديثاً',
  new_arrivals_sub: 'أضيف هذا الأسبوع — اختيارات جديدة',
  bestsellers: 'الأكثر مبيعاً',
  bestsellers_sub: 'مفضلات العملاء',
  deals: 'عروض مميزة',
  deals_sub: 'يستحق الشراء الآن',
  categories_sub: 'اكتشف الفئات الشائعة',
  brands_sub: 'علامات عالمية في NEXORA',
  why_nexora: 'لماذا NEXORA؟',
  why_sub: 'مزايانا',
  skip_content: 'انتقل إلى المحتوى',
  prev: 'السابق',
  next: 'التالي',
  view_campaign: 'عرض الحملة',
  added_cart: 'تمت الإضافة إلى السلة',
  added_wish: 'أضيف إلى المفضلة',
  removed_wish: 'أزيل من المفضلة',
  load_error: 'تعذر تحميل البيانات',
  loading: 'جارٍ التحميل...',
  cart_empty: 'السلة فارغة',
  cart_empty_hint: 'اختر منتجات من الكتالوج وابدأ التسوق.',
  browse_products: 'تصفح المنتجات',
  wishlist_empty: 'المفضلة فارغة',
  checkout: 'إتمام الطلب',
  continue_shop: 'متابعة التسوق',
  subtotal: 'المجموع الفرعي',
  shipping: 'الشحن',
  total: 'الإجمالي',
  free: 'مجاناً',
  coupon: 'رمز القسيمة',
  apply: 'تطبيق',
  remove: 'حذف',
  quantity: 'الكمية',
  day: 'يوم',
  hour: 'ساعة',
  min: 'دقيقة',
  sec: 'ثانية',
  compare_title: 'قارن المنتجات',
  compare_sub: 'اختر 2–3 منتجات — السعر والتقييم والمواصفات معاً.',
  compare_empty: 'لا يوجد شيء بعد',
  compare_need: 'يلزم منتجان على الأقل للمقارنة.',
  compare_clear: 'مسح',
  compare_search: 'ابحث عن منتج أو علامة...',
  compare_add: 'أضف للمقارنة',
  compare_added: 'أضيف للمقارنة',
  consult_title: 'مستشار ذكي',
  consult_sub: 'اكتب ميزانيتك واحتياجك — نختار المنتجات المناسبة',
  consult_ask: 'اسأل',
  consult_ph: 'مثال: ميزانيتي 3000، أريد حاسوباً للألعاب',
  consult_recs: 'التوصيات',
  add_all: 'أضف الكل إلى السلة',
  product: 'المنتج',
  description: 'الوصف',
  specs: 'المواصفات',
  reviews: 'التقييمات',
  related: 'منتجات مشابهة',
  in_stock: 'متوفر',
  pieces: 'قطعة',
  wa_order: 'طلب واتساب',
  filters: 'الفلاتر',
  sort: 'الترتيب',
  price: 'السعر',
  rating: 'التقييم',
  brand: 'العلامة',
  search: 'بحث',
  search_results: 'نتائج البحث',
  search_enter_query: 'أدخل كلمة البحث',
  search_type_to_search: 'اكتب للبحث',
  search_for: 'النتائج',
  did_you_mean: 'هل تقصد:',
  smart_search_hint: 'بحث ذكي: «ايفون» → iPhone',
  products_found: 'منتجاً وُجد',
  product_not_found: 'المنتج غير موجود',
  coupon_applied: 'تم تطبيق القسيمة',
  coupon_not_found: 'القسيمة غير موجودة',
  coupon_min_order: 'الحد الأدنى للطلب',
  wa_hello: 'مرحباً!',
  no_results: 'لا نتائج',
  all_results: 'كل النتائج →',
  logout: 'تسجيل الخروج',
  orders: 'الطلبات',
  addresses: 'العناوين',
  profile: 'الملف الشخصي',
  save: 'حفظ',
  cancel: 'إلغاء',
  close: 'إغلاق',
  admin: 'المشرف',
  footer_tag: 'تجارة إلكترونية متميزة',
  footer_desc: 'منصة تجارة إلكترونية متميزة. منتجات عالية الجودة وتوصيل سريع وخدمة موثوقة.',
  track_title: 'تتبع الطلب',
  order_timeline: 'مسار الطلب',
  order_accepted: 'تم القبول',
  order_preparing: 'قيد التحضير',
  order_courier: 'مع المندوب',
  order_delivered: 'تم التسليم',
  order_live: 'مباشر',
  contact_title: 'اتصل بنا',
  about_title: 'من نحن',
  faq_title: 'الأسئلة الشائعة',
  page_home: 'الرئيسية',
  badge_new: 'جديد',
  badge_hit: 'الأكثر طلباً',
  best_price: 'الأرخص',
  best_rating: 'الأعلى تقييماً',
  open_compare: 'افتح المقارنة',
  smart_tips: 'نصائح الذكاء الاصطناعي',
  price_history: 'سجل السعر (60 يوماً)',
  configurator: 'مُكوِّن المنتج',
  room_preview_title: 'معاينة الغرفة الذكية',
  room_preview_desc: 'اعرض الغرفة بكاميرا الهاتف — شاهد التلفاز على الجدار.',
  room_preview_cta: 'معاينة الغرفة — على الجدار',
  room_preview_hint: 'وجّه الكاميرا للجدار. اسحب التلفاز وغيّر حجمه.',
  room_preview_size: 'الحجم',
  room_preview_flip: 'تبديل الكاميرا',
  room_preview_snap: 'التقاط صورة',
  room_preview_done: 'تم',
  room_preview_note: 'تجربة AR: شاهد كيف يبدو التلفاز على الجدار.',
  room_preview_cam_err: 'تعذر فتح الكاميرا. امنح الإذن في المتصفح.',
  room_preview_saved: 'تم حفظ الصورة',
  p360_title: 'عرض المنتج 360°',
  p360_hint: 'اسحب للتدوير',
  p360_auto: 'تلقائي',
  p360_reset: 'إعادة',
  p360_exit: 'إغلاق',
  smart_bundle: 'حزمة ذكية — اشترِ معاً',
  warehouse: 'المستودعات',
  qr_code: 'رمز QR',
  wheel_title: 'عجلة الخصم',
  wheel_text: 'أهلاً بك! أدر العجلة — اربح خصماً أو توصيلاً مجانياً.',
  wheel_spin: 'أدر',
  free_ship: 'توصيل مجاني',
  free_ship_desc: 'للطلبات فوق 100 ₼',
  warranty: 'الضمان',
  warranty_desc: 'ضمان رسمي لجميع المنتجات',
  warranty_center: 'مركز الضمان',
  warranty_days_left: 'متبقي {n} يوماً',
  warranty_pdf: 'ضمان PDF',
  returns: 'إرجاع خلال 14 يوماً',
  returns_desc: 'إرجاع بدون متاعب',
  installments: 'تقسيط',
  installments_desc: 'تقسيط حتى 12 شهراً',
  catalog: 'الكتالوج',
  products_count: 'منتج',
  all_products: 'كل المنتجات',
  results_count: 'نتيجة',
  cat_empty: 'لا منتجات في هذه الفئة',
  order_created: 'تم إنشاء الطلب',
  sort_popular: 'الأشهر',
  sort_price_asc: 'من الأرخص للأغلى',
  sort_price_desc: 'من الأغلى للأرخص',
  sort_new: 'الأحدث',
  filter_all: 'الكل',
  filter_new: 'جديد',
  filter_sale: 'تخفيض',
  checkout_title: 'الطلب',
  pay: 'الدفع',
  name: 'الاسم',
  email: 'البريد الإلكتروني',
  phone: 'الهاتف',
  address: 'العنوان',
  city: 'المدينة',
  note: 'ملاحظة',
  place_order: 'تأكيد الطلب',
  back: 'رجوع',
  details: 'التفاصيل',
  share: 'مشاركة',
  share_cart: 'شارك السلة',
  share_cart_desc: 'أرسل الرابط لصديقك — سيرى نفس المنتجات بنقرة.',
  share_cart_text: 'شاهد سلة NEXORA الخاصة بي:',
  share_cart_copied: 'تم نسخ رابط السلة',
  share_cart_fail: 'فشلت المشاركة',
  share_cart_wa: 'إرسال عبر واتساب',
  share_cart_received: 'سلة مشتركة',
  share_cart_products: 'منتج',
  share_cart_hint: 'أضف منتجات هذا الرابط إلى سلتك أو استبدلها.',
  share_cart_missing: 'منتج غير موجود',
  share_cart_replace: 'استبدال السلة',
  share_cart_merge: 'إضافة إلى السلة الحالية',
  share_cart_imported: 'تم تحميل السلة المشتركة',
  share_cart_merged: 'أضيفت المنتجات إلى السلة',
  share_cart_invalid: 'رابط المشاركة غير صالح',
  share_cart_empty_result: 'لم تُعثر على منتجات الرابط',
  copy_link: 'نسخ الرابط',
  menu: 'القائمة',
  order_summary: 'ملخص الطلب',
  discount: 'الخصم',
  vat: 'ضريبة القيمة المضافة (18%)',
  free_ship_from: 'توصيل مجاني فوق',
  item_removed: 'تمت إزالة المنتج',
  reset: 'إعادة تعيين',
  stock_only: 'المتوفّر فقط',
  category: 'الفئة',
  filter_sort: 'فلتر / ترتيب',
  cat_electronics: 'إلكترونيات',
  cat_fashion: 'أزياء',
  cat_home: 'المنزل والحديقة',
  cat_sports: 'رياضة',
  cat_kids: 'أطفال',
  cat_beauty: 'جمال',
  cat_auto: 'سيارات',
  cat_books: 'كتب وهوايات',
  // extras
  currency: 'العملة',
  password: 'كلمة المرور',
  full_name: 'الاسم الكامل',
  referral_code: 'رمز الصديق (اختياري)',
  password_hint: 'كلمة المرور (8 أحرف على الأقل)',
  welcome: 'أهلاً بك',
  overview: 'نظرة عامة',
  district: 'المنطقة',
  postal: 'الرمز البريدي',
  payment_method: 'طريقة الدفع',
  customer_info: 'بيانات العميل',
  send: 'إرسال',
  message: 'الرسالة',
  subject: 'الموضوع',
  nav_main: 'التنقل الرئيسي',
  nav_mobile: 'التنقل للجوال'
};

const missing = Object.keys(enPairs).filter((k) => !arMap[k]);
if (missing.length) {
  console.warn('Missing AR translations, falling back to EN:', missing.join(', '));
}

function esc(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

const lines = Object.keys(enPairs).map(function (k) {
  const val = arMap[k] != null ? arMap[k] : enPairs[k];
  return "      " + k + ": '" + esc(val) + "'";
});

const arBlock = "    ar: {\n" + lines.join(",\n") + "\n    }\n";

if (/\n    ar: \{/.test(src)) {
  src = src.replace(/\n    ar: \{[\s\S]*?\n    \}\n/, "\n" + arBlock);
} else {
  src = src.replace(/\n    \}\n  \};/, "\n    },\n" + arBlock + "  };");
}

// Extra keys into az/ru/en if missing
const extras = {
  az: {
    currency: 'Valyuta',
    password: 'Şifrə',
    full_name: 'Ad Soyad',
    referral_code: 'Dost kodu (istəyə bağlı)',
    password_hint: 'Şifrə (min. 8 simvol)',
    welcome: 'Xoş gəldiniz',
    overview: 'İcmal',
    district: 'Rayon',
    postal: 'Poçt indeksi',
    payment_method: 'Ödəniş üsulu',
    customer_info: 'Müştəri məlumatları',
    send: 'Göndər',
    message: 'Mesaj',
    subject: 'Mövzu',
    nav_main: 'Əsas naviqasiya',
    nav_mobile: 'Mobil naviqasiya'
  },
  ru: {
    currency: 'Валюта',
    password: 'Пароль',
    full_name: 'Имя и фамилия',
    referral_code: 'Код друга (необязательно)',
    password_hint: 'Пароль (мин. 8 символов)',
    welcome: 'Добро пожаловать',
    overview: 'Обзор',
    district: 'Район',
    postal: 'Индекс',
    payment_method: 'Способ оплаты',
    customer_info: 'Данные покупателя',
    send: 'Отправить',
    message: 'Сообщение',
    subject: 'Тема',
    nav_main: 'Основная навигация',
    nav_mobile: 'Мобильная навигация'
  },
  en: {
    currency: 'Currency',
    password: 'Password',
    full_name: 'Full name',
    referral_code: 'Friend code (optional)',
    password_hint: 'Password (min. 8 characters)',
    welcome: 'Welcome',
    overview: 'Overview',
    district: 'District',
    postal: 'Postal code',
    payment_method: 'Payment method',
    customer_info: 'Customer details',
    send: 'Send',
    message: 'Message',
    subject: 'Subject',
    nav_main: 'Main navigation',
    nav_mobile: 'Mobile navigation'
  }
};

['az', 'ru', 'en'].forEach(function (lang) {
  const re = new RegExp('(' + lang + ': \\{[\\s\\S]*?)(\\n    \\},\\n    (?:ru|en|ar):|\\n    \\}\\n  \\};)');
  src = src.replace(re, function (full, body, tail) {
    let next = body;
    Object.keys(extras[lang]).forEach(function (k) {
      if (new RegExp('\\b' + k + '\\s*:').test(next)) return;
      next += ",\n      " + k + ": '" + esc(extras[lang][k]) + "'";
    });
    return next + tail;
  });
});

// Update header comment + setLang/boot for RTL
src = src.replace(
  ' * NEXORA i18n — AZ / RU / EN (UI chrome + page strings)',
  ' * NEXORA i18n — AZ / RU / EN / AR (full storefront UI)'
);

src = src.replace(
  /function setLang\(lang\) \{[\s\S]*?\n  \}/,
  `function setLang(lang) {
    if (!dict[lang]) lang = 'az';
    localStorage.setItem(KEY, lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    apply(document);
    window.dispatchEvent(new CustomEvent('nexora:lang-change', { detail: { lang: lang } }));
    // Full clean re-render of JS-built chrome / grids
    try { location.reload(); } catch (e) { /* ignore */ }
  }`
);

src = src.replace(
  /function boot\(\) \{[\s\S]*?\n  \}/,
  `function boot() {
    const lang = getLang();
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    function run() { apply(document); }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run);
    } else {
      run();
    }
    document.addEventListener('nexora:shell-ready', run);
    window.addEventListener('load', function () { setTimeout(run, 0); });
  }`
);

if (!/langs:/.test(src)) {
  src = src.replace(
    'return {\n    getLang: getLang,\n    setLang: setLang,',
    "return {\n    langs: ['az', 'ru', 'en', 'ar'],\n    getLang: getLang,\n    setLang: setLang,"
  );
}

fs.writeFileSync(i18nPath, src);
console.log('Updated i18n.js with AR + extras. EN keys:', Object.keys(enPairs).length);
