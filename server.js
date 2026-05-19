const express = require('express');
const path = require('path');
const multer = require('multer');
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const { fillDeedDocx } = require('./fill_docs');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

app.use((req, res, next) => { res.setTimeout(120000); next(); });
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Step 0: Dynamic path discovery (Cowork session paths change each session) ──
function getCoworkPaths() {
  try {
    const context = execSync('find /sessions -maxdepth 3 -name "Claude Context" -type d 2>/dev/null | head -1').toString().trim();
    const uploads = execSync('find /sessions -maxdepth 3 -name "uploads" -type d 2>/dev/null | head -1').toString().trim();
    const outputs = execSync('find /sessions -maxdepth 3 -name "outputs" -type d 2>/dev/null | head -1').toString().trim();
    const deedsDesktop = execSync('find /sessions -maxdepth 3 -name "Deeds" -not -path "*/Claude Context/*" -type d 2>/dev/null | head -1').toString().trim();

    // Prefer Cowork's Claude Context/Deeds; fall back to local template dir
    const localTemplates = fs.existsSync(path.join(__dirname, 'templates'))
      ? path.join(__dirname, 'templates')
      : path.join(__dirname, 'template');

    return {
      UPLOADS: uploads,
      OUTPUTS: outputs,
      DEEDS_DESKTOP: deedsDesktop || null,
      DEEDS_TEMPLATES: context ? path.join(context, 'Deeds') : localTemplates,
    };
  } catch (e) {
    const localTemplates = fs.existsSync(path.join(__dirname, 'templates'))
      ? path.join(__dirname, 'templates')
      : path.join(__dirname, 'template');
    return { UPLOADS: '', OUTPUTS: '', DEEDS_DESKTOP: null, DEEDS_TEMPLATES: localTemplates };
  }
}

function getLastName(grantor) {
  if (!grantor) return 'Deed';
  const suffixes = new Set(['jr.', 'sr.', 'ii', 'iii', 'iv', 'esq.']);
  const parts = grantor.trim().split(/\s+/);
  const names = parts.filter(p => !suffixes.has(p.toLowerCase().replace(',', '')));
  return (names[names.length - 1] || 'Deed').replace(/,/g, '').substring(0, 20);
}

function saveToCowork(paths, buf, lastName, filename) {
  if (paths.OUTPUTS) {
    try {
      const dir = path.join(paths.OUTPUTS, lastName);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, filename), buf);
    } catch (e) { /* non-fatal */ }
  }
  if (paths.DEEDS_DESKTOP) {
    try {
      const dir = path.join(paths.DEEDS_DESKTOP, lastName);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, filename), buf);
    } catch (e) { /* non-fatal */ }
  }
}

// ── Step 1: PDF → images at 200 DPI ──────────────────────────────────────────
app.post('/api/extract', upload.single('pdf'), (req, res) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deed-'));
  const paths = getCoworkPaths();
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const pdfPath = path.join(tmpDir, 'deed.pdf');
    fs.writeFileSync(pdfPath, req.file.buffer);

    if (paths.UPLOADS) {
      try { fs.writeFileSync(path.join(paths.UPLOADS, req.file.originalname || 'original_deed.pdf'), req.file.buffer); }
      catch (e) { /* non-fatal backup copy */ }
    }

    execSync(`pdftoppm -r 200 -jpeg "${pdfPath}" "${path.join(tmpDir, 'page')}"`, { timeout: 30000 });
    const images = fs.readdirSync(tmpDir)
      .filter(f => f.startsWith('page') && f.endsWith('.jpg'))
      .sort()
      .slice(0, 4)
      .map(f => fs.readFileSync(path.join(tmpDir, f)).toString('base64'));

    if (!images.length) return res.status(400).json({ error: 'Could not convert PDF to images' });
    res.json({ images });
  } catch (err) {
    console.error('EXTRACT ERROR:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (e) {}
  }
});

// ── Deed generation (Node.js / adm-zip — per skill Step 3–5) ─────────────────
async function runDeed(data, res) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deed-'));
  const paths = getCoworkPaths();
  try {
    const outPath = path.join(tmpDir, 'output.docx');
    const template = path.join(paths.DEEDS_TEMPLATES, 'deed-template.docx');
    if (!fs.existsSync(template)) throw new Error(`Deed template not found: ${template}`);

    fillDeedDocx(data, template, outPath);
    if (!fs.existsSync(outPath)) throw new Error('Deed output not created');

    const buf = fs.readFileSync(outPath);
    const lastName = getLastName(data.grantor);
    const filename = `${lastName} Deed.docx`;

    saveToCowork(paths, buf, lastName, filename);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buf);
  } catch (err) {
    console.error('DEED ERROR:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (e) {}
  }
}

// ── PDF form generation (Python / pikepdf — per skill Steps 7 & 10) ──────────
// IMPORTANT: Do NOT use pdf-lib for GIT/REP-3 or RTF-1 — use pikepdf directly
// via fill_pdfs.py to avoid pypdf/pdf-lib version incompatibility issues.
function runPdf(cmd, data, outputSuffix, res) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), cmd + '-'));
  const paths = getCoworkPaths();
  try {
    const outPath = path.join(tmpDir, 'output.pdf');
    const fillerScript = path.join(__dirname, 'fill_pdfs.py');

    if (!fs.existsSync(fillerScript)) throw new Error('fill_pdfs.py not found');

    const result = spawnSync('python3', [fillerScript, cmd, JSON.stringify(data), paths.DEEDS_TEMPLATES, outPath], {
      timeout: 60000, encoding: 'utf8'
    });

    if (result.status !== 0) {
      throw new Error((result.stderr || result.stdout || 'Python filler failed').trim());
    }
    if (!fs.existsSync(outPath)) throw new Error('PDF output not created');

    const buf = fs.readFileSync(outPath);
    const lastName = getLastName(data.grantor);
    const filename = `${lastName} - ${outputSuffix}.pdf`;

    saveToCowork(paths, buf, lastName, filename);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buf);
  } catch (err) {
    console.error(`PDF ERROR (${cmd}):`, err.message);
    res.status(500).json({ error: err.message });
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (e) {}
  }
}

app.post('/api/fill-deed',      async (req, res) => await runDeed(req.body, res));
app.post('/api/fill-affidavit', (req, res) => runPdf('affidavit', req.body, 'Aff of Consideration', res));
app.post('/api/fill-residency', (req, res) => runPdf('residency', req.body, "Seller's Residency", res));

// ── Claude API proxy (Step 2: deed data extraction) ───────────────────────────
app.post('/api/claude', async (req, res) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body),
      signal: controller.signal
    });
    clearTimeout(timeout);
    res.json(await response.json());
  } catch (err) {
    console.error('CLAUDE ERROR:', err.message);
    res.status(500).json({ error: { message: err.message } });
  }
});

const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, () => console.log(`Deed Processor running on port ${PORT}`));
server.timeout = 120000;
