// ============================================
// Auth routes: /api/register, /api/login, /api/me, /api/profile
// ============================================
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../db');
const { JWT_SECRET }                  = require('../config');
const { apiLimiter, requireAuth }     = require('../middleware/auth');

router.post('/register', apiLimiter(5, 10 * 60_000), async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password)
        return res.status(400).json({ error: 'Заповніть усі поля' });
    if (!/^[a-zA-Zа-яА-ЯіІїЇєЄ0-9_]{3,20}$/.test(username))
        return res.status(400).json({ error: 'Логін: 3–20 символів (літери, цифри, _)' });
    if (password.length < 6)
        return res.status(400).json({ error: 'Пароль: мінімум 6 символів' });
    if (await db.getUser(username))
        return res.status(409).json({ error: 'Цей логін вже зайнятий' });
    const hash = await bcrypt.hash(password, 10);
    try {
        await db.createUser(username, hash);
    } catch {
        return res.status(409).json({ error: 'Цей логін вже зайнятий' });
    }
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, username });
});

router.post('/login', apiLimiter(10, 10 * 60_000), async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password)
        return res.status(400).json({ error: 'Заповніть усі поля' });
    const user = await db.getUser(username);
    if (!user) return res.status(401).json({ error: 'Невірний логін або пароль' });
    const ok = await bcrypt.compare(password, user.hash);
    if (!ok) return res.status(401).json({ error: 'Невірний логін або пароль' });
    const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, username: user.username });
});

router.get('/me', requireAuth, async (req, res) => {
    try {
        let user = await db.getUser(req.authUser.username);
        if (!user) {
            const isAdmin = req.authUser.username.toLowerCase() === 'bodik' ? 1 : 0;
            await db.getClient().execute({
                sql:  `INSERT OR IGNORE INTO users (username, hash, is_admin) VALUES (?, '', ?)`,
                args: [req.authUser.username, isAdmin],
            });
            user = await db.getUser(req.authUser.username);
        }
        if (req.authUser.username.toLowerCase() === 'bodik' && Number(user?.is_admin) !== 1) {
            await db.getClient().execute({
                sql: `UPDATE users SET is_admin = 1 WHERE LOWER(username) = 'bodik'`,
                args: [],
            });
            if (user) user.is_admin = 1;
        }
        const stats = await db.getStats(req.authUser.username);
        res.json({
            username:    req.authUser.username,
            displayName: user?.display_name || null,
            avatarColor: user?.avatar_color || '#1a56db',
            avatarId:    user?.avatar_id    || null,
            isAdmin:     Number(user?.is_admin) === 1,
            stats,
        });
    } catch (e) {
        console.error('[/api/me]', e.message);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

router.patch('/profile', requireAuth, async (req, res) => {
    const { displayName, avatarColor, avatarId } = req.body;
    const dn    = typeof displayName === 'string'
        ? displayName.trim().slice(0, 20).replace(/[<>"']/g, '') : null;
    const color = /^#[0-9a-fA-F]{6}$/.test(avatarColor) ? avatarColor : null;
    const avId  = /^(char|zodiac)_\d{1,2}$/.test(avatarId) ? avatarId : null;
    try {
        await db.updateProfile(req.authUser.username, { displayName: dn || null, avatarColor: color, avatarId: avId });
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
