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

const LOCAL_TEMPLATES = path.join(__dirname, 'templates');

function getCoworkPaths() {
  try {
    const outputs = execSync('find /sessions -maxdepth 3 -name "outputs" -type d 2>/dev/null | head -1', { timeout: 3000 }).toString().trim();
    const deedsDesktop = execSync('find /sessions -maxdepth 3 -name "Deeds" -not -path "*/Claude Context/*" -type d 2>/dev/null | head -1', { timeout: 3000 }).toString().trim();
    return { OUTPUTS: outputs, DEEDS_DESKTOP: deedsDesktop || null };
  } catch (e) {
    return { OUTPUTS: '', DEEDS_DESKTOP: null };
  }
}

function getLastName(grantor) {
  if (!grantor) return 'Deed';
  const suffixes = new Set(['jr.', 'sr.', 'ii', 'iii', 'iv', 'esq.']);
  const parts = grantor.trim().split(/\s+/);
  const names = parts.filter(function(p) { return !suffixes.has(p.toLowerCase().replace(',', '')); });
  return (names[names.length - 1] || 'Deed').replace(/,/g, '').substring(0, 20);
}

function saveToCowork(paths, buf, lastName, filename) {
  if (paths.OUTPUTS) {
    try { var dir = path.join(paths.OUTPUTS, lastName); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, filename), buf); } catch (e) {}
  }
  if (paths.DEEDS_DESKTOP) {
    try { var dir2 = path.join(paths.DEEDS_DESKTOP, lastName); fs.mkdirSync(dir2, { recursive: true }); fs.writeFileSync(path.join(dir2, filename), buf); } catch (e) {}
  }
}

app.get('/api/debug-template', function(req, res) {
  try {
    var templatePath = path.join(LOCAL_TEMPLATES, 'deed-template.docx');
    var AdmZip = require('adm-zip');
    var zip = new AdmZip(templatePath);
    var xml = zip.readAsText('word/document.xml');
    var text = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').substring(0, 600);
    res.json({ templatePath: templatePath, preview: text, exists: fs.existsSync(templatePath) });
  } catch(e) {
    res.json({ error: e.message });
  }
});

app.post('/api/extract', upload.single('pdf'), function(req, res) {
  var tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deed-'));
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    var pdfPath = path.join(tmpDir, 'deed.pdf');
    fs.writeFileSync(pdfPath, req.file.buffer);
    execSync('pdftoppm -r 200 -jpeg "' + pdfPath + '" "' + path.join(tmpDir, 'page') + '"', { timeout: 30000 });
    var images = fs.readdirSync(tmpDir)
      .filter(function(f) { return f.startsWith('page') && f.endsWith('.jpg'); })
      .sort().slice(0, 4)
      .map(function(f) { return fs.readFileSync(path.join(tmpDir, f)).toString('base64'); });
    if (!images.length) return res.status(400).json({ error: 'Could not convert PDF to images' });
    res.json({ images: images });
  } catch (err) {
    console.error('EXTRACT ERROR:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (e) {}
  }
});

function runDeed(data, res) {
  var tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deed-'));
  var paths = getCoworkPaths();
  try {
    var outPath = path.join(tmpDir, 'output.docx');
    var template = path.join(LOCAL_TEMPLATES, 'deed-template.docx');
    if (!fs.existsSync(template)) throw new Error('Deed template not found: ' + template);
    fillDeedDocx(data, template, outPath);
    if (!fs.existsSync(outPath)) throw new Error('Deed output not created');
    var buf = fs.readFileSync(outPath);
    var lastName = getLastName(data.grantor);
    var filename = lastName + ' Deed.docx';
    saveToCowork(paths, buf, lastName, filename);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.send(buf);
  } catch (err) {
    console.error('DEED ERROR:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (e) {}
  }
}

function runPdf(cmd, data, outputSuffix, res) {
  var tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), cmd + '-'));
  var paths = getCoworkPaths();
  try {
    var outPath = path.join(tmpDir, 'output.pdf');
    var fillerScript = path.join(__dirname, 'fill_pdfs.py');
    if (!fs.existsSync(fillerScript)) throw new Error('fill_pdfs.py not found');
    var result = spawnSync('python3', [fillerScript, cmd, JSON.stringify(data), LOCAL_TEMPLATES, outPath], {
      timeout: 60000, encoding: 'utf8'
    });
    if (result.status !== 0) throw new Error((result.stderr || result.stdout || 'Python filler failed').trim());
    if (!fs.existsSync(outPath)) throw new Error('PDF output not created');
    var buf = fs.readFileSync(outPath);
    var lastName = getLastName(data.grantor);
    var filename = lastName + ' - ' + outputSuffix + '.pdf';
    saveToCowork(paths, buf, lastName, filename);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.send(buf);
  } catch (err) {
    console.error('PDF ERROR (' + cmd + '):', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (e) {}
  }
}

app.post('/api/fill-deed', function(req, res) { runDeed(req.body, res); });
app.post('/api/fill-affidavit', function(req, res) { runPdf('affidavit', req.body, 'Aff of Consideration', res); });
app.post('/api/fill-residency', function(req, res) { runPdf('residency', req.body, "Seller's Residency", res); });

app.post('/api/claude', async function(req, res) {
  try {
    var controller = new AbortController();
    var timeout = setTimeout(function() { controller.abort(); }, 90000);
    var response = await fetch('https://api.anthropic.com/v1/messages', {
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

var PORT = process.env.PORT || 8080;
var server = app.listen(PORT, function() { console.log('Deed Processor running on port ' + PORT); });
server.timeout = 120000;
