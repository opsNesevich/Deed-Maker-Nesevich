// ── State ────────────────────────────────────────────────────────────────────
let uploadedFile = null;
let extractedData = {};
let blobs = {};

// ── Drag-drop ────────────────────────────────────────────────────────────────
function dzOver(e) {
  e.preventDefault();
  document.getElementById('dz').classList.add('over');
}
function dzLeave() {
  document.getElementById('dz').classList.remove('over');
}
function dzDrop(e) {
  e.preventDefault();
  dzLeave();
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
}

function handleFile(file) {
  if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
    showError('Please upload a PDF file.');
    return;
  }
  uploadedFile = file;
  document.getElementById('chipName').textContent = file.name;
  document.getElementById('fileChip').style.display = 'flex';
  document.getElementById('dz').style.display = 'none';
  document.getElementById('genBtn').disabled = false;
  showError('');
}

// ── Extra grantee input ───────────────────────────────────────────────────────
function addGranteeField() {
  const container = document.getElementById('granteeContainer');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'fi grantee-input extra-grantee';
  input.placeholder = 'e.g. Additional Grantee / Trust Name';
  container.appendChild(input);
}

// ── Progress steps ────────────────────────────────────────────────────────────
function setStep(n, state) {
  const icon = document.getElementById(`s${n}i`);
  const lbl  = document.getElementById(`s${n}l`);
  if (!icon) return;
  icon.className = `psicon${state ? ' ' + state : ''}`;
  lbl.className  = `pslbl${state ? ' ' + state : ''}`;
  if (state === 'done')   icon.textContent = '✓';
  else if (state === 'error') icon.textContent = '✕';
  else icon.textContent = String(n);
}

// ── Error / toast ─────────────────────────────────────────────────────────────
function showError(msg) {
  const box = document.getElementById('errorBox');
  box.textContent = msg;
  box.style.display = msg ? 'block' : 'none';
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('on');
  setTimeout(() => t.classList.remove('on'), 3500);
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function formatDateLong(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
}

// ── NJ Municipal Code lookup (Burlington County embedded; others extensible) ──
const MUNI_CODES = {
  'BASS RIVER TWP':'0301','BEVERLY CITY':'0302','BORDENTOWN CITY':'0303',
  'BORDENTOWN TWP':'0304','BURLINGTON CITY':'0305','BURLINGTON TWP':'0306',
  'CHESTERFIELD TWP':'0307','CINNAMINSON TWP':'0308','DELANCO TWP':'0309',
  'DELRAN TWP':'0310','EASTAMPTON TWP':'0311','EDGEWATER PARK TWP':'0312',
  'EVESHAM TWP':'0313','FIELDSBORO BORO':'0314','FLORENCE TWP':'0315',
  'HAINESPORT TWP':'0316','LUMBERTON TWP':'0317','MANSFIELD TWP':'0318',
  'MAPLE SHADE TWP':'0319','MEDFORD TWP':'0320','MEDFORD LAKES BORO':'0321',
  'MOORESTOWN TWP':'0322','MT HOLLY TWP':'0323','MOUNT HOLLY TWP':'0323',
  'MT LAUREL TWP':'0324','MOUNT LAUREL TWP':'0324','NEW HANOVER TWP':'0325',
  'NO HANOVER TWP':'0326','NORTH HANOVER TWP':'0326','PALMYRA BORO':'0327',
  'PEMBERTON BORO':'0328','PEMBERTON TWP':'0329','RIVERSIDE TWP':'0330',
  'RIVERTON BORO':'0331','SHAMONG TWP':'0332','SOUTHAMPTON TWP':'0333',
  'SPRINGFIELD TWP':'0334','TABERNACLE TWP':'0335','WASHINGTON TWP':'0336',
  'WESTAMPTON TWP':'0337','WILLINGBORO TWP':'0338','WOODLAND TWP':'0339',
  'WRIGHTSTOWN BORO':'0340',
};

function getMunicipalCode(municipality) {
  if (!municipality) return '';
  const key = municipality.toUpperCase()
    .replace(' TOWNSHIP', ' TWP')
    .replace(' BOROUGH', ' BORO');
  return MUNI_CODES[key] || '';
}

// ── Main generate flow ────────────────────────────────────────────────────────
async function generate() {
  if (!uploadedFile) return;

  const granteeInputs = document.querySelectorAll('.grantee-input');
  const granteeNames  = [...granteeInputs].map(i => i.value.trim()).filter(Boolean);
  if (!granteeNames.length) {
    showError('Please enter the Trust / Grantee name.');
    return;
  }

  showError('');
  blobs = {};
  document.getElementById('genBtn').disabled = true;
  document.getElementById('genBtnText').style.display  = 'none';
  document.getElementById('genSpinner').style.display  = 'inline-block';
  document.getElementById('progressWrap').classList.add('on');
  document.getElementById('results').classList.remove('on');
  [1, 2, 3, 4, 5].forEach(n => setStep(n, ''));

  try {
    // ── Step 1: PDF → images ────────────────────────────────────────────────
    setStep(1, 'active');
    const formData = new FormData();
    formData.append('pdf', uploadedFile);
    const extractRes = await fetch('/api/extract', { method: 'POST', body: formData });
    if (!extractRes.ok) {
      const e = await extractRes.json().catch(() => ({}));
      throw new Error('PDF extraction failed: ' + (e.error || extractRes.statusText));
    }
    const { images } = await extractRes.json();
    setStep(1, 'done');

    // ── Step 2: Claude reads deed ───────────────────────────────────────────
    setStep(2, 'active');
    const claudeRes = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-opus-4-5-20251101',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: [
            ...images.map(img => ({
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: img }
            })),
            {
              type: 'text',
              text: `You are a NJ deed data extraction specialist for Nesevich Law (Burlington County).

Analyze these deed images and extract all fields. Return ONLY a valid JSON object — no markdown, no explanation.

CRITICAL RULES:
1. Read ONLY from the COVER SHEET (first-page summary) — never from chain-of-title entries inside the body.
2. The "Second Party" (Grantee) on the cover sheet becomes the new GRANTOR — use this person for grantor fields.
3. Municipality format: always "[Name] Township" or "[Name] Borough" — NEVER "Township of [Name]".
4. propCity must be the mailing city (e.g. "Marlton") — NOT the municipality name (e.g. NOT "Evesham Township").
5. BEING line always uses Second Party from cover sheet.

{
  "grantor": "Full name of Second Party — first person only if couple",
  "grantor2": "Second person full name if couple, else empty string",
  "relationship": "e.g. Husband and Wife | A married person | empty if single",
  "grantorAddr": "Full address of Second Party: street, city, state zip",
  "grantorZip": "ZIP of grantor address",
  "municipality": "e.g. Evesham Township (Name + Township/Borough/City)",
  "county": "Property county e.g. Burlington",
  "block": "Tax map block number",
  "lot": "Tax map lot number",
  "qualifier": "Lot qualifier if present, else empty string",
  "propAddr": "Property street address only (no city/state)",
  "propCity": "Mailing city e.g. Marlton (NOT municipality)",
  "propZip": "Property ZIP",
  "priorDeedDate": "Date on original deed e.g. September 19, 2023",
  "priorRecordedDate": "Date recorded e.g. October 3, 2023",
  "priorCountyClerk": "e.g. Burlington County Clerk's Office",
  "priorBook": "Deed Book number",
  "priorPage": "Page number",
  "instrumentNo": "Instrument number if present, else empty string",
  "legalDescription": "Full legal description from body, verbatim"
}`
            }
          ]
        }]
      })
    });
    if (!claudeRes.ok) {
      const e = await claudeRes.json().catch(() => ({}));
      throw new Error('Claude API failed: ' + (e.error?.message || claudeRes.statusText));
    }
    const claudeData = await claudeRes.json();
    const rawText   = claudeData.content?.[0]?.text || '{}';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    extractedData   = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    setStep(2, 'done');

    // Collect user-entered form values and merge with extracted data
    const signingDateRaw = document.getElementById('inp_signingDate').value;
    const trustDateRaw   = document.getElementById('inp_trustDate').value;
    const signingDate    = formatDateLong(signingDateRaw);
    const trustDate      = formatDateLong(trustDateRaw) || signingDate;

    const payload = {
      ...extractedData,
      newGrantee:          granteeNames.join(' and '),
      trustDate,
      signingDate,
      ssn:                 document.getElementById('inp_ssn').value.trim(),
      countyMunicipalCode: getMunicipalCode(extractedData.municipality),
    };

    // ── Step 3: Deed (.docx) ───────────────────────────────────────────────
    setStep(3, 'active');
    const deedRes = await fetch('/api/fill-deed', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!deedRes.ok) {
      const e = await deedRes.json().catch(() => ({}));
      throw new Error('Deed generation failed: ' + (e.error || deedRes.statusText));
    }
    blobs.deed = await deedRes.blob();
    setStep(3, 'done');

    // ── Step 4: Affidavit of Consideration (RTF-1) ─────────────────────────
    setStep(4, 'active');
    const affRes = await fetch('/api/fill-affidavit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!affRes.ok) {
      const e = await affRes.json().catch(() => ({}));
      throw new Error('Affidavit failed: ' + (e.error || affRes.statusText));
    }
    blobs.aff = await affRes.blob();
    setStep(4, 'done');

    // ── Step 5: Seller's Residency Certification (GIT/REP-3) ───────────────
    setStep(5, 'active');
    const resRes = await fetch('/api/fill-residency', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resRes.ok) {
      const e = await resRes.json().catch(() => ({}));
      throw new Error("Residency cert failed: " + (e.error || resRes.statusText));
    }
    blobs.res = await resRes.blob();
    setStep(5, 'done');

    // Show results
    const name = extractedData.grantor || '';
    document.getElementById('resultsSub').textContent =
      '3 documents ready' + (name ? ' for ' + name : '');
    document.getElementById('results').classList.add('on');
    showToast('All 3 documents generated successfully');

  } catch (err) {
    showError(err.message);
    showToast(err.message);
    [1, 2, 3, 4, 5].forEach(n => {
      const icon = document.getElementById(`s${n}i`);
      if (icon && icon.className.includes('active')) setStep(n, 'error');
    });
  } finally {
    document.getElementById('genBtn').disabled = false;
    document.getElementById('genBtnText').style.display = 'inline';
    document.getElementById('genSpinner').style.display = 'none';
  }
}

// ── Download helpers ──────────────────────────────────────────────────────────
function downloadBlob(key) {
  const map = {
    deed: ['deed', 'Deed.docx'],
    aff:  ['aff',  'Aff of Consideration.pdf'],
    res:  ['res',  "Seller's Residency.pdf"],
  };
  const [bk, name] = map[key] || [];
  const blob = blobs[bk];
  if (!blob) { showToast('Document not ready yet'); return; }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (extractedData.grantor
    ? extractedData.grantor.split(' ').pop().replace(/,/g, '') + ' - '
    : '') + name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadAll() {
  ['deed', 'aff', 'res'].forEach((k, i) => setTimeout(() => downloadBlob(k), i * 600));
}

// ── Reset ─────────────────────────────────────────────────────────────────────
function resetAll() {
  uploadedFile  = null;
  extractedData = {};
  blobs         = {};

  document.getElementById('dz').style.display        = 'block';
  document.getElementById('fileChip').style.display   = 'none';
  document.getElementById('genBtn').disabled          = true;
  document.getElementById('progressWrap').classList.remove('on');
  document.getElementById('results').classList.remove('on');
  showError('');

  document.querySelectorAll('.grantee-input').forEach((el, i) => {
    el.value = '';
    if (i > 0) el.remove();
  });
  ['inp_trustDate', 'inp_signingDate', 'inp_ssn', 'inp_dod',
   'inp_preparedBy', 'inp_returnTo', 'inp_trustee'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  [1, 2, 3, 4, 5].forEach(n => setStep(n, ''));
}
