import { Router } from 'express';
import { db, newId, nowIso } from '../db.js';
import { authRequired, requirePerm, requireActive } from '../middleware/auth.js';
import { PERMISSIONS } from '../permissions.js';
import {
  listStandbyDays,
  createStandbyDay,
  deleteStandbyDay,
  getStandbyBanner,
} from '../services/standby.js';
import {
  importCsvRows,
  importIcsText,
  importFromUrl,
} from '../services/import.js';

const router = Router();

function serializeRig(row) {
  let recipe = null;
  try {
    recipe = row.recipe_json ? JSON.parse(row.recipe_json) : null;
  } catch {
    recipe = null;
  }
  return {
    id: row.id,
    name: row.name,
    teamName: row.team_name,
    venueType: row.venue_type,
    shootType: row.shoot_type,
    sport: recipe?.sport || null,
    recipe,
    active: !!row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function recipeFromBody(b = {}) {
  return {
    sport: b.sport || null,
    shootPlan: b.shootPlan || b.plan || null,
    remoteRigs: b.remoteRigs || [],
    dataEnabled: b.dataEnabled !== false,
    dataHd: b.dataHd || null,
    dataWideEnabled: b.dataWideEnabled !== false,
    dataWide: b.dataWide || null,
    fancamDayEnabled: !!b.fancamDayEnabled,
    fancamDayHd: b.fancamDayHd || null,
    fancamNightEnabled: !!b.fancamNightEnabled,
    fancamNightHd: b.fancamNightHd || null,
    attentionEnabled: !!b.attentionEnabled,
    attentionHd: b.attentionHd || null,
    soundEnabled: !!b.soundEnabled,
    notes: b.notes || null,
  };
}

/* ---------- Rigs ---------- */
router.get('/rigs', authRequired, requireActive, requirePerm(PERMISSIONS.RIG_VIEW), (_req, res) => {
  const rows = db
    .prepare(`SELECT * FROM rigs ORDER BY active DESC, team_name, name`)
    .all();
  res.json({ rigs: rows.map(serializeRig) });
});

router.get('/rigs/:id', authRequired, requireActive, requirePerm(PERMISSIONS.RIG_VIEW), (req, res) => {
  const row = db.prepare(`SELECT * FROM rigs WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Rig not found' });
  res.json(serializeRig(row));
});

router.post('/rigs', authRequired, requireActive, requirePerm(PERMISSIONS.RIG_MANAGE), (req, res) => {
  const b = req.body || {};
  if (!b.name && !b.teamName) {
    return res.status(400).json({ error: 'name or teamName required' });
  }
  const id = newId();
  const recipe = recipeFromBody(b);
  db.prepare(
    `
    INSERT INTO rigs (id, name, team_name, venue_type, shoot_type, recipe_json, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
  `
  ).run(
    id,
    b.name || `${b.teamName} House`,
    b.teamName || null,
    b.venueType || 'Outdoor',
    b.shootType || 'Data',
    JSON.stringify(recipe),
    nowIso(),
    nowIso()
  );
  res.status(201).json(serializeRig(db.prepare(`SELECT * FROM rigs WHERE id = ?`).get(id)));
});

router.put('/rigs/:id', authRequired, requireActive, requirePerm(PERMISSIONS.RIG_MANAGE), (req, res) => {
  const row = db.prepare(`SELECT * FROM rigs WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Rig not found' });
  const b = req.body || {};
  let existingRecipe = {};
  try {
    existingRecipe = row.recipe_json ? JSON.parse(row.recipe_json) : {};
  } catch {
    existingRecipe = {};
  }
  const recipe = { ...existingRecipe, ...recipeFromBody({ ...existingRecipe, ...b }) };
  db.prepare(
    `
    UPDATE rigs SET name=?, team_name=?, venue_type=?, shoot_type=?, recipe_json=?,
      active=?, updated_at=? WHERE id=?
  `
  ).run(
    b.name ?? row.name,
    b.teamName ?? row.team_name,
    b.venueType ?? row.venue_type,
    b.shootType ?? row.shoot_type,
    JSON.stringify(recipe),
    b.active === undefined ? row.active : b.active ? 1 : 0,
    nowIso(),
    row.id
  );
  res.json(serializeRig(db.prepare(`SELECT * FROM rigs WHERE id = ?`).get(row.id)));
});

router.delete('/rigs/:id', authRequired, requireActive, requirePerm(PERMISSIONS.RIG_MANAGE), (req, res) => {
  const row = db.prepare(`SELECT * FROM rigs WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Rig not found' });
  db.prepare(`UPDATE rigs SET active = 0, updated_at = ? WHERE id = ?`).run(nowIso(), row.id);
  res.json({ ok: true });
});

/* ---------- Standby ---------- */
router.get('/standby', authRequired, requireActive, requirePerm(PERMISSIONS.STANDBY_VIEW), (req, res) => {
  const list = listStandbyDays({ from: req.query.from, to: req.query.to });
  res.json({ standby: list, banner: getStandbyBanner() });
});

router.post('/standby', authRequired, requireActive, requirePerm(PERMISSIONS.STANDBY_MANAGE), (req, res) => {
  try {
    const b = req.body || {};
    if (!b.adminId || !b.startDate) {
      return res.status(400).json({ error: 'adminId and startDate required' });
    }
    const entry = createStandbyDay({
      adminId: b.adminId,
      startDate: b.startDate,
      startTime: b.startTime || '08:00',
      endDate: b.endDate || b.startDate,
      endTime: b.endTime || '23:59',
      notes: b.notes || null,
      createdBy: req.user.id,
    });
    res.status(201).json(entry);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.delete('/standby/:id', authRequired, requireActive, requirePerm(PERMISSIONS.STANDBY_MANAGE), (req, res) => {
  try {
    res.json(deleteStandbyDay(req.params.id));
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

/* ---------- Import helpers (ICS / Google URL) ---------- */
router.post('/shoots/import/ics', authRequired, requireActive, requirePerm(PERMISSIONS.SHOOT_IMPORT), (req, res) => {
  try {
    const text = req.body?.ics || req.body?.text;
    if (!text) return res.status(400).json({ error: 'ics text required' });
    const result = importIcsText(text, { createdBy: req.user.id });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.post('/shoots/import/url', authRequired, requireActive, requirePerm(PERMISSIONS.SHOOT_IMPORT), async (req, res) => {
  try {
    const url = req.body?.url;
    if (!url) return res.status(400).json({ error: 'url required' });
    const result = await importFromUrl(url, { createdBy: req.user.id });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

export { importCsvRows };
export default router;
