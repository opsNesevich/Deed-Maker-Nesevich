---
name: deed-package
description: >
  Use when the user wants to generate a full Nesevich deed package — deed (.docx),
  GIT/REP-3 (Seller's Residency Certification), and RTF-1 (Affidavit of Consideration)
  for a New Jersey estate planning property transfer. Activates for requests about
  new deed matters, deed packages, or any of the three closing documents. Also triggers
  on "new deed", "deed package", "trust deed", "transfer deed", "deed for [client name]",
  or any mention of the companion forms RTF-1, GIT/REP-3, affidavit of consideration,
  or seller's residency certification.
---

# Nesevich Law — Deed + Companion Forms Skill (Cowork Edition)

## Purpose
Create a new NJ deed (.docx) and fill the corresponding RTF-1 (Affidavit of Consideration)
and GIT/REP-3 (Seller's Residency Certification) PDFs in one workflow. The user uploads
the client's original deed PDF; Claude extracts all data automatically. Claude then asks
only for the trust name (new grantee) and signing date before proceeding.

---

## Step 0 — Path Setup (run at the start of EVERY bash block)

All paths are discovered dynamically at runtime because Cowork uses session-specific
mount paths that change each session. Add these lines at the top of every bash block:

```bash
CONTEXT=$(find /sessions -maxdepth 3 -name "Claude Context" -type d 2>/dev/null | head -1)
SKILLS=$(find /sessions -maxdepth 4 -path "*/.claude/skills" -type d 2>/dev/null | head -1)
UPLOADS=$(find /sessions -maxdepth 3 -name "uploads" -type d 2>/dev/null | head -1)
OUTPUTS=$(find /sessions -maxdepth 3 -name "outputs" -type d 2>/dev/null | head -1)
DEEDS="$CONTEXT/Deeds"
DOCX_SCRIPTS="$SKILLS/docx/scripts/office"
PDF_SCRIPTS="$SKILLS/pdf/scripts"
```

Confirm each variable is non-empty before using. If any path is missing, report which one and stop.

---

## Step 1 — Find and Extract Data from Uploaded Original Deed PDF

The user uploads the client's original deed PDF. Find it:
```bash
CONTEXT=$(find /sessions -maxdepth 3 -name "Claude Context" -type d 2>/dev/null | head -1)
UPLOADS=$(find /sessions -maxdepth 3 -name "uploads" -type d 2>/dev/null | head -1)
ls "$UPLOADS/"
```

Read the PDF using the Read tool (it will render visually). Extract ALL of the following:

**From the cover sheet (always use the cover sheet — never chain-of-title entries inside the body):**
- **Second Party (Grantee)** — this becomes the new **Grantor** on the new deed
  - Full legal name(s), relationship (e.g., Husband and Wife, A married person)
- **Grantor address** — street, city, state, zip (use Second Party's address from cover sheet)
- **Property address** — street, city, zip
- **Municipality and County**
- **Block, Lot, Qualifier** (Qualifier only if applicable)
- **Deed date** (on the original deed)
- **Recording date** (date recorded in county clerk's office)
- **County Clerk's Office name** (e.g., "Burlington County Clerk's Office")
- **Book and Page** (Deed Book number, Page number)
- **Instrument No.** (if present)

**From the deed body:**
- **Legal description** — full metes and bounds or condo description (copy verbatim)

**BEING the Same Premises Rule — CRITICAL:**
The cover sheet lists First Party (Grantor) and Second Party (Grantee).
Always use **Second Party (Grantee)** for the BEING line — never the First Party,
and never older chain-of-title entries found within the body of the deed.

Example BEING line:
> BEING the same premises conveyed to Diane Zotti, by Deed dated September 19, 2023
> and recorded on October 3, 2023 in the Atlantic County Clerk's Office, in Deed Book
> 15494, Page 1, as Instrument No. 2023042030.

---

## Step 2 — Ask User for Two Items (in one message)

After extracting the deed data, ask in a single message:

1. **Trust name** — the full name of the new grantee trust
   (e.g., "The John and Jane Smith Living Trust")
2. **Signing date** — date the documents will be signed, or leave blank
   (this becomes: trust date in the grantee/AND line, I CERTIFY date in notary block,
   and closing date on the GIT/REP-3)

Do not ask anything else. All other data comes from the original deed.

---

## Always Fixed — Never Ask

- **Grantor → Grantee mapping**: Second Party from original deed cover sheet = new Grantor
- **Deed title**: always DEED
- **Transfer language**: always "The Grantor grants and conveys (transfer of ownership)
  all the Grantor's ownership in the property described below to the Grantee."
- **Consideration**: always One and No/100 ($1.00) Dollar in deed; $1.00 in RTF-1;
  1.00 (no $ sign) in GIT/REP-3
- **Prepared by**: Russ Nesevich, Esq. — never change
- **Record and Return**: Nesevich Law, LLC, 400 North Church Street, Suite 250,
  Moorestown, NJ 08057 — never change
- **Grantee address**: same as grantor address (extracted from original deed)
- **GIT/REP-3 boxes always checked**: Check Box71a, Check Box72a, Check Box76a
- **GIT/REP-3 seller's percentage of ownership**: 100%
- **GIT/REP-3 owner's share of consideration**: 1.00 (no $ sign)
- **GIT/REP-3 name field**: include relationship after names if two grantors
  (e.g., "Jane Smith and John Smith, Wife and Husband"); single grantor = name only
- **RTF-1 County field**: always Burlington (notary/closing county, not property county)
- **Deed notary block COUNTY OF**: always BURLINGTON (hardcoded regardless of property county)
- **RTF-1 deponent and grantor name**: first grantor only
- **RTF-1 deponent title**: Grantor
- **RTF-1 full exemption reason**: "For consideration of less than $100."
- **RTF-1 "No prior mortgage" checkbox**: always checked
- **RTF-1 Deed Dated field**: always blank — never populate from the original deed date
- **RTF-1 grantor address and deponent address**: always blank
- **I CERTIFY date in notary block**: use signing date if provided; otherwise: `______________`
- **GIT/REP-3 closing date**: use signing date if provided; otherwise blank
- **Trust date in AND/grantee line**: use signing date if provided; otherwise: `_____________, ______`
- **Property addresses**: spelled-out form matching NJ property records
  (e.g., "Third Avenue" not "3rd Ave")
- **Notary state**: always New Jersey — never ask
- **GIT/REP-3 and RTF-1 property city**: mailing city (e.g., "Marlton") —
  NOT the municipality name (e.g., not "Evesham Township")
- **GIT/REP-3 address fields**: no trailing commas — commas handled by form layout

---

## Municipality Format Rule — CRITICAL

Always write municipality as "[Name] Township" / "[Name] Borough" / "[Name] City" —
never as "Township of [Name]".

Applies everywhere the municipality appears:
- Tax Map Reference line in deed body
- Property paragraph ("...on the land in Evesham Township, County of Burlington...")
- NOTE FOR INFORMATION line
- Legal description intro
- RTF-1 Municipality of Property Location field

**Correct:** `Evesham Township` / `Mount Holly Township`
**Wrong:** `Township of Evesham` / `Township of Mount Holly`

---

## PART 1 — Create the Deed

### Step 3: Unpack the template
```bash
CONTEXT=$(find /sessions -maxdepth 3 -name "Claude Context" -type d 2>/dev/null | head -1)
SKILLS=$(find /sessions -maxdepth 4 -path "*/.claude/skills" -type d 2>/dev/null | head -1)
DEEDS="$CONTEXT/Deeds"
DOCX_SCRIPTS="$SKILLS/docx/scripts/office"

python "$DOCX_SCRIPTS/unpack.py" "$DEEDS/Deed_Template_for_Claude.docx" /tmp/deed_unpacked/
cp -r /tmp/deed_unpacked /tmp/new_deed/
```

### Step 4: Make targeted replacements in document.xml

Edit `/tmp/new_deed/word/document.xml` using the Edit tool with str_replace.

**Always replace:**
- Grantor name(s) — BETWEEN line, signature block, and I CERTIFY paragraph
- Grantor address — first address block after BETWEEN
- Grantee name — AND line (bold); include trust date after name
- Trust date in AND/grantee line: use signing date if provided; otherwise `_____________, ______`
- Grantee address (same as grantor)
- Property paragraph — "The property consists of the land...in [Municipality], County of [Y]..."
  (use municipality format rule)
- Street address of property
- Tax Map Reference — municipality, county, block, lot (omit qualifier if not applicable)
- NOTE FOR INFORMATION line — lot, block, municipality, county
- BEING the same premises — use Second Party from cover sheet; include deed date, recording date,
  county clerk's office, book and page, instrument no.
- Signature labels
- Signatures intro line (see singular/plural rule below)
- COUNTY OF [county] — notary block — always BURLINGTON
- STATE OF [state] — always New Jersey
- Notary Public, State of [state]
- I CERTIFY names
- Consideration in clause (c): always $1.00
- Legal description — municipality, county, description body

**Never change:**
- Title (always DEED), transfer language, consideration amounts, prepared by line,
  Record and Return blocks, NJSA citations, fonts, spacing, margins

**Single grantor rules** (if only one person on original deed):
- Remove second signature block (both signature line paragraph and name label paragraph,
  targeted by w14:paraId)
- Change "The Grantors sign this Deed..." to "The Grantor signs this Deed..."
- Change "were the makers of this Deed" to "was the maker of this Deed"
- Change "executed this Deed as their own act" to "executed this Deed as his/her own act"

**Page break rules (apply to every deed):**
Add `<w:pageBreakBefore/>` inside `<w:pPr>` of both the Signatures paragraph and the
Legal Description paragraph so each always starts on a new page:

```xml
<w:pPr>
  <w:pageBreakBefore/>
  <w:jc w:val="both"/>
  <w:rPr>...</w:rPr>
</w:pPr>
```

**str_replace tip:** When replacing fields followed immediately by a new `<w:p>` element,
include the full closing sequence `</w:r></w:p><w:p w14:paraId="[ID]"` in both old and
new strings to prevent XML corruption.

### Step 5: Repack and validate
```bash
CONTEXT=$(find /sessions -maxdepth 3 -name "Claude Context" -type d 2>/dev/null | head -1)
SKILLS=$(find /sessions -maxdepth 4 -path "*/.claude/skills" -type d 2>/dev/null | head -1)
DEEDS="$CONTEXT/Deeds"
DOCX_SCRIPTS="$SKILLS/docx/scripts/office"

python "$DOCX_SCRIPTS/pack.py" /tmp/new_deed/ /tmp/[LastName]_Deed.docx \
  --original "$DEEDS/Deed_Template_for_Claude.docx"
```

Confirm "All validations PASSED!" before proceeding.

---

## PART 2 — Fill the GIT/REP-3

### Step 6: Set up forms directory and copy template
```bash
CONTEXT=$(find /sessions -maxdepth 3 -name "Claude Context" -type d 2>/dev/null | head -1)
DEEDS="$CONTEXT/Deeds"
mkdir -p /tmp/forms_work
cp "$DEEDS/Seller_s_Residency.pdf" /tmp/forms_work/
```

### Step 7: Fill GIT/REP-3 using pikepdf

**IMPORTANT: Do NOT use fill_fillable_fields.py — it is broken (pypdf version incompatibility).
Always use pikepdf directly as shown below.**

Write and run the following Python script (substituting actual values for placeholders):

```python
import pikepdf
from pikepdf import Name

pdf = pikepdf.open("/tmp/forms_work/Seller_s_Residency.pdf")

text_values = {
    "Name":                        "[GRANTOR_NAMES (+ relationship if two grantors)]",
    "Add1":                        "[GRANTOR_STREET — no trailing comma]",
    "City Town Post Office":       "[GRANTOR_CITY — no trailing comma]",
    "State":                       "NJ",
    "ZIP Code":                    "[GRANTOR_ZIP]",
    "Block":                       "[BLOCK]",
    "Lot":                         "[LOT]",
    "Qual":                        "[QUALIFIER_OR_BLANK]",
    "Add2":                        "[PROPERTY_STREET — no trailing comma]",
    "City Town Post Office_2":     "[PROPERTY_MAILING_CITY — no trailing comma]",
    "State_2":                     "NJ",
    "ZIP Code_2":                  "[PROPERTY_ZIP]",
    "Sellers Percentage of Ownership": "100%",
    "Total Consideration":         "1.00",
    "Owners Share of Consideration": "1.00",
    "Closing Date":                "[SIGNING_DATE_OR_BLANK]",
}

# Checkboxes 1, 2, and 6 — always checked; on-state is /Yes
check_on = {"Check Box71a", "Check Box72a", "Check Box76a"}

for page in pdf.pages:
    if "/Annots" not in page:
        continue
    for annot_ref in page["/Annots"]:
        annot = annot_ref.get_object()
        if annot.get("/Subtype") != Name("/Widget"):
            continue
        field_name = str(annot.get("/T", "")).strip("()")
        ft = str(annot.get("/FT", ""))
        if ft == "/Tx" and field_name in text_values:
            annot["/V"] = text_values[field_name]
            if "/AP" in annot:
                del annot["/AP"]
        elif ft == "/Btn" and field_name in check_on:
            annot["/V"] = Name("/Yes")
            annot["/AS"] = Name("/Yes")

pdf.save("/tmp/forms_work/[LastName]_GIT_REP3.pdf")
print("GIT/REP-3 saved.")
```

---

## PART 3 — Fill the RTF-1

### Step 8: Set up RTF-1 and copy template
```bash
CONTEXT=$(find /sessions -maxdepth 3 -name "Claude Context" -type d 2>/dev/null | head -1)
DEEDS="$CONTEXT/Deeds"
cp "$DEEDS/Aff_of_Consideration.pdf" /tmp/forms_work/
```

### Step 9: Look up municipal code

Use the embedded NJ Municipal Code Table below (search by municipality name and county).
Match the property municipality and county to find the 4-digit code for the RTF-1.

### Step 10: Fill RTF-1 using pikepdf

**IMPORTANT: Do NOT use fill_fillable_fields.py — it is broken (pypdf version incompatibility).
Always use pikepdf directly as shown below.**

Municipality of Property Location uses municipality format rule (e.g., "Evesham Township").
Property Address uses mailing city (e.g., "Marlton"), not municipality name.
Deed Dated is always blank — never populate it from the original deed date.

Write and run the following Python script (substituting actual values for placeholders):

```python
import pikepdf
from pikepdf import Name

pdf = pikepdf.open("/tmp/forms_work/Aff_of_Consideration.pdf")

text_values = {
    "County":                          "Burlington",
    "County Municipal Code":           "[4-digit code from table below]",
    "Municipality of Property Location": "[MUNICIPALITY e.g. Evesham Township]",
    "Deponent Name":                   "[FIRST_GRANTOR_ONLY]",
    "Deponent Title":                  "Grantor",
    "Deed Dated":                      "",   # always blank — never populate
    "Block Number":                    "[BLOCK]",
    "Lot Number":                      "[LOT]",
    "Property Address":                "[PROPERTY_STREET], [PROPERTY_MAILING_CITY], NJ [PROPERTY_ZIP]",
    "Consideration Amount":            "1.00",
    "Full Exemption From Fee, Line 1": "For consideration of less than $100.",
    "Grantor Name":                    "[FIRST_GRANTOR_ONLY]",
    "Grantor Address at Time of Sale": "",
    "Deponent Address":                "",
}

# "No prior mortgage" checkbox — on-state for this form is /On (not /Yes)
# IMPORTANT: Only check the SHORT field name "No prior mortgage" (section 2 of form).
# Do NOT check "No prior mortgage assumed or to which property is subject at time of sale"
# (that is a different checkbox in section 7 — leave it unchecked).
# IMPORTANT: Do NOT delete the AP stream for RTF-1 checkboxes — viewers need it to render.
check_on = {"No prior mortgage"}

# Walk AcroForm field tree (sets root-level field values)
def walk_fields(fields):
    for field in fields:
        ft = str(field.get("/FT", ""))
        t = str(field.get("/T", "")).strip("()")
        kids = field.get("/Kids", None)
        if ft == "/Tx" and t in text_values:
            field["/V"] = text_values[t]
            if "/AP" in field:
                del field["/AP"]
        elif ft == "/Btn" and t in check_on:
            field["/V"] = Name("/On")
            field["/AS"] = Name("/On")
            # DO NOT delete AP stream — keep it so viewers render the checkmark
        if kids:
            walk_fields(kids)

if "/AcroForm" in pdf.Root and "/Fields" in pdf.Root.AcroForm:
    walk_fields(pdf.Root.AcroForm.Fields)

# Also walk page widget annotations (belt-and-suspenders — some viewers read these)
for page in pdf.pages:
    if "/Annots" not in page:
        continue
    for annot in page["/Annots"]:
        if str(annot.get("/Subtype", "")) != "/Widget":
            continue
        field_name = str(annot.get("/T", "")).strip("()")
        ft = str(annot.get("/FT", ""))
        if ft == "/Tx" and field_name in text_values:
            annot["/V"] = text_values[field_name]
            if "/AP" in annot:
                del annot["/AP"]
        elif ft == "/Btn" and field_name in check_on:
            annot["/V"] = Name("/On")
            annot["/AS"] = Name("/On")
            # DO NOT delete AP stream

pdf.save("/tmp/forms_work/[LastName]_RTF1.pdf")
print("RTF-1 saved.")
```

---

## PART 4 — Verify and Deliver

### Step 11: Verify PDFs visually

Use pdf2image at 200 DPI for readable verification (default resolution is too low):

```python
from pdf2image import convert_from_path
import os

for label, path, outdir in [
    ("GIT_REP3", "/tmp/forms_work/[LastName]_GIT_REP3.pdf", "/tmp/forms_work/verify_gitrep3"),
    ("RTF1",     "/tmp/forms_work/[LastName]_RTF1.pdf",      "/tmp/forms_work/verify_rtf1"),
]:
    os.makedirs(outdir, exist_ok=True)
    pages = convert_from_path(path, dpi=200)
    for i, page in enumerate(pages):
        page.save(f"{outdir}/page_{i+1}.png")
    print(f"{label}: {len(pages)} page(s) saved to {outdir}/")
```

Read the page 1 images of both to confirm field placement and checkbox states before delivering.

### Step 12: Copy to outputs and present
```bash
OUTPUTS=$(find /sessions -maxdepth 3 -name "outputs" -type d 2>/dev/null | head -1)
mkdir -p "$OUTPUTS/[LastName]"
cp /tmp/[LastName]_Deed.docx "$OUTPUTS/[LastName]/[LastName] Deed.docx"
cp /tmp/forms_work/[LastName]_GIT_REP3.pdf "$OUTPUTS/[LastName]/[LastName] - Seller's Residency.pdf"
cp /tmp/forms_work/[LastName]_RTF1.pdf "$OUTPUTS/[LastName]/[LastName] - Aff of Consideration.pdf"
```

Also copy to the Desktop/Deeds folder. This is a SEPARATE mounted folder — not Claude Context.
Find it dynamically:
```bash
DEEDS_FOLDER=$(find /sessions -maxdepth 3 -name "Deeds" -not -path "*/Claude Context/*" -type d 2>/dev/null | head -1)
```

If found, copy there:
```bash
mkdir -p "$DEEDS_FOLDER/[LastName]"
cp /tmp/[LastName]_Deed.docx "$DEEDS_FOLDER/[LastName]/[LastName] Deed.docx"
cp /tmp/forms_work/[LastName]_GIT_REP3.pdf "$DEEDS_FOLDER/[LastName]/[LastName] - Seller's Residency.pdf"
cp /tmp/forms_work/[LastName]_RTF1.pdf "$DEEDS_FOLDER/[LastName]/[LastName] - Aff of Consideration.pdf"
```

If the Deeds folder is not found, use `request_cowork_directory` to ask the user to connect it,
then re-run the copy step. Do NOT deliver to Claude Context/Deeds — that is the wrong location.

Then use present_files with all three completed files for download.

---

## Naming Convention
- `[LastName] Deed.docx`
- `[LastName] - Seller's Residency.pdf`
- `[LastName] - Aff of Consideration.pdf`

---

## GIT/REP-3 Checkbox Field IDs

| Box | Label | Field ID |
|-----|-------|----------|
| 1 | NJ resident taxpayer | Check Box71a |
| 2 | Principal residence | Check Box72a |
| 3 | Foreclosure | Check Box73a |
| 4 | Government agency | Check Box74a |
| 5 | Not individual/trust | Check Box75a |
| 6 | Consideration $1,000 or less | Check Box76a |
| 7a | 1031/721/1033 exchange | Check Box77a |
| 7b | Like-kind property | Check Box77aa |
| 8 | Executor/administrator | Check Box78a |
| 9 | Short sale | Check Box79a |
| 10 | Deed pre-Aug 2004 | Check Box710a |
| 11 | Relocation company | Check Box711a |
| 12 | Spouse/divorce | Check Box712a |
| 13 | Cemetery plot | Check Box713a |
| 14 | No net proceeds | Check Box714a |
| 15 | Retirement trust | Check Box715a |
| 16 | Armed forces | Check Box716aa |

---

## NJ Municipal Code Table

Search by municipality name (partial match is fine) and county. All 21 counties included.

### Atlantic County
0101 ABSECON CITY | 0102 ATLANTIC CITY | 0103 BRIGANTINE CITY | 0104 BUENA BORO |
0105 BUENA VISTA TWP | 0106 CORBIN CITY | 0107 EGG HARBOR CITY | 0108 EGG HARBOR TWP |
0109 ESTELL MANOR CITY | 0110 FOLSOM BORO | 0111 GALLOWAY TWP | 0112 HAMILTON TWP |
0113 HAMMONTON TOWN | 0114 LINWOOD CITY | 0115 LONGPORT BORO | 0116 MARGATE CITY |
0117 MULLICA TWP | 0118 NORTHFIELD CITY | 0119 PLEASANTVILLE CITY | 0120 PORT REPUBLIC CITY |
0121 SOMERS POINT CITY | 0122 VENTNOR CITY | 0123 WEYMOUTH TWP

### Bergen County
0201 ALLENDALE BORO | 0202 ALPINE BORO | 0203 BERGENFIELD BORO | 0204 BOGOTA BORO |
0205 CARLSTADT BORO | 0206 CLIFFSIDE PARK BORO | 0207 CLOSTER BORO | 0208 CRESSKILL BORO |
0209 DEMAREST BORO | 0210 DUMONT BORO | 0211 ELMWOOD PARK BORO | 0212 E RUTHERFORD BORO |
0213 EDGEWATER BORO | 0214 EMERSON BORO | 0215 ENGLEWOOD CITY | 0216 ENGLEWOOD CLIFFS BORO |
0217 FAIRLAWN BORO | 0218 FAIRVIEW BORO | 0219 FORT LEE BORO | 0220 FRANKLIN LAKES BORO |
0221 GARFIELD CITY | 0222 GLEN ROCK BORO | 0223 HACKENSACK CITY | 0224 HARRINGTON PARK BORO |
0225 HASBROUCK HEIGHTS BORO | 0226 HAWORTH BORO | 0227 HILLSDALE BORO | 0228 HOHOKUS BORO |
0229 LEONIA BORO | 0230 LITTLE FERRY BORO | 0231 LODI BORO | 0232 LYNDHURST TWP |
0233 MAHWAH TWP | 0234 MAYWOOD BORO | 0235 MIDLAND PARK BORO | 0236 MONTVALE BORO |
0237 MOONACHIE BORO | 0238 NEW MILFORD BORO | 0239 NORTH ARLINGTON BORO | 0240 NORTHVALE BORO |
0241 NORWOOD BORO | 0242 OAKLAND BORO | 0243 OLD TAPPAN BORO | 0244 ORADELL BORO |
0245 PALISADES PARK BORO | 0246 PARAMUS BORO | 0247 PARK RIDGE BORO | 0248 RAMSEY BORO |
0249 RIDGEFIELD BORO | 0250 RIDGEFIELD PARK VILLAGE | 0251 RIDGEWOOD VILLAGE |
0252 RIVEREDGE BORO | 0253 RIVERVALE TWP | 0254 ROCHELLE PARK TWP | 0255 ROCKLEIGH BORO |
0256 RUTHERFORD BORO | 0257 SADDLE BROOK TWP | 0258 SADDLE RIVER BORO |
0259 SO HACKENSACK TWP | 0260 TEANECK TWP | 0261 TENAFLY BORO | 0262 TETERBORO BORO |
0263 UPPER SADDLE RIVER BORO | 0264 WALDWICK BORO | 0265 WALLINGTON BORO |
0266 WASHINGTON TWP | 0267 WESTWOOD BORO | 0268 WOODCLIFF LAKE BORO |
0269 WOOD RIDGE BORO | 0270 WYCKOFF TWP

### Burlington County
0301 BASS RIVER TWP | 0302 BEVERLY CITY | 0303 BORDENTOWN CITY | 0304 BORDENTOWN TWP |
0305 BURLINGTON CITY | 0306 BURLINGTON TWP | 0307 CHESTERFIELD TWP | 0308 CINNAMINSON TWP |
0309 DELANCO TWP | 0310 DELRAN TWP | 0311 EASTAMPTON TWP | 0312 EDGEWATER PARK TWP |
0313 EVESHAM TWP | 0314 FIELDSBORO BORO | 0315 FLORENCE TWP | 0316 HAINESPORT TWP |
0317 LUMBERTON TWP | 0318 MANSFIELD TWP | 0319 MAPLE SHADE TWP | 0320 MEDFORD TWP |
0321 MEDFORD LAKES BORO | 0322 MOORESTOWN TWP | 0323 MT HOLLY TWP | 0324 MT LAUREL TWP |
0325 NEW HANOVER TWP | 0326 NO HANOVER TWP | 0327 PALMYRA BORO | 0328 PEMBERTON BORO |
0329 PEMBERTON TWP | 0330 RIVERSIDE TWP | 0331 RIVERTON BORO | 0332 SHAMONG TWP |
0333 SOUTHAMPTON TWP | 0334 SPRINGFIELD TWP | 0335 TABERNACLE TWP | 0336 WASHINGTON TWP |
0337 WESTAMPTON TWP | 0338 WILLINGBORO TWP | 0339 WOODLAND TWP | 0340 WRIGHTSTOWN BORO

### Camden County
0401 AUDUBON BORO | 0402 AUDUBON PARK BORO | 0403 BARRINGTON BORO | 0404 BELLMAWR BORO |
0405 BERLIN BORO | 0406 BERLIN TWP | 0407 BROOKLAWN BORO | 0408 CAMDEN CITY |
0409 CHERRY HILL TWP | 0410 CHESILHURST BORO | 0411 CLEMENTON BORO | 0412 COLLINGSWOOD BORO |
0413 GIBBSBORO BORO | 0414 GLOUCESTER CITY | 0415 GLOUCESTER TWP | 0416 HADDON TWP |
0417 HADDONFIELD BORO | 0418 HADDON HEIGHTS BORO | 0419 HI NELLA BORO |
0420 LAUREL SPRINGS BORO | 0421 LAWNSIDE BORO | 0422 LINDENWOLD BORO | 0423 MAGNOLIA BORO |
0424 MERCHANTVILLE BORO | 0425 MOUNT EPHRAIM BORO | 0426 OAKLYN BORO |
0427 PENNSAUKEN TWP | 0428 PINE HILL BORO | 0430 RUNNEMEDE BORO | 0431 SOMERDALE BORO |
0432 STRATFORD BORO | 0433 TAVISTOCK BORO | 0434 VOORHEES TWP | 0435 WATERFORD TWP |
0436 WINSLOW TWP | 0437 WOODLYNNE BORO

### Cape May County
0501 AVALON BORO | 0502 CAPE MAY CITY | 0503 CAPE MAY POINT BORO | 0504 DENNIS TWP |
0505 LOWER TWP | 0506 MIDDLE TWP | 0507 NORTH WILDWOOD CITY | 0508 OCEAN CITY |
0509 SEA ISLE CITY | 0510 STONE HARBOR BORO | 0511 UPPER TWP | 0512 WEST CAPE MAY BORO |
0513 WEST WILDWOOD BORO | 0514 WILDWOOD CITY | 0515 WILDWOOD CREST BORO | 0516 WOODBINE BORO

### Cumberland County
0601 BRIDGETON CITY | 0602 COMMERCIAL TWP | 0603 DEERFIELD TWP | 0604 DOWNE TWP |
0605 FAIRFIELD TWP | 0606 GREENWICH TWP | 0607 HOPEWELL TWP | 0608 LAWRENCE TWP |
0609 MAURICE RIVER TWP | 0610 MILLVILLE CITY | 0611 SHILOH BORO | 0612 STOW CREEK TWP |
0613 UPPER DEERFIELD TWP | 0614 VINELAND CITY

### Essex County
0701 BELLEVILLE TWP | 0702 BLOOMFIELD TWP | 0703 CALDWELL BORO | 0704 CEDAR GROVE TWP |
0705 EAST ORANGE CITY | 0706 ESSEX FELLS TWP | 0707 FAIRFIELD TWP | 0708 GLEN RIDGE BORO |
0709 IRVINGTON TWP | 0710 LIVINGSTON TWP | 0711 MAPLEWOOD TWP | 0712 MILLBURN TWP |
0713 MONTCLAIR TWP | 0714 NEWARK CITY | 0715 NORTH CALDWELL TWP | 0716 NUTLEY TWP |
0717 ORANGE CITY TWP | 0718 ROSELAND BORO | 0719 SOUTH ORANGE VILLAGE TWP |
0720 VERONA TWP | 0721 WEST CALDWELL TWP | 0722 WEST ORANGE TWP

### Gloucester County
0801 CLAYTON BORO | 0802 DEPTFORD TWP | 0803 EAST GREENWICH TWP | 0804 ELK TWP |
0805 FRANKLIN TWP | 0806 GLASSBORO BORO | 0807 GREENWICH TWP | 0808 HARRISON TWP |
0809 LOGAN TWP | 0810 MANTUA TWP | 0811 MONROE TWP | 0812 NATIONAL PARK BORO |
0813 NEWFIELD BORO | 0814 PAULSBORO BORO | 0815 PITMAN BORO | 0816 SO HARRISON TWP |
0817 SWEDESBORO BORO | 0818 WASHINGTON TWP | 0819 WENONAH BORO | 0820 WEST DEPTFORD TWP |
0821 WESTVILLE BORO | 0822 WOODBURY CITY | 0823 WOODBURY HEIGHTS BORO | 0824 WOOLWICH TWP

### Hudson County
0901 BAYONNE CITY | 0902 EAST NEWARK BORO | 0903 GUTTENBERG TOWN | 0904 HARRISON TOWN |
0905 HOBOKEN CITY | 0906 JERSEY CITY | 0907 KEARNY TOWN | 0908 NORTH BERGEN TWP |
0909 SECAUCUS TOWN | 0910 UNION CITY | 0911 WEEHAWKEN TWP | 0912 WEST NEW YORK TOWN

### Hunterdon County
1001 ALEXANDRIA TWP | 1002 BETHLEHEM TWP | 1003 BLOOMSBURY BORO | 1004 CALIFON BORO |
1005 CLINTON TOWN | 1006 CLINTON TWP | 1007 DELAWARE TWP | 1008 EAST AMWELL TWP |
1009 FLEMINGTON BORO | 1010 FRANKLIN TWP | 1011 FRENCHTOWN BORO | 1012 GLEN GARDNER BORO |
1013 HAMPTON BORO | 1014 HIGH BRIDGE BORO | 1015 HOLLAND TWP | 1016 KINGWOOD TWP |
1017 LAMBERTVILLE CITY | 1018 LEBANON BORO | 1019 LEBANON TWP | 1020 MILFORD BORO |
1021 RARITAN TWP | 1022 READINGTON TWP | 1023 STOCKTON BORO | 1024 TEWKSBURY TWP |
1025 UNION TWP | 1026 WEST AMWELL TWP

### Mercer County
1101 EAST WINDSOR TWP | 1102 EWING TWP | 1103 HAMILTON TWP | 1104 HIGHTSTOWN BORO |
1105 HOPEWELL BORO | 1106 HOPEWELL TWP | 1107 LAWRENCE TWP | 1108 PENNINGTON BORO |
1111 TRENTON CITY | 1112 ROBBINSVILLE TWP | 1113 WEST WINDSOR TWP | 1114 PRINCETON

### Middlesex County
1201 CARTERET BORO | 1202 CRANBURY TWP | 1203 DUNELLEN BORO | 1204 EAST BRUNSWICK TWP |
1205 EDISON TWP | 1206 HELMETTA BORO | 1207 HIGHLAND PARK BORO | 1208 JAMESBURG BORO |
1209 METUCHEN BORO | 1210 MIDDLESEX BORO | 1211 MILLTOWN BORO | 1212 MONROE TWP |
1213 NEW BRUNSWICK CITY | 1214 NORTH BRUNSWICK TWP | 1215 OLD BRIDGE TWP |
1216 PERTH AMBOY CITY | 1217 PISCATAWAY TWP | 1218 PLAINSBORO TWP | 1219 SAYREVILLE BORO |
1220 SOUTH AMBOY CITY | 1221 SOUTH BRUNSWICK TWP | 1222 SOUTH PLAINFIELD BORO |
1223 SOUTH RIVER BORO | 1224 SPOTSWOOD BORO | 1225 WOODBRIDGE TWP

### Monmouth County
1301 ABERDEEN TWP | 1302 ALLENHURST BORO | 1303 ALLENTOWN BORO | 1304 ASBURY PARK CITY |
1305 ATLANTIC HIGHLANDS BORO | 1306 AVON BY THE SEA BORO | 1307 BELMAR BORO |
1308 BRADLEY BEACH BORO | 1309 BRIELLE BORO | 1310 COLTS NECK TWP | 1311 DEAL BORO |
1312 EATONTOWN BORO | 1313 ENGLISHTOWN BORO | 1314 FAIR HAVEN BORO | 1315 FARMINGDALE BORO |
1316 FREEHOLD BORO | 1317 FREEHOLD TWP | 1318 HAZLET TWP | 1319 HIGHLANDS BORO |
1320 HOLMDEL TWP | 1321 HOWELL TWP | 1322 INTERLAKEN BORO | 1323 KEANSBURG BORO |
1324 KEYPORT BORO | 1325 LITTLE SILVER BORO | 1326 LOCH ARBOUR VILLAGE |
1327 LONG BRANCH CITY | 1328 MANALAPAN TWP | 1329 MANASQUAN BORO | 1330 MARLBORO TWP |
1331 MATAWAN BORO | 1332 MIDDLETOWN TWP | 1333 MILLSTONE TWP | 1334 MONMOUTH BEACH BORO |
1335 NEPTUNE TWP | 1336 NEPTUNE CITY BORO | 1337 OCEAN TWP | 1338 OCEANPORT BORO |
1339 RED BANK BORO | 1340 ROOSEVELT BORO | 1341 RUMSON BORO | 1342 SEA BRIGHT BORO |
1343 SEA GIRT BORO | 1344 SHREWSBURY BORO | 1345 SHREWSBURY TWP | 1346 LAKE COMO BORO |
1347 SPRING LAKE BORO | 1348 SPRING LAKE HEIGHTS BORO | 1349 TINTON FALLS BORO |
1350 UNION BEACH BORO | 1351 UPPER FREEHOLD TWP | 1352 WALL TWP |
1353 WEST LONG BRANCH BORO

### Morris County
1401 BOONTON TOWN | 1402 BOONTON TWP | 1403 BUTLER BORO | 1404 CHATHAM BORO |
1405 CHATHAM TWP | 1406 CHESTER BORO | 1407 CHESTER TWP | 1408 DENVILLE TWP |
1409 DOVER TOWN | 1410 EAST HANOVER TWP | 1411 FLORHAM PARK BORO | 1412 HANOVER TWP |
1413 HARDING TWP | 1414 JEFFERSON TWP | 1415 KINNELON BORO | 1416 LINCOLN PARK BORO |
1417 MADISON BORO | 1418 MENDHAM BORO | 1419 MENDHAM TWP | 1420 MINE HILL TWP |
1421 MONTVILLE TWP | 1422 MORRIS TWP | 1423 MORRIS PLAINS BORO | 1424 MORRISTOWN TOWN |
1425 MOUNTAIN LAKES BORO | 1426 MOUNT ARLINGTON BORO | 1427 MOUNT OLIVE TWP |
1428 NETCONG BORO | 1429 PARSIPPANY-TROY HILLS TWP | 1430 LONG HILL TWP |
1431 PEQUANNOCK TWP | 1432 RANDOLPH TWP | 1433 RIVERDALE BORO | 1434 ROCKAWAY BORO |
1435 ROCKAWAY TWP | 1436 ROXBURY TWP | 1437 VICTORY GARDENS BORO | 1438 WASHINGTON TWP |
1439 WHARTON BORO

### Ocean County
1501 BARNEGAT TWP | 1502 BARNEGAT LIGHT BORO | 1503 BAY HEAD BORO | 1504 BEACH HAVEN BORO |
1505 BEACHWOOD BORO | 1506 BERKELEY TWP | 1507 BRICK TWP | 1508 TOMS RIVER TWP |
1509 EAGLESWOOD TWP | 1510 HARVEY CEDARS BORO | 1511 ISLAND HEIGHTS BORO |
1512 JACKSON TWP | 1513 LACEY TWP | 1514 LAKEHURST BORO | 1515 LAKEWOOD TWP |
1516 LAVALLETTE BORO | 1517 LITTLE EGG HARBOR TWP | 1518 LONG BEACH TWP |
1519 MANCHESTER TWP | 1520 MANTOLOKING BORO | 1521 OCEAN TWP | 1522 OCEAN GATE BORO |
1523 PINE BEACH BORO | 1524 PLUMSTED TWP | 1525 POINT PLEASANT BORO |
1526 PT PLEASANT BEACH BORO | 1527 SEASIDE HEIGHTS BORO | 1528 SEASIDE PARK BORO |
1529 SHIP BOTTOM BORO | 1530 SOUTH TOMS RIVER BORO | 1531 STAFFORD TWP |
1532 SURF CITY BORO | 1533 TUCKERTON BORO

### Passaic County
1601 BLOOMINGDALE BORO | 1602 CLIFTON CITY | 1603 HALEDON BORO | 1604 HAWTHORNE BORO |
1605 LITTLE FALLS TWP | 1606 NORTH HALEDON BORO | 1607 PASSAIC CITY | 1608 PATERSON CITY |
1609 POMPTON LAKES BORO | 1610 PROSPECT PARK BORO | 1611 RINGWOOD BORO | 1612 TOTOWA BORO |
1613 WANAQUE BORO | 1614 WAYNE TWP | 1615 WEST MILFORD TWP | 1616 WOODLAND PARK BORO

### Salem County
1701 ALLOWAY TWP | 1702 CARNEYS POINT TWP | 1703 ELMER BORO | 1704 ELSINBORO TWP |
1705 LOWER ALLOWAY CREEK TWP | 1706 MANNINGTON TWP | 1707 OLDMANS TWP |
1708 PENNS GROVE BORO | 1709 PENNSVILLE TWP | 1710 PILESGROVE TWP | 1711 PITTSGROVE TWP |
1712 QUINTON TWP | 1713 SALEM CITY | 1714 UPPER PITTSGROVE TWP | 1715 WOODSTOWN BORO

### Somerset County
1801 BEDMINSTER TWP | 1802 BERNARDS TWP | 1803 BERNARDSVILLE BORO | 1804 BOUND BROOK BORO |
1805 BRANCHBURG TWP | 1806 BRIDGEWATER TWP | 1807 FAR HILLS BORO | 1808 FRANKLIN TWP |
1809 GREEN BROOK TWP | 1810 HILLSBOROUGH TWP | 1811 MANVILLE BORO | 1812 MILLSTONE BORO |
1813 MONTGOMERY TWP | 1814 NORTH PLAINFIELD BORO | 1815 PEAPACK GLADSTONE BORO |
1816 RARITAN BORO | 1817 ROCKY HILL BORO | 1818 SOMERVILLE BORO |
1819 SO BOUND BROOK BORO | 1820 WARREN TWP | 1821 WATCHUNG BORO

### Sussex County
1901 ANDOVER BORO | 1902 ANDOVER TWP | 1903 BRANCHVILLE BORO | 1904 BYRAM TWP |
1905 FRANKFORD TWP | 1906 FRANKLIN BORO | 1907 FREDON TWP | 1908 GREEN TWP |
1909 HAMBURG BORO | 1910 HAMPTON TWP | 1911 HARDYSTON TWP | 1912 HOPATCONG BORO |
1913 LAFAYETTE TWP | 1914 MONTAGUE TWP | 1915 NEWTON TOWN | 1916 OGDENSBURG BORO |
1917 SANDYSTON TWP | 1918 SPARTA TWP | 1919 STANHOPE BORO | 1920 STILLWATER TWP |
1921 SUSSEX BORO | 1922 VERNON TWP | 1923 WALPACK TWP | 1924 WANTAGE TWP

### Union County
2001 BERKELEY HEIGHTS TWP | 2002 CLARK TWP | 2003 CRANFORD TWP | 2004 ELIZABETH CITY |
2005 FANWOOD BORO | 2006 GARWOOD BORO | 2007 HILLSIDE TWP | 2008 KENILWORTH BORO |
2009 LINDEN CITY | 2010 MOUNTAINSIDE BORO | 2011 NEW PROVIDENCE BORO | 2012 PLAINFIELD CITY |
2013 RAHWAY CITY | 2014 ROSELLE BORO | 2015 ROSELLE PARK BORO | 2016 SCOTCH PLAINS TWP |
2017 SPRINGFIELD TWP | 2018 SUMMIT CITY | 2019 UNION TWP | 2020 WESTFIELD TOWN |
2021 WINFIELD TWP

### Warren County
2101 ALLAMUCHY TWP | 2102 ALPHA BORO | 2103 BELVIDERE TOWN | 2104 BLAIRSTOWN TWP |
2105 FRANKLIN TWP | 2106 FRELINGHUYSEN TWP | 2107 GREENWICH TWP | 2108 HACKETTSTOWN TOWN |
2109 HARDWICK TWP | 2110 HARMONY TWP | 2111 HOPE TWP | 2112 INDEPENDENCE TWP |
2113 KNOWLTON TWP | 2114 LIBERTY TWP | 2115 LOPATCONG TWP | 2116 MANSFIELD TWP |
2117 OXFORD TWP | 2119 PHILLIPSBURG TOWN | 2120 POHATCONG TWP | 2121 WASHINGTON BORO |
2122 WASHINGTON TWP | 2123 WHITE TWP

---

## Common Mistakes to Avoid

- Never edit the original unpacked deed folder — always work on the copy at /tmp/new_deed/
- Grantor name appears in multiple places: BETWEEN line, signature block, and I CERTIFY paragraph
- Single grantor: remove both signature line paragraph and name label paragraph using w14:paraId;
  change "Grantors sign" → "Grantor signs"; "were the makers" → "was the maker";
  "their own act" → "his/her own act"
- Municipality format: always "[Name] Township/Borough/City" — applies everywhere municipality appears
- Notary COUNTY OF: always BURLINGTON regardless of property county
- Page breaks: always add `<w:pageBreakBefore/>` to Signatures and Legal Description paragraphs.
  The template has many blank spacer paragraphs before Signatures (~36) and Legal Description (~17).
  These MUST be removed, or `pageBreakBefore` will create a blank page before each section.
  Keep only 1 blank paragraph before each. Remove the rest using their w14:paraId values.
- Qualifier is not always present — omit from Tax Map Reference if not applicable
- BEING line: use Second Party (Grantee) from the cover sheet — NOT First Party (Grantor),
  and NOT older chain-of-title entries in the deed body
- Trust date: use signing date if provided; otherwise `_____________, ______`
- RTF-1 deponent and grantor name = first grantor only, even if two grantors on deed
- GIT/REP-3 name field = both grantors with relationship; single grantor = name only
- Always verify PDF output visually before delivering (use pdf2image at 200 DPI — default is too low)
- Signature, date, and SSN fields on both forms are left blank for manual completion
- RTF-1 Property Address and GIT/REP-3 property city: always mailing city — never municipality name
- GIT/REP-3 address fields: no trailing commas
- Path setup: always run Step 0 path discovery at the start of every bash block
- Templates: do not upload — they are already at $DEEDS (dynamic path to Claude Context/Deeds/)
- **fill_fillable_fields.py is broken** (pypdf version mismatch — AttributeError on get_inherited);
  always use pikepdf directly as shown in Steps 7 and 10
- RTF-1 Deed Dated: always blank — never populate from the original deed date
- RTF-1 "No prior mortgage" checkbox on-state is /On (not /Yes like GIT/REP-3)
