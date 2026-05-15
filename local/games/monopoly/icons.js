// ============================================
// МОНОПОЛІЯ УКРАЇНИ — icons.js
// Плоскі векторні іконки для клітинок (заміна емодзі)
// Дизайн: жирні форми, 1-2 кольори, легкий контур, працює на дрібних розмірах
// ============================================

const ICON_SVG = {
    // ➡️ СТАРТ — оранжева стрілка вправо
    '➡️': `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="32" height="32" rx="6" fill="#ff8c00"/>
        <path d="M5 13 L18 13 L18 8 L27 16 L18 24 L18 19 L5 19 Z" fill="white"/>
    </svg>`,

    // 🔒 В'ЯЗНИЦЯ (у гостях) — чорний замок на жовтому
    '🔒': `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="32" height="32" rx="6" fill="#ffd60a"/>
        <path d="M11 14 V11 a5 5 0 0 1 10 0 V14" stroke="#1a1a1a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <rect x="6" y="14" width="20" height="14" rx="2.5" fill="#1a1a1a"/>
        <circle cx="16" cy="20" r="2.2" fill="#ffd60a"/>
        <rect x="14.8" y="20" width="2.4" height="5" fill="#ffd60a"/>
    </svg>`,

    // 🅿️ БЕЗКОШТОВНА СТОЯНКА — синя літера P
    '🅿️': `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="32" height="32" rx="6" fill="#1976d2"/>
        <text x="16" y="25" font-size="24" fill="white" text-anchor="middle" font-weight="900" font-family="Inter, Arial, sans-serif">P</text>
    </svg>`,

    // 👮 ІТИ ДО В'ЯЗНИЦІ — поліцейський
    '👮': `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="32" height="32" rx="6" fill="#0d47a1"/>
        <path d="M5 16 L27 16 L27 14 L5 14 Z" fill="#ffd60a"/>
        <rect x="10" y="6" width="12" height="9" rx="1" fill="#1a1a1a"/>
        <circle cx="16" cy="11" r="1.6" fill="#ffd60a"/>
        <circle cx="16" cy="22" r="5" fill="#ffd6b5"/>
        <path d="M11 27 Q16 24 21 27 L21 30 L11 30 Z" fill="#0d47a1"/>
    </svg>`,

    // 🚂 ЗАЛІЗНИЦЯ — паровоз спереду
    '🚂': `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="32" height="32" rx="6" fill="#c62828"/>
        <rect x="20" y="6" width="6" height="6" fill="#1a1a1a"/>
        <circle cx="23" cy="6" r="2" fill="#9e9e9e"/>
        <rect x="4" y="11" width="22" height="13" rx="2" fill="#1a1a1a"/>
        <rect x="6" y="13" width="9" height="5" rx="0.5" fill="#fff8e1"/>
        <rect x="17" y="13" width="7" height="5" rx="0.5" fill="#fff8e1"/>
        <circle cx="10" cy="26" r="3.2" fill="#212121" stroke="#fff" stroke-width="0.8"/>
        <circle cx="20" cy="26" r="3.2" fill="#212121" stroke="#fff" stroke-width="0.8"/>
    </svg>`,

    // ✈️ АЕРОПОРТ — літак
    '✈️': `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="32" height="32" rx="6" fill="#01579b"/>
        <path d="M16 4 L18 14 L29 19 L29 23 L18 21 L17 27 L19 28 L19 30 L13 30 L13 28 L15 27 L14 21 L3 23 L3 19 L14 14 Z" fill="white"/>
    </svg>`,

    // ⚓ ПОРТ — якір
    '⚓': `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="32" height="32" rx="6" fill="#0277bd"/>
        <circle cx="16" cy="7" r="3" stroke="white" stroke-width="2.5" fill="none"/>
        <line x1="16" y1="10" x2="16" y2="27" stroke="white" stroke-width="3" stroke-linecap="round"/>
        <line x1="10" y1="14" x2="22" y2="14" stroke="white" stroke-width="3" stroke-linecap="round"/>
        <path d="M5 22 Q5 28 16 28 Q27 28 27 22" stroke="white" stroke-width="3" fill="none" stroke-linecap="round"/>
    </svg>`,

    // ❓ ШАНС — питання на рожевому
    '❓': `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="32" height="32" rx="6" fill="#e91e63"/>
        <text x="16" y="24" font-size="22" fill="white" text-anchor="middle" font-weight="900" font-family="Inter, Arial, sans-serif">?</text>
    </svg>`,

    // 🗺️ ЕКСКУРСІЯ — мапа
    '🗺️': `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="32" height="32" rx="6" fill="#43a047"/>
        <path d="M3 8 L12 6 L20 8 L29 6 V24 L20 26 L12 24 L3 26 Z" fill="#fff8e1" stroke="#1b5e20" stroke-width="0.8"/>
        <line x1="12" y1="6" x2="12" y2="24" stroke="#1b5e20" stroke-width="0.8" stroke-dasharray="2 1"/>
        <line x1="20" y1="8" x2="20" y2="26" stroke="#1b5e20" stroke-width="0.8" stroke-dasharray="2 1"/>
        <circle cx="8" cy="14" r="1.6" fill="#c62828"/>
        <circle cx="22" cy="18" r="1.6" fill="#c62828"/>
    </svg>`,

    // 💰 ПОДАТКИ — мішок з грошима
    '💰': `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="32" height="32" rx="6" fill="#fff8e1"/>
        <path d="M10 8 Q10 5 13 5 L19 5 Q22 5 22 8 L20 11 L12 11 Z" fill="#6d4c1c"/>
        <ellipse cx="16" cy="20" rx="11" ry="9" fill="#a98a4d"/>
        <ellipse cx="16" cy="20" rx="11" ry="9" fill="none" stroke="#6d4c1c" stroke-width="1.2"/>
        <text x="16" y="24" font-size="11" fill="white" text-anchor="middle" font-weight="900" font-family="Inter, Arial, sans-serif">₴</text>
    </svg>`,

    // 💎 РОЗКІШНИЙ ПОДАТОК — діамант
    '💎': `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="32" height="32" rx="6" fill="#0288d1"/>
        <path d="M8 8 H24 L28 14 L16 28 L4 14 Z" fill="#b3e5fc" stroke="white" stroke-width="1.5"/>
        <line x1="4" y1="14" x2="28" y2="14" stroke="white" stroke-width="1.5"/>
        <line x1="11" y1="8" x2="16" y2="14" stroke="white" stroke-width="1.2"/>
        <line x1="21" y1="8" x2="16" y2="14" stroke="white" stroke-width="1.2"/>
        <line x1="16" y1="14" x2="16" y2="28" stroke="white" stroke-width="1.2"/>
    </svg>`
};

// ============================================
// ТЕМАТИЧНІ ІКОНКИ ПО ПОЗИЦІЯХ ДІЛЯНОК
// Унікальний силует для кожної з 22 ділянок (відома будівля, пам'ятник, символ)
// Палітра: фон = колір ділянки, силует = білий або темно-коричневий (для жовтих)
// ============================================
const PROPERTY_ICONS = {
    // ======= ПОЛТАВА (коричневий) =======
    // 1: Сумська — Біла альтанка (ротонда з куполом і колонами)
    1: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="6" fill="#8B4513"/>
        <path d="M9 14 Q16 5 23 14 Z" fill="white"/>
        <rect x="10" y="14" width="2" height="11" fill="white"/>
        <rect x="14" y="14" width="2" height="11" fill="white"/>
        <rect x="18" y="14" width="2" height="11" fill="white"/>
        <rect x="22" y="14" width="2" height="11" fill="white"/>
        <rect x="7" y="25" width="18" height="2.5" fill="white"/>
    </svg>`,
    // 3: Полтавська — Стовп Слави (колона з орлом)
    3: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="6" fill="#8B4513"/>
        <path d="M14 8 L18 8 L17 26 L15 26 Z" fill="white"/>
        <circle cx="16" cy="6" r="2.5" fill="white"/>
        <rect x="11" y="26" width="10" height="2.5" fill="white"/>
        <rect x="9" y="28.5" width="14" height="1.5" fill="white"/>
    </svg>`,

    // ======= ЗАПОРІЖЖЯ на місці Львова (жовтий) =======
    // 6: Хортиця — козак
    6: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="6" fill="#FFD700"/>
        <path d="M10 9 Q16 4 22 9 L21 12 L11 12 Z" fill="#5a3e1c"/>
        <circle cx="16" cy="15" r="3.5" fill="#5a3e1c"/>
        <path d="M12 16 Q14 18 11.5 19 M20 16 Q18 18 20.5 19" stroke="#FFD700" stroke-width="1.2" fill="none"/>
        <path d="M9 28 L11 19 L21 19 L23 28 Z" fill="#5a3e1c"/>
        <path d="M14 19 L18 19 L17 22 L15 22 Z" fill="#FFD700"/>
    </svg>`,
    // 8: Дніпрогес — гребля з арками
    8: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="6" fill="#FFD700"/>
        <rect x="2" y="6" width="28" height="4" fill="#5a3e1c"/>
        <rect x="2" y="10" width="28" height="14" fill="#5a3e1c"/>
        <path d="M5 24 Q8 18 11 24 Z" fill="#FFD700"/>
        <path d="M13 24 Q16 18 19 24 Z" fill="#FFD700"/>
        <path d="M21 24 Q24 18 27 24 Z" fill="#FFD700"/>
        <path d="M2 26 Q6 28 10 26 Q14 24 18 26 Q22 28 26 26 Q30 24 30 26 V30 H2 Z" fill="#5a3e1c"/>
    </svg>`,
    // 9: Соборний пр. — монумент / стела
    9: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="6" fill="#FFD700"/>
        <path d="M14 6 L18 6 L17.5 24 L14.5 24 Z" fill="#5a3e1c"/>
        <path d="M16 4 L13 7 L19 7 Z" fill="#5a3e1c"/>
        <rect x="11" y="24" width="10" height="2" fill="#5a3e1c"/>
        <rect x="9" y="26" width="14" height="2" fill="#5a3e1c"/>
        <rect x="6" y="28" width="20" height="2" fill="#5a3e1c"/>
    </svg>`,

    // ======= ОДЕСА (рожевий) =======
    // 11: Дерибасівська — Одеська опера (фасад з колонами і фронтоном)
    11: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="6" fill="#FF69B4"/>
        <path d="M3 14 L16 6 L29 14 Z" fill="white"/>
        <rect x="4" y="14" width="24" height="2" fill="white"/>
        <rect x="6" y="16" width="2" height="10" fill="white"/>
        <rect x="11" y="16" width="2" height="10" fill="white"/>
        <rect x="15" y="16" width="2" height="10" fill="white"/>
        <rect x="19" y="16" width="2" height="10" fill="white"/>
        <rect x="24" y="16" width="2" height="10" fill="white"/>
        <rect x="4" y="26" width="24" height="2" fill="white"/>
    </svg>`,
    // 13: Молдованка — арка двору (вхідна арка з молдованських двориків)
    13: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="6" fill="#FF69B4"/>
        <path d="M5 28 V14 a11 11 0 0 1 22 0 V28 Z" fill="white"/>
        <path d="M11 28 V18 a5 5 0 0 1 10 0 V28 Z" fill="#FF69B4"/>
        <rect x="14" y="6" width="4" height="2" fill="#FF69B4"/>
    </svg>`,
    // 14: Аркадія — пляжна пальма + море
    14: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="6" fill="#FF69B4"/>
        <path d="M14 13 L13 26 L15 26 L16 13 Z" fill="white"/>
        <path d="M16 13 Q22 11 26 14 Q22 12 18 13" fill="white"/>
        <path d="M16 13 Q10 11 6 14 Q10 12 14 13" fill="white"/>
        <path d="M16 13 Q19 7 24 6 Q20 8 17 13" fill="white"/>
        <path d="M16 13 Q13 7 8 6 Q12 8 15 13" fill="white"/>
        <circle cx="16" cy="13" r="1.2" fill="#FF69B4"/>
        <path d="M3 28 Q7 26 11 28 T19 28 T27 28 T31 28" stroke="white" stroke-width="1.5" fill="none"/>
    </svg>`,

    // ======= ХАРКІВ (помаранчевий) =======
    // 16: Сумська — Держпром (конструктивістські вежі зі скайвоками)
    16: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="6" fill="#FFA500"/>
        <rect x="3" y="14" width="6" height="14" fill="white"/>
        <rect x="10" y="10" width="4" height="18" fill="white"/>
        <rect x="15" y="6" width="3" height="22" fill="white"/>
        <rect x="19" y="10" width="4" height="18" fill="white"/>
        <rect x="24" y="14" width="5" height="14" fill="white"/>
        <rect x="9" y="13" width="6" height="1.5" fill="white"/>
        <rect x="18" y="13" width="6" height="1.5" fill="white"/>
    </svg>`,
    // 18: Пушкінська — пам'ятник Пушкіну (фігура на постаменті)
    18: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="6" fill="#FFA500"/>
        <rect x="10" y="22" width="12" height="6" fill="white"/>
        <rect x="8" y="28" width="16" height="1.5" fill="white"/>
        <circle cx="16" cy="9" r="2.5" fill="white"/>
        <path d="M13 12 L19 12 L20 22 L12 22 Z" fill="white"/>
        <path d="M19 14 L22 18 L21 19 L18 16 Z" fill="white"/>
    </svg>`,
    // 19: Дзеркальний струмінь (павільйон з фонтаном)
    19: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="6" fill="#FFA500"/>
        <path d="M6 14 Q16 4 26 14 Z" fill="white"/>
        <rect x="6" y="13.5" width="3" height="11" fill="white"/>
        <rect x="11" y="13.5" width="3" height="11" fill="white"/>
        <rect x="18" y="13.5" width="3" height="11" fill="white"/>
        <rect x="23" y="13.5" width="3" height="11" fill="white"/>
        <path d="M16 14 Q14 18 16 22 Q18 26 16 28" stroke="white" stroke-width="1.5" fill="none"/>
        <ellipse cx="16" cy="28" rx="6" ry="1.5" fill="white"/>
    </svg>`,

    // ======= ДНІПРО (червоний) =======
    // 21: Соборна площа — Спасо-Преображенський собор (купол з хрестом)
    21: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="6" fill="#FF0000"/>
        <line x1="16" y1="2" x2="16" y2="6" stroke="white" stroke-width="1.5"/>
        <line x1="14" y1="3.5" x2="18" y2="3.5" stroke="white" stroke-width="1"/>
        <path d="M11 14 Q16 5 21 14 Z" fill="white"/>
        <rect x="6" y="14" width="20" height="14" fill="white"/>
        <rect x="14" y="20" width="4" height="8" fill="#FF0000"/>
        <rect x="8" y="17" width="3" height="4" rx="1.5" fill="#FF0000"/>
        <rect x="21" y="17" width="3" height="4" rx="1.5" fill="#FF0000"/>
    </svg>`,
    // 23: Січеславська — старовинний фасад
    23: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="6" fill="#FF0000"/>
        <path d="M5 12 L16 5 L27 12 Z" fill="white"/>
        <rect x="5" y="12" width="22" height="14" fill="white"/>
        <rect x="5" y="26" width="22" height="2" fill="white"/>
        <rect x="8" y="14" width="2" height="10" fill="#FF0000"/>
        <rect x="12" y="14" width="2" height="10" fill="#FF0000"/>
        <rect x="18" y="14" width="2" height="10" fill="#FF0000"/>
        <rect x="22" y="14" width="2" height="10" fill="#FF0000"/>
    </svg>`,
    // 24: Набережна — арковий міст через Дніпро
    24: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="6" fill="#FF0000"/>
        <path d="M2 22 Q16 6 30 22" stroke="white" stroke-width="2.5" fill="none"/>
        <rect x="2" y="22" width="28" height="2" fill="white"/>
        <line x1="9" y1="14" x2="9" y2="22" stroke="white" stroke-width="1.2"/>
        <line x1="16" y1="10" x2="16" y2="22" stroke="white" stroke-width="1.2"/>
        <line x1="23" y1="14" x2="23" y2="22" stroke="white" stroke-width="1.2"/>
        <path d="M2 27 Q7 25 12 27 T22 27 T30 27" stroke="white" stroke-width="1" fill="none"/>
        <path d="M2 30 Q7 28 12 30 T22 30 T30 30" stroke="white" stroke-width="1" fill="none"/>
    </svg>`,

    // ======= ЛЬВІВ на місці Запоріжжя (блакитний) =======
    // 26: Площа Ринок — Львівська ратуша
    26: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="6" fill="#87CEEB"/>
        <path d="M14 4 L18 4 L20 7 L12 7 Z" fill="white"/>
        <rect x="13" y="7" width="6" height="20" fill="white"/>
        <rect x="9" y="22" width="14" height="6" fill="white"/>
        <circle cx="16" cy="12" r="2" fill="#87CEEB"/>
        <line x1="16" y1="12" x2="16" y2="10.5" stroke="white" stroke-width="0.7"/>
        <line x1="16" y1="12" x2="17.5" y2="12" stroke="white" stroke-width="0.7"/>
    </svg>`,
    // 27: Личаківська — Хрест на Личаківському цвинтарі
    27: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="6" fill="#87CEEB"/>
        <rect x="14" y="6" width="4" height="20" fill="white"/>
        <rect x="10" y="11" width="12" height="3" fill="white"/>
        <rect x="6" y="26" width="20" height="3" fill="white"/>
        <circle cx="16" cy="9" r="1.5" fill="#87CEEB"/>
    </svg>`,
    // 29: Сихівська — типовий житловий масив
    29: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="6" fill="#87CEEB"/>
        <rect x="6" y="5" width="20" height="23" fill="white"/>
        <g fill="#87CEEB">
            <rect x="9" y="8" width="3" height="3"/><rect x="14.5" y="8" width="3" height="3"/><rect x="20" y="8" width="3" height="3"/>
            <rect x="9" y="14" width="3" height="3"/><rect x="14.5" y="14" width="3" height="3"/><rect x="20" y="14" width="3" height="3"/>
            <rect x="9" y="20" width="3" height="3"/><rect x="14.5" y="20" width="3" height="3"/><rect x="20" y="20" width="3" height="3"/>
        </g>
    </svg>`,

    // ======= КИЇВ (зелений) =======
    // 31: Андріївський узвіз — Андріївська церква (5 куполів-цибулин)
    31: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="6" fill="#008000"/>
        <line x1="16" y1="2" x2="16" y2="6" stroke="white" stroke-width="1.2"/>
        <line x1="14.5" y1="3.5" x2="17.5" y2="3.5" stroke="white" stroke-width="0.8"/>
        <path d="M12 14 Q16 5 20 14 Z" fill="white"/>
        <path d="M5 16 Q7 10 9 16 Z" fill="white"/>
        <path d="M23 16 Q25 10 27 16 Z" fill="white"/>
        <rect x="5" y="16" width="22" height="12" fill="white"/>
        <rect x="14" y="22" width="4" height="6" fill="#008000"/>
    </svg>`,
    // 32: Поділ — дзвіниця з шпилем
    32: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="6" fill="#008000"/>
        <line x1="16" y1="2" x2="16" y2="5" stroke="white" stroke-width="1.2"/>
        <path d="M14 5 L18 5 L16 1 Z" fill="white"/>
        <path d="M11 14 L21 14 L19 8 L13 8 Z" fill="white"/>
        <rect x="13" y="14" width="6" height="14" fill="white"/>
        <rect x="14" y="18" width="4" height="5" fill="#008000"/>
        <rect x="9" y="26" width="14" height="2.5" fill="white"/>
    </svg>`,
    // 34: Печерськ — Києво-Печерська Лавра (великий храм з трьома куполами)
    34: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="6" fill="#008000"/>
        <line x1="16" y1="2" x2="16" y2="5" stroke="white" stroke-width="1.2"/>
        <path d="M11 13 Q16 4 21 13 Z" fill="white"/>
        <path d="M3 16 Q6 11 9 16 Z" fill="white"/>
        <path d="M23 16 Q26 11 29 16 Z" fill="white"/>
        <rect x="3" y="16" width="26" height="12" fill="white"/>
        <rect x="14" y="20" width="4" height="8" fill="#008000"/>
        <rect x="6" y="19" width="3" height="4" fill="#008000"/>
        <rect x="23" y="19" width="3" height="4" fill="#008000"/>
    </svg>`,

    // ======= КИЇВ преміум (темно-синій) =======
    // 37: Хрещатик — сталінська висотка з бічними крилами
    37: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="6" fill="#00008B"/>
        <rect x="13" y="2" width="6" height="6" fill="white"/>
        <rect x="11" y="8" width="10" height="6" fill="white"/>
        <rect x="4" y="14" width="24" height="14" fill="white"/>
        <g fill="#00008B">
            <rect x="6" y="16" width="2" height="2"/><rect x="10" y="16" width="2" height="2"/>
            <rect x="14" y="16" width="2" height="2"/><rect x="18" y="16" width="2" height="2"/>
            <rect x="22" y="16" width="2" height="2"/>
            <rect x="6" y="20" width="2" height="2"/><rect x="10" y="20" width="2" height="2"/>
            <rect x="14" y="20" width="2" height="2"/><rect x="18" y="20" width="2" height="2"/>
            <rect x="22" y="20" width="2" height="2"/>
            <rect x="6" y="24" width="2" height="2"/><rect x="10" y="24" width="2" height="2"/>
            <rect x="14" y="24" width="2" height="2"/><rect x="18" y="24" width="2" height="2"/>
            <rect x="22" y="24" width="2" height="2"/>
        </g>
    </svg>`,
    // 39: Майдан Незалежності — стела з фігурою Берегині нагорі
    39: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="6" fill="#00008B"/>
        <circle cx="16" cy="6" r="2" fill="white"/>
        <path d="M11 8 L21 8 L19 12 L13 12 Z" fill="white"/>
        <path d="M16 6 L13 2 L19 2 Z" fill="white"/>
        <rect x="14" y="12" width="4" height="14" fill="white"/>
        <rect x="11" y="26" width="10" height="2" fill="white"/>
        <rect x="9" y="28" width="14" height="2" fill="white"/>
    </svg>`
};

// Допоміжна функція рендеру іконки
// Перевага: іконка по позиції клітинки → загальний словник по емодзі → fallback
function renderIcon(emoji, size = 28, pos = null) {
    if (pos !== null && PROPERTY_ICONS[pos]) {
        return `<span class="game-icon" style="display:inline-block;width:${size}px;height:${size}px;line-height:0">${PROPERTY_ICONS[pos]}</span>`;
    }
    const svg = ICON_SVG[emoji];
    if (!svg) return `<span style="font-size:${size}px">${emoji}</span>`;
    return `<span class="game-icon" style="display:inline-block;width:${size}px;height:${size}px;line-height:0">${svg}</span>`;
}
