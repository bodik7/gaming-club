// ============================================
// Public / user API routes
// ============================================
const router = require('express').Router();
const db     = require('../db');
const { requireAuth } = require('../middleware/auth');

module.exports = function apiRoutes(roomStore) {
    router.get('/rooms/count', (req, res) => {
        const counts = {};
        roomStore.all().forEach(r => {
            const t = r.gameType || 'monopoly';
            counts[t] = (counts[t] || 0) + 1;
        });
        res.json(counts);
    });

    router.get('/stats/:username', async (req, res) => {
        const stats = await db.getStats(req.params.username);
        res.json({ username: req.params.username, stats });
    });

    router.get('/leaderboard/:gameType', async (req, res) => {
        const rows = await db.getLeaderboard(req.params.gameType);
        res.json(rows);
    });

    router.get('/history', requireAuth, async (req, res) => {
        const history = await db.getHistory(req.authUser.username, 20);
        res.json(history);
    });

    return router;
};
