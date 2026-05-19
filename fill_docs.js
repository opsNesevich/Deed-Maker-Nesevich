const fs = require('fs');
const AdmZip = require('adm-zip');

// Ghost names from the original template — strip before replacement
const GHOST_NAMES = [
  'William J. Kline, Jr. and Susan E. Kline',
  'William J. Kline, Jr. and Susan ',
  'William J. Kline, Jr.',
  'Susan E. Kline',
  'E. Kline',
  'ELINE',
  'Kline Family Living Trust'
];

function cleanGhostNames(xml) {
  let out = xml;
  GHOST_NAMES.forEach(g => { out = out.split(g).join(''); });
  out = out.replace(/\bELINE\b/g, '').replace(/\bE\. Kline\b/g, '');
  return out;
}

function ensureMunicipalityFormat(municipality) {
  if (!municipality) return municipality;
  // Rule: always "[Name] Township/Borough/City" — never "Township of [Name]"
  const suffixes = ['Township', 'Borough', 'City', 'Town', 'Village'];
  const m = municipality.trim();
  if (suffixes.some(s => m.endsWith(s))) return m;
  return m + ' Township';
}

// ── Deed (.docx) generation via adm-zip XML string-replace ───────────────────
// The template contains placeholder text (example client data) that gets replaced
// with actual client data. This mirrors the unpack→edit-XML→repack approach from
// the skill, using adm-zip instead of external Python scripts.
function fillDeedDocx(data, templatePath, outputPath) {
  const grantor    = data.grantor  || '';
  const grantor2   = data.grantor2 || '';
  const rel        = data.relationship || '';
  const fullGrantor = grantor2
    ? `${grantor} and ${grantor2}${rel ? ', ' + rel : ''}`
    : grantor;

  // Grantee / trust clause in AND line
  // If signing date provided use it; otherwise use blank date placeholder per skill
  const signingDate = data.signingDate || '';
  const trustDate   = data.trustDate || signingDate;
  const trustDateStr = trustDate || '_____________, ______';
  const grantee     = data.newGrantee || '';
  const granteeClause = `${grantee}, a Trust, dated ${trustDateStr}`;

  const grantorAddr  = data.grantorAddr  || '';
  const municipality = ensureMunicipalityFormat(data.municipality || 'Maple Shade Township');
  const county       = data.county       || 'Burlington';
  const block        = data.block        || '';
  const lot          = data.lot          || '';
  const propAddr     = data.propAddr     || grantorAddr;

  // BEING line fields (from cover sheet Second Party — never First Party)
  const priorDeedDate    = data.priorDeedDate    || '';
  const priorRecorded    = data.priorRecordedDate || '';
  const priorBook        = data.priorBook        || '';
  const priorPage        = data.priorPage        || '';
  const priorCounty      = data.priorCounty      || county;
  const instrumentNo     = data.instrumentNo     || '';
  const certifyDate      = signingDate || '______________';

  const zip = new AdmZip(templatePath);
  let xml = zip.readAsText('word/document.xml');

  xml = cleanGhostNames(xml);

  // Ordered replacements — most specific strings first to avoid partial collisions
  const reps = [
    // Signing / deed date
    ['May 28 , 20 2 6 ,',            certifyDate + ','],
    ['May 28 , 2026 ,',              certifyDate + ','],
    ['May 28, 2026,',                certifyDate + ','],
    ['May 28 , 2026',                certifyDate],
    // Grantee / trust clause
    ['Kline Family Living Trust , a Trust, dated May 28 , 2026', granteeClause],
    // Grantor
    ['William J. Kline, Jr.',        grantor],
    // Grantor address
    ['2 Arlington Avenue in Maple Shade, New Jersey 08052', grantorAddr],
    ['2 Arlington Ave., Maple Shade, New Jersey 08052',    propAddr || grantorAddr],
    // Municipality (use format rule everywhere)
    ['Maple Shade Township',         municipality],
    // Block / lot
    ['129.11',                       block],
    ['Lot No. 1',                    `Lot No. ${lot}`],
    ['Lot: 1',                       `Lot: ${lot}`],
    ['Block: 129.11',                `Block: ${block}`],
    ['Block No. 129.11',             `Block No. ${block}`],
    // BEING line — prior deed recording details
    ['April 16, 1985',               priorDeedDate],
    ['April 23, 1985',               priorRecorded],
    ['Deed Book 2990',               `Deed Book ${priorBook}`],
    ['P age 139',                    `Page ${priorPage}`],
    ['Page 139',                     `Page ${priorPage}`],
    // I CERTIFY block — grantor names
    ['May 28 , 2026 , William J. Kline, Jr. and Susan E. Kline',
                                     `${certifyDate}, ${fullGrantor}`],
  ];

  reps.forEach(([old, val]) => {
    if (old && val !== undefined && old !== val) {
      xml = xml.split(old).join(val);
    }
  });

  // Second pass to catch any residual ghost names introduced by replacements
  xml = cleanGhostNames(xml);

  zip.updateFile('word/document.xml', Buffer.from(xml, 'utf-8'));
  zip.writeZip(outputPath);
}

module.exports = { fillDeedDocx };
