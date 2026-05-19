const express = require('express');
const path = require('path');
const multer = require('multer');
const { execSync, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

app.use((req, res, next) => { res.setTimeout(120000); next(); });
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// STEP 0 — REGLA CRÍTICA: DESCUBRIMIENTO DINÁMICO DE PATHS
// ==========================================
function getCoworkPaths() {
  try {
    const context = execSync('find /sessions -maxdepth 3 -name "Claude Context" -type d 2>/dev/null | head -1').toString().trim();
    const skills = execSync('find /sessions -maxdepth 4 -path "*/.claude/skills" -type d 2>/dev/null | head -1').toString().trim();
    const uploads = execSync('find /sessions -maxdepth 3 -name "uploads" -type d 2>/dev/null | head -1').toString().trim();
    const outputs = execSync('find /sessions -maxdepth 3 -name "outputs" -type d 2>/dev/null | head -1').toString().trim();

    // Buscar la carpeta Deeds del escritorio (fuera de Claude Context)
    const deedsFolder = execSync('find /sessions -maxdepth 3 -name "Deeds" -not -path "*/Claude Context/*" -type d 2>/dev/null | head -1').toString().trim();

    if (!context || !skills || !uploads || !outputs) {
      console.error("⚠ Advertencia: No se encontraron todos los paths del sistema de archivos Cowork.");
    }

    return {
      CONTEXT: context,
      SKILLS: skills,
      UPLOADS: uploads,
      OUTPUTS: outputs,
      DEEDS_DESKTOP: deedsFolder || null,
      DEEDS_TEMPLATES: context ? path.join(context, 'Deeds') : path.join(__dirname, 'templates'),
      FILLER_SCRIPT: path.join(__dirname, 'fill_pdfs.py')
    };
  } catch (e) {
    console.error("Error ejecutando Path Setup (Step 0):", e.message);
    // Fallback básico para evitar crasheos si se corre localmente fuera de Cowork
    return {
      CONTEXT: '', SKILLS: '', UPLOADS: '', OUTPUTS: '', DEEDS_DESKTOP: null,
      DEEDS_TEMPLATES: path.join(__dirname, 'templates'),
      FILLER_SCRIPT: path.join(__dirname, 'fill_pdfs.py')
    };
  }
}

// ==========================================
// STEP 1 — EXTRACCIÓN CON REGLA DPI 200
// ==========================================
app.post('/api/extract', upload.single('pdf'), async (req, res) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deed-'));
  const paths = getCoworkPaths(); // Ejecutar Step 0

  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    // Guardar en /tmp para procesamiento rápido
    const pdfPath = path.join(tmpDir, 'deed.pdf');
    fs.writeFileSync(pdfPath, req.file.buffer);

    // Guardar copia también en el directorio de UPLOADS de la sesión tal como pide Step 1
    if (paths.UPLOADS) {
      try {
        const sessionUploadPath = path.join(paths.UPLOADS, req.file.originalname || 'original_deed.pdf');
        fs.writeFileSync(sessionUploadPath, req.file.buffer);
      } catch (errUpload) {
        console.error('No se pudo guardar copia de respaldo en la sesión:', errUpload.message);
      }
    }

    // REGLA OBLIGATORIA: pdftoppm debe correr a -r 200 (DPI 200) para legibilidad visual
    execSync(`pdftoppm -r 200 -jpeg "${pdfPath}" "${path.join(tmpDir, 'page')}"`, { timeout: 30000 });
    
    const images = fs.readdirSync(tmpDir)
      .filter(f => f.startsWith('page') && f.endsWith('.jpg'))
      .sort()
      .slice(0, 2) // Extraer páginas iniciales de interés (generalmente cover sheet y cuerpo inicial)
      .map(f => fs.readFileSync(path.join(tmpDir, f)).toString('base64'));
      
    if (images.length === 0) return res.status(400).json({ error: 'Could not convert PDF' });
    res.json({ images });
  } catch (err) {
    console.error('EXTRACT ERROR:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch(e) {}
  }
});

function getLastName(grantor) {
  if (!grantor) return 'Deed';
  const suffixes = new Set(['jr.','sr.','ii','iii','iv','esq.']);
  const parts = grantor.trim().split(/\s+/);
  const names = parts.filter(p => !suffixes.has(p.toLowerCase().replace(',','')));
  return (names[names.length - 1] || 'Deed').replace(/,/g, '').substring(0, 20);
}

// ==========================================
// ORQUESTADOR DE GENERACIÓN Y GUARDADO DE COMPANION FORMS
// ==========================================
function runFiller(cmd, data, outExt, res) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), cmd + '-'));
  const paths = getCoworkPaths(); // Asegurar setup de rutas dinámicas

  try {
    const outPath = path.join(tmpDir, 'output.' + outExt);
    console.log(`Running filler: ${cmd}`);
    
    // Invocar el script de python pasando el directorio dinámico de templates
    execFileSync('python3', [paths.FILLER_SCRIPT, cmd, JSON.stringify(data), paths.DEEDS_TEMPLATES, outPath], {
      timeout: 60000, encoding: 'utf8'
    });
    
    if (!fs.existsSync(outPath)) throw new Error('Output file not created');
    const buf = fs.readFileSync(outPath);
    const lastName = getLastName(data.grantor);

    // REGLA: Convención de nombres obligatoria
    let filename;
    if (cmd === 'deed') filename = `${lastName} Deed.docx`;
    else if (cmd === 'affidavit') filename = `${lastName} - Aff of Consideration.pdf`;
    else filename = `${lastName} - Seller's Residency.pdf`;

    // ------------------------------------------
    // STEP 12 — DISTRIBUCIÓN OBLIGATORIA EN COWORK
    // ------------------------------------------
    // 1. Guardar en carpeta de /outputs organizando por apellido
    if (paths.OUTPUTS) {
      const sessionOutDir = path.join(paths.OUTPUTS, lastName);
      if (!fs.existsSync(sessionOutDir)) fs.mkdirSync(sessionOutDir, { recursive: true });
      fs.writeFileSync(path.join(sessionOutDir, filename), buf);
    }

    // 2. Guardar en Desktop/Deeds si la carpeta está conectada
    if (paths.DEEDS_DESKTOP) {
      const desktopOutDir = path.join(paths.DEEDS_DESKTOP, lastName);
      if (!fs.existsSync(desktopOutDir)) fs.mkdirSync(desktopOutDir, { recursive: true });
      fs.writeFileSync(path.join(desktopOutDir, filename), buf);
    }

    // Responder al cliente para descarga en el navegador
    if (outExt === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
    } else {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    }
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buf);
  } catch (err) {
    console.error(`FILLER ERROR (${cmd}):`, err.message);
    if (err.stderr) console.error('stderr:', err.stderr);
    res.status(500).json({ error: err.message + (err.stderr ? ' | ' + err.stderr : '') });
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch(e) {}
  }
}

app.post('/api/fill-affidavit', (req, res) => runFiller('affidavit', req.body, 'pdf', res));
app.post('/api/fill-residency', (req, res) => runFiller('residency', req.body, 'pdf', res));
app.post('/api/fill-deed',      (req, res) => runFiller('deed',      req.body, 'docx', res));

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
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('CLAUDE ERROR:', err.message);
    res.status(500).json({ error: { message: err.message } });
  }
});

const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, () => console.log(`Deed Processor running on port ${PORT}`));
server.timeout = 120000;
