const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { PDFDocument } = require('pdf-lib');

// ── Utilidades de limpieza de texto idénticas a tu versión previa ────────────────
const GHOST_NAMES = [
    'William J. Kline, Jr. and Susan E. Kline',
    'William J. Kline, Jr. and Susan ',
    'William J. Kline, Jr.',
    'Susan E. Kline',
    'E. Kline',
    'ELINE',
    'Kline Family Living Trust'
];

function titleCaseSafe(text) {
    if (!text) return text;
    return text.split(/\s+/).map(w => (w.toUpperCase() === w && w.length > 1) ? w.charAt(0) + w.slice(1).toLowerCase() : w).join(' ');
}

function ensureTownshipSuffix(municipality) {
    if (!municipality) return municipality;
    // Regla Crítica: Mantener el formato "[Name] Township/Borough/City"
    const suffixes = ['Township', 'Borough', 'City', 'Town', 'Village', 'TWP', 'BORO'];
    const cleanMuni = municipality.trim();
    for (let s of suffixes) {
        if (cleanMuni.endsWith(s)) return cleanMuni;
    }
    return cleanMuni + ' Township';
}

function cleanGhostNames(xml) {
    let cleanXml = xml;
    GHOST_NAMES.forEach(ghost => {
        cleanXml = cleanXml.split(ghost).join('');
    });
    cleanXml = cleanXml.replace(/\bELINE\b/g, '');
    cleanXml = cleanXml.replace(/\bE\. Kline\b/g, '');
    return cleanXml;
}

function formatRelationship(grantor, grantor2, relationship) {
    if (!grantor2) return grantor;
    const rel = relationship || 'Husband and Wife';
    return `${grantor} and ${grantor2}, ${rel}`;
}

// Helper para extraer partes de la dirección
function extractAddressPart(addr, index) {
    if (!addr) return '';
    const parts = addr.split(',');
    return parts[index] ? parts[index].trim() : '';
}

// ── 1. GENERACIÓN DEL DEED (.DOCX) EN JS NATIVO ──────────────────────────────
function fillDeedDocx(data, templatePath, outputPath) {
    const deedDate = data.signingDate || '_______________';
    const grantor = data.grantor || '';
    const grantor2 = data.grantor2 || '';
    const relationship = data.relationship || '';
    const fullGrantor = formatRelationship(grantor, grantor2, relationship);

    // Captura los múltiples grantees concatenados desde el frontend ("Grantee A and Grantee B")
    const grantee = data.newGrantee || '';
    const trustDate = data.trustDate || '_____________, ______';
    const granteeClause = trustDate ? `${grantee}, a Trust, dated ${trustDate}` : grantee;

    const grantorAddr = data.grantorAddr || '';
    const municipality = ensureTownshipSuffix(data.municipality || '');
    const county = data.county || 'Burlington';
    const block = data.block || '';
    const lot = data.lot || '';
    const propAddr = data.propAddr || '';
    const priorGrantees = data.priorGrantees || fullGrantor;
    const priorDeedDate = data.priorDeedDate || 'April 16, 1985';
    const priorRecorded = data.priorRecordedDate || 'April 23, 1985';
    const priorBook = data.priorBook || '2990';
    const priorPage = data.priorPage || '139';
    const priorCounty = data.priorCounty || county;
    const instrumentNo = data.instrumentNo || '';

    // Cargar el archivo Word (.docx) como un archivo ZIP comprimido usando adm-zip
    const zip = new AdmZip(templatePath);
    let docXml = zip.readAsText('word/document.xml');

    docXml = cleanGhostNames(docXml);

    // Reemplazos requeridos por la skill
    const replacements = [
        ['May 28 , 20 2 6 ,', deedDate + ','],
        ['May 28 , 2026 ,', deedDate + ','],
        ['May 28, 2026,', deedDate + ','],
        ['May 28 , 2026', deedDate],
        ['William J. Kline, Jr.', grantor],
        ['2 Arlington Avenue in Maple Shade, New Jersey 08052', grantorAddr],
        ['2 Arlington Ave., Maple Shade, New Jersey 08052', propAddr || grantorAddr],
        ['Kline Family Living Trust , a Trust, dated May 28 , 2026', granteeClause],
        ['Maple Shade Township', municipality],
        ['129.11', block],
        ['Lot No. 1', `Lot No. ${lot}`],
        ['Lot: 1', `Lot: ${lot}`],
        ['Block: 129.11', `Block: ${block}`],
        ['Block No. 129.11', `Block No. ${block}`],
        ['April 16, 1985', priorDeedDate],
        ['April 23, 1985', priorRecorded],
        ['Deed Book 2990', `Deed Book ${priorBook}`],
        ['P age 139', `Page ${priorPage}`],
        ['Page 139', `Page ${priorPage}`],
        ['May 28 , 2026 , William J. Kline, Jr. and Susan E. Kline', `${deedDate}, ${fullGrantor}`]
    ];

    replacements.forEach(([oldStr, newStr]) => {
        if (oldStr && newStr && oldStr !== newStr) {
            docXml = docXml.split(oldStr).join(newStr);
        }
    });

    docXml = cleanGhostNames(docXml);

    // Escribir los cambios de vuelta en la estructura interna del archivo zip de Word
    zip.updateFile('word/document.xml', Buffer.from(docXml, 'utf-8'));
    zip.writeZip(outputPath);
}

// ── 2. LLENADO DE SELLER'S RESIDENCY (GIT/REP-3) EN JS NATIVO ────────────────
async function fillResidency(data, templatePath, outputPath) {
    const pdfBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();

    const fullGrantorName = formatRelationship(data.grantor, data.grantor2, data.relationship);
    const deedDate = data.signingDate || '';

    // Mapeo uno a uno de los text fields interactivos
    const fieldsToFill = {
        'Name':                        fullGrantorName,
        'Add1':                        extractAddressPart(data.grantorAddr, 0),
        'City Town Post Office':       extractAddressPart(data.grantorAddr, 1),
        'State':                       'NJ',
        'ZIP Code':                    data.grantorZip || '',
        'Block':                       data.block || '',
        'Lot':                         data.lot || '',
        'Qual':                        data.qualifier || '',
        'Add2':                        extractAddressPart(data.propAddr, 0),
        'City Town Post Office_2':     data.propCity || extractAddressPart(data.propAddr, 1),
        'State_2':                     'NJ',
        'ZIP Code_2':                  data.propZip || '',
        'Sellers Percentage of Ownership': '100%',
        'Total Consideration':         '1.00',
        'Owners Share of Consideration': '1.00',
        'Closing Date':                deedDate
    };

    // Llenar campos de texto de forma segura
    Object.entries(fieldsToFill).forEach(([fieldName, value]) => {
        try {
            const field = form.getTextField(fieldName);
            if (field) field.setText(String(value));
        } catch (e) { /* Campo inexistente en esta versión de plantilla */ }
    });

    // Activar Checkboxes críticos según Skill (Paso 7: Cajas 1, 2 y 6)
    const checkboxes = ['Check Box71a', 'Check Box72a', 'Check Box76a'];
    checkboxes.forEach(boxName => {
        try {
            const checkBox = form.getCheckBox(boxName);
            if (checkBox) checkBox.check();
        } catch (e) {}
    });

    const modifiedPdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, modifiedPdfBytes);
}

// ── 3. LLENADO DE AFFIDAVIT OF CONSIDERATION (RTF-1) EN JS NATIVO ────────────
async function fillAffidavit(data, templatePath, outputPath) {
    const pdfBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();

    const ssnRaw = (data.ssn || '').trim();
    const ssnFormatted = ssnRaw ? `XXX-XX-${ssnRaw}` : 'XXX-XX-___';
    
    const propStreet = extractAddressPart(data.propAddr, 0);
    const propCity = data.propCity || extractAddressPart(data.propAddr, 1);
    const propZip = data.propZip || '';
    const fullPropAddr = `${propStreet}, ${propCity}, NJ ${propZip}`.replace(/^,\s*|,\s*$/g, '');

    const fieldsToFill = {
        'County':                          data.county || 'Burlington',
        'County Municipal Code':           data.countyMunicipalCode || '0319',
        'Municipality of Property Location': ensureTownshipSuffix(data.municipality || ''),
        'Deponent Name':                   data.grantor || '',
        'Deponent Title':                  'Grantor',
        'Deed Dated':                      '', // Siempre en blanco según la Skill
        'Block Number':                    data.block || '',
        'Lot Number':                      data.lot || '',
        'Property Address':                fullPropAddr,
        'Consideration Amount':            '1.00',
        'Full Exemption From Fee, Line 1': 'For consideration of less than $100.',
        'Grantor Name':                    data.grantor || '',
        "Last 3 digits of Grant's SSN":    ssnFormatted,
        'Grantor Address at Time of Sale': '',
        'Deponent Address':                ''
    };

    Object.entries(fieldsToFill).forEach(([fieldName, value]) => {
        try {
            const field = form.getTextField(fieldName);
            if (field) field.setText(String(value));
        } catch (e) {}
    });

    // REGLA DE LA SKILL: Activar la casilla "No prior mortgage" sin destruir apariencia visual
    try {
        const checkBox = form.getCheckBox('No prior mortgage');
        if (checkBox) checkBox.check();
    } catch (e) {}

    const modifiedPdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, modifiedPdfBytes);
}

module.exports = { fillDeedDocx, fillResidency, fillAffidavit };
