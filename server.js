// 1. Agrega la importación de tus funciones nativas de JS al inicio del archivo
const { fillDeedDocx, fillResidency, fillAffidavit } = require('./fill_docs');

// ... (Aquí mantienes tus configuraciones de Express, Multer, getCoworkPaths y getLastName)

// 2. Tu nueva función runFiller optimizada en JavaScript Nativo
async function runFiller(cmd, data, outExt, res) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), cmd + '-'));
  const paths = getCoworkPaths(); // Tu setup de rutas dinámicas de Cowork

  try {
    const outPath = path.join(tmpDir, 'output.' + outExt);
    const lastName = getLastName(data.grantor);
    
    let filename;
    // Ejecutar las librerías nativas directamente en el hilo de Node
    if (cmd === 'deed') {
      filename = `${lastName} Deed.docx`;
      const template = path.join(paths.DEEDS_TEMPLATES, 'deed-template.docx');
      fillDeedDocx(data, template, outPath);
    } else if (cmd === 'affidavit') {
      filename = `${lastName} - Aff of Consideration.pdf`;
      const template = path.join(paths.DEEDS_TEMPLATES, 'affidavit-template.pdf');
      await fillAffidavit(data, template, outPath); // Requiere async/await
    } else if (cmd === 'residency') {
      filename = `${lastName} - Seller's Residency.pdf`;
      const template = path.join(paths.DEEDS_TEMPLATES, 'residency-template.pdf');
      await fillResidency(data, template, outPath); // Requiere async/await
    }

    if (!fs.existsSync(outPath)) throw new Error('Output file not created');
    const buf = fs.readFileSync(outPath);

    // Guardado automático en directorios exigido por la Skill de Cowork
    if (paths.OUTPUTS) {
      const sessionOutDir = path.join(paths.OUTPUTS, lastName);
      if (!fs.existsSync(sessionOutDir)) fs.mkdirSync(sessionOutDir, { recursive: true });
      fs.writeFileSync(path.join(sessionOutDir, filename), buf);
    }
    if (paths.DEEDS_DESKTOP) {
      const desktopOutDir = path.join(paths.DEEDS_DESKTOP, lastName);
      if (!fs.existsSync(desktopOutDir)) fs.mkdirSync(desktopOutDir, { recursive: true });
      fs.writeFileSync(path.join(desktopOutDir, filename), buf);
    }

    // Enviar descarga al navegador del usuario
    if (outExt === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
    } else {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    }
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buf);

  } catch (err) {
    console.error(`FILLER ERROR JS (${cmd}):`, err.message);
    res.status(500).json({ error: err.message });
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch(e) {}
  }
}

// 3. REGLA CRÍTICA: Modifica las llamadas de Express para que manejen funciones asíncronas (async/await)
app.post('/api/fill-affidavit', async (req, res) => { await runFiller('affidavit', req.body, 'pdf', res); });
app.post('/api/fill-residency', async (req, res) => { await runFiller('residency', req.body, 'pdf', res); });
app.post('/api/fill-deed',      async (req, res) => { await runFiller('deed',      req.body, 'docx', res); });

// ... (El resto de tu código con la ruta de Claude y el app.listen sigue igual)
