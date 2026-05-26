// ============================================
// Конфігурація застосунку
// ============================================
const JWT_SECRET = process.env.JWT_SECRET || 'igclub-dev-secret-change-in-prod';
const PORT       = process.env.PORT || 3000;

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    console.error('❌  JWT_SECRET не задано в production! Встановіть змінну середовища JWT_SECRET.');
    process.exit(1);
}

module.exports = { JWT_SECRET, PORT };
