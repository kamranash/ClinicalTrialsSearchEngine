'use strict';

const express = require('express');
const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');

const app      = express();
const PORT     = process.env.PORT      || 3001;
const DATA_DIR = process.env.DATA_DIR  || '/data';
const MODELS_FILE = path.join(DATA_DIR, 'models.json');

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(express.json({ limit: '256kb' }));

// CORS for local dev (nginx handles this in production)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin',  '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── Storage helpers ───────────────────────────────────────────────────────────

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readModels() {
  try {
    return JSON.parse(fs.readFileSync(MODELS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeModels(models) {
  ensureDataDir();
  // Write to a temp file then rename (atomic on Linux/macOS)
  const tmp = MODELS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(models, null, 2), 'utf8');
  fs.renameSync(tmp, MODELS_FILE);
}

// ── Version tag helpers ───────────────────────────────────────────────────────

function nextAutoTag(models) {
  const tags = models.map(m => m.tag).filter(t => /^v\d+\.\d+$/.test(t));
  if (!tags.length) return 'v1.0';
  const nums = tags.map(t => {
    const [major, minor] = t.slice(1).split('.').map(Number);
    return major * 1000 + minor;
  });
  const max = Math.max(...nums);
  const major = Math.floor(max / 1000);
  const minor = max % 1000;
  return `v${major}.${minor + 1}`;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET  /api/models — list all saved model versions (newest first)
app.get('/api/models', (_req, res) => {
  res.json(readModels());
});

// GET  /api/models/:id — single model
app.get('/api/models/:id', (req, res) => {
  const model = readModels().find(m => m.id === req.params.id);
  if (!model) return res.status(404).json({ error: 'Not found' });
  res.json(model);
});

// POST /api/models — save a new version
app.post('/api/models', (req, res) => {
  const { tag, notes, config, metrics, datasetSize } = req.body ?? {};

  // Validate required fields
  if (!config || typeof config !== 'object') {
    return res.status(400).json({ error: '`config` is required' });
  }
  if (!metrics || typeof metrics !== 'object') {
    return res.status(400).json({ error: '`metrics` is required' });
  }

  const models = readModels();
  const resolvedTag = (typeof tag === 'string' && tag.trim()) ? tag.trim() : nextAutoTag(models);

  // Guard against duplicate tags
  if (models.some(m => m.tag === resolvedTag)) {
    return res.status(409).json({ error: `Tag "${resolvedTag}" already exists` });
  }

  const model = {
    id:          crypto.randomUUID(),
    tag:         resolvedTag,
    createdAt:   new Date().toISOString(),
    notes:       typeof notes === 'string' ? notes.slice(0, 500) : '',
    config,
    metrics,
    datasetSize: datasetSize ?? null,
  };

  models.unshift(model);
  writeModels(models);
  console.log(`[registry] saved ${model.tag} (${model.id})`);
  res.status(201).json(model);
});

// DELETE /api/models/:id — remove a version
app.delete('/api/models/:id', (req, res) => {
  const models = readModels();
  const idx = models.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const [removed] = models.splice(idx, 1);
  writeModels(models);
  console.log(`[registry] deleted ${removed.tag} (${removed.id})`);
  res.sendStatus(204);
});

// PATCH /api/models/:id — update notes only
app.patch('/api/models/:id', (req, res) => {
  const models = readModels();
  const model = models.find(m => m.id === req.params.id);
  if (!model) return res.status(404).json({ error: 'Not found' });
  if (typeof req.body.notes === 'string') model.notes = req.body.notes.slice(0, 500);
  writeModels(models);
  res.json(model);
});

// GET  /api/health — readiness probe
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', models: readModels().length });
});

// ── Start ─────────────────────────────────────────────────────────────────────

ensureDataDir();
app.listen(PORT, () => {
  console.log(`[registry] Model registry running on :${PORT}`);
  console.log(`[registry] Data directory: ${DATA_DIR}`);
});
