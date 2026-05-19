#!/usr/bin/env python3
"""
NJ Deed PDF form filler using pikepdf.
Usage: python3 fill_pdfs.py <cmd> <json_data> <templates_dir> <output_path>

IMPORTANT: Do NOT use pdf-lib or fill_fillable_fields.py — they have version
incompatibility issues. Always use pikepdf directly as implemented here.
"""
import sys
import json
import os
import pikepdf
from pikepdf import Name


def ensure_municipality_format(municipality):
    """Enforce '[Name] Township/Borough/City' format — never 'Township of [Name]'."""
    if not municipality:
        return municipality
    suffixes = ['Township', 'Borough', 'City', 'Town', 'Village']
    if any(municipality.endswith(s) for s in suffixes):
        return municipality
    return municipality + ' Township'


def parse_addr(addr, grantor_zip=''):
    """Split 'Street, City, State ZIP' into components."""
    parts = [p.strip() for p in addr.split(',')]
    street = parts[0] if parts else ''
    city   = parts[1] if len(parts) > 1 else ''
    zip_   = grantor_zip or (parts[2].split()[-1] if len(parts) > 2 else '')
    return street, city, zip_


# ── GIT/REP-3 (Seller's Residency Certification) ─────────────────────────────
def fill_residency(data, template_path, output_path):
    """Fill GIT/REP-3 per skill Step 7. On-state for checkboxes is /Yes."""
    pdf = pikepdf.open(template_path)

    grantor  = data.get('grantor', '')
    grantor2 = data.get('grantor2', '')
    relationship = data.get('relationship', '')

    # Name field: both grantors + relationship if two; single = name only
    if grantor2:
        rel = (', ' + relationship) if relationship else ''
        name_field = f"{grantor} and {grantor2}{rel}"
    else:
        name_field = grantor

    g_street, g_city, g_zip = parse_addr(data.get('grantorAddr', ''), data.get('grantorZip', ''))
    p_street, p_city_auto, p_zip_auto = parse_addr(data.get('propAddr', ''))
    prop_city = data.get('propCity', p_city_auto)   # mailing city, not municipality
    prop_zip  = data.get('propZip', p_zip_auto)

    # GIT/REP-3 address fields: no trailing commas (form layout handles them)
    text_values = {
        "Name":                              name_field,
        "Add1":                              g_street,
        "City Town Post Office":             g_city,
        "State":                             "NJ",
        "ZIP Code":                          g_zip,
        "Block":                             data.get('block', ''),
        "Lot":                               data.get('lot', ''),
        "Qual":                              data.get('qualifier', ''),
        "Add2":                              p_street,
        "City Town Post Office_2":           prop_city,
        "State_2":                           "NJ",
        "ZIP Code_2":                        prop_zip,
        "Sellers Percentage of Ownership":   "100%",
        "Total Consideration":               "1.00",
        "Owners Share of Consideration":     "1.00",
        "Closing Date":                      data.get('signingDate', ''),
    }

    # Checkboxes 1, 2, 6 always checked — on-state is /Yes for GIT/REP-3
    check_on = {"Check Box71a", "Check Box72a", "Check Box76a"}

    # Walk AcroForm field tree first (same belt-and-suspenders pattern as RTF-1)
    def walk_res_fields(fields):
        for field in fields:
            ft = str(field.get("/FT", ""))
            t  = str(field.get("/T",  "")).strip("()")
            kids = field.get("/Kids", None)
            if ft == "/Tx" and t in text_values:
                field["/V"] = text_values[t]
                if "/AP" in field:
                    del field["/AP"]
            elif ft == "/Btn" and t in check_on:
                field["/V"] = Name("/Yes")
                field["/AS"] = Name("/Yes")
            if kids:
                walk_res_fields(kids)

    if "/AcroForm" in pdf.Root and "/Fields" in pdf.Root.AcroForm:
        walk_res_fields(pdf.Root.AcroForm.Fields)

    # Also walk page widget annotations (pikepdf 10.x: items auto-dereference)
    for page in pdf.pages:
        if "/Annots" not in page:
            continue
        for annot in page["/Annots"]:
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

    pdf.save(output_path)
    print(f"GIT/REP-3 saved to {output_path}")


# ── RTF-1 (Affidavit of Consideration) ───────────────────────────────────────
def fill_affidavit(data, template_path, output_path):
    """Fill RTF-1 per skill Step 10.
    CRITICAL differences from GIT/REP-3:
    - County is always Burlington (closing county, not property county)
    - Deponent/Grantor = first grantor only (even if two grantors)
    - Deed Dated: always blank — never populate from original deed date
    - 'No prior mortgage' on-state is /On (NOT /Yes)
    - Do NOT delete AP stream for RTF-1 checkboxes — viewers need it
    """
    pdf = pikepdf.open(template_path)

    grantor = data.get('grantor', '')   # first grantor only for RTF-1

    p_street, p_city_auto, p_zip_auto = parse_addr(data.get('propAddr', ''))
    prop_city = data.get('propCity', p_city_auto)   # mailing city
    prop_zip  = data.get('propZip', p_zip_auto)
    full_prop_addr = f"{p_street}, {prop_city}, NJ {prop_zip}".strip(', ')

    municipality = ensure_municipality_format(data.get('municipality', ''))

    text_values = {
        "County":                            "Burlington",   # always Burlington per skill
        "County Municipal Code":             data.get('countyMunicipalCode', ''),
        "Municipality of Property Location": municipality,
        "Deponent Name":                     grantor,
        "Deponent Title":                    "Grantor",
        "Deed Dated":                        "",             # always blank per skill
        "Block Number":                      data.get('block', ''),
        "Lot Number":                        data.get('lot', ''),
        "Property Address":                  full_prop_addr,
        "Consideration Amount":              "1.00",
        "Full Exemption From Fee, Line 1":   "For consideration of less than $100.",
        "Grantor Name":                      grantor,
        "Grantor Address at Time of Sale":   "",             # always blank per skill
        "Deponent Address":                  "",             # always blank per skill
    }

    # Only check the SHORT field name "No prior mortgage" (section 2).
    # Do NOT check "No prior mortgage assumed or to which property is subject at time of sale"
    # (section 7 — different checkbox, leave unchecked).
    check_on = {"No prior mortgage"}

    def walk_fields(fields):
        for field in fields:
            ft = str(field.get("/FT", ""))
            t  = str(field.get("/T",  "")).strip("()")
            kids = field.get("/Kids", None)
            if ft == "/Tx" and t in text_values:
                field["/V"] = text_values[t]
                if "/AP" in field:
                    del field["/AP"]
            elif ft == "/Btn" and t in check_on:
                field["/V"] = Name("/On")
                field["/AS"] = Name("/On")
                # DO NOT delete AP stream — viewers need it to render the checkmark
            if kids:
                walk_fields(kids)

    if "/AcroForm" in pdf.Root and "/Fields" in pdf.Root.AcroForm:
        walk_fields(pdf.Root.AcroForm.Fields)

    # Belt-and-suspenders: also walk page widget annotations
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

    pdf.save(output_path)
    print(f"RTF-1 saved to {output_path}")


if __name__ == "__main__":
    if len(sys.argv) != 5:
        print("Usage: python3 fill_pdfs.py <cmd> <json_data> <templates_dir> <output_path>")
        sys.exit(1)

    cmd           = sys.argv[1]
    data          = json.loads(sys.argv[2])
    templates_dir = sys.argv[3]
    output_path   = sys.argv[4]

    if cmd == 'residency':
        template = os.path.join(templates_dir, 'residency-template.pdf')
        fill_residency(data, template, output_path)
    elif cmd == 'affidavit':
        template = os.path.join(templates_dir, 'affidavit-template.pdf')
        fill_affidavit(data, template, output_path)
    else:
        print(f"Unknown command: {cmd}", file=sys.stderr)
        sys.exit(1)
