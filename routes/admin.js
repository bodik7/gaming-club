// ============================================
// Admin routes: /api/admin/*
// ============================================
const router = require('express').Router();
const db     = require('../db');
const { INITIAL_ADMIN } = require('../config');
const { requireAdmin }  = require('../middleware/auth');

module.exports = function adminRoutes(io, roomStore) {
    router.get('/users', requireAdmin, async (req, res) => {
        try { res.json(await db.getAllUsers()); }
        catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.delete('/users/:username', requireAdmin, async (req, res) => {
        const target = req.params.username;
        if (target.toLowerCase() === INITIAL_ADMIN)
            return res.status(403).json({ error: 'Неможливо видалити головного адміна' });
        try {
            await db.deleteUser(target);
            res.json({ ok: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.patch('/users/:username/admin', requireAdmin, async (req, res) => {
        try {
            await db.setAdmin(req.params.username, req.body.value);
            res.json({ ok: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.get('/rooms', requireAdmin, (req, res) => {
        const list = roomStore.all().map(r => ({
            code:         r.code,
            gameType:     r.gameType,
            players:      r.players?.length || 0,
            playerNames:  (r.players || []).map(p => p.name),
            started:      !!r.started,
            createdAt:    r.createdAt || null,
            lastActivity: r.lastActivityAt || null,
        }));
        res.json(list);
    });

    router.delete('/rooms/:code', requireAdmin, (req, res) => {
        const code = req.params.code.toUpperCase();
        const room = roomStore.get(code);
        if (!room) return res.status(404).json({ error: 'Кімнату не знайдено' });
        io.to(code).emit('roomClosed', { reason: 'Кімнату закрив адміністратор' });
        room.players.forEach(p => {
            const s = io.sockets.sockets.get(p.socketId);
            if (s) { s.leave(code); s.roomCode = null; s.playerIndex = null; }
        });
        roomStore.delete(code);
        res.json({ ok: true });
    });

    return router;
};
