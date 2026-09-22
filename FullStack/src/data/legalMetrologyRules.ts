export interface LegalRuleDetail {
  id: string;
  clause: string;
  title: string;
  mandatoryRequirement: string;
  exactStatutoryText: string;
  penaltySection: string;
  penaltyFineRange: string;
  standardFormats: string[];
  commonViolations: string[];
}

export const LEGAL_METROLOGY_RULES_2011: LegalRuleDetail[] = [
  {
    id: 'rule_6_1_a',
    clause: 'Rule 6(1)(a)',
    title: 'Generic or Common Name of Commodity',
    mandatoryRequirement: 'The generic or common name of the commodity contained in the package must be clearly stated.',
    exactStatutoryText: 'Every package shall bear the name and address of the manufacturer or packer or importer and the generic or common name of the commodity contained in the package.',
    penaltySection: 'Section 36(1), Legal Metrology Act, 2009',
    penaltyFineRange: '₹25,000 (1st offense) up to ₹50,000 (2nd) or ₹1,00,000 / imprisonment (subsequent)',
    standardFormats: ['"Almond Butter"', '"Shampoo for Normal Hair"', '"Wheat Flour (Atta)"'],
    commonViolations: ['Only trade brand name printed without generic definition', 'Misleading generic description']
  },
  {
    id: 'rule_6_1_b',
    clause: 'Rule 6(1)(b) & Rule 12',
    title: 'Net Quantity & Standard Units with Unit Sale Price',
    mandatoryRequirement: 'Net quantity must be declared in standard SI metric units (g, kg, ml, l, or number) without ambiguous qualifiers like "approx", "when packed", or non-standard symbols.',
    exactStatutoryText: 'The net quantity, in terms of the standard unit of weight or measure, of the commodity contained in the package or where the commodity is packed or sold by number, the number of the commodity contained in the package shall be mentioned.',
    penaltySection: 'Section 36(1) read with Rule 12 & 24',
    penaltyFineRange: '₹25,000 to ₹1,00,000',
    standardFormats: ['"Net Qty: 500 g"', '"Net Quantity: 1.0 L (Unit Sale Price: ₹0.22 / ml)"', '"Net Weight: 250 g"'],
    commonViolations: ['Using non-metric units like "Oz" or "Lbs" only', 'Missing Unit Sale Price (USP) for items > 100g/ml or multi-packs', 'Writing "approx 500g"']
  },
  {
    id: 'rule_6_1_c',
    clause: 'Rule 6(1)(c)',
    title: 'Month and Year of Manufacture / Pre-packing / Import',
    mandatoryRequirement: 'The month and year in which the commodity is manufactured or pre-packed or imported must be explicitly declared.',
    exactStatutoryText: 'The month and year in which the commodity is manufactured or pre-packed or imported shall be mentioned in letters and numerals.',
    penaltySection: 'Section 36(1), Legal Metrology Act, 2009',
    penaltyFineRange: '₹25,000 to ₹1,00,000',
    standardFormats: ['"Mfg Date: 03/2025"', '"Packed on: March 2025"', '"Month/Year of Import: 11/2024"'],
    commonViolations: ['Only batch number printed without clear manufacturing month/year', 'Ambiguous 2-digit years with unclear month format']
  },
  {
    id: 'rule_6_1_e',
    clause: 'Rule 6(1)(e) & Rule 6(11)',
    title: 'Maximum Retail Price (MRP) & Unit Sale Price Declaration',
    mandatoryRequirement: 'MRP must be prominently declared in Indian Rupees with the mandatory statutory phrase "(inclusive of all taxes)" or "incl. of all taxes". Declaring taxes extra is strictly illegal.',
    exactStatutoryText: 'The retail sale price of the package shall be clearly indicated in the form: Maximum or Max. Retail Price Rs. ...... or ₹ ...... inclusive of all taxes, or in the form of MRP Rs. ...... / ₹ ...... incl. of all taxes.',
    penaltySection: 'Section 36(1) & Section 36(2) [Dual pricing penalty]',
    penaltyFineRange: '₹25,000 to ₹1,00,000',
    standardFormats: ['"MRP ₹ 249.00 (incl. of all taxes)"', '"MRP Rs. 99.00 (inclusive of all taxes) Unit Sale Price: ₹0.50/g"'],
    commonViolations: ['Writing "MRP Rs. 150 + GST extra"', 'Missing the mandatory "(inclusive of all taxes)" phrase', 'Altered or over-stickered price without regulatory authorization']
  },
  {
    id: 'rule_6_1_f',
    clause: 'Rule 6(1)(f)',
    title: 'Consumer Care Contact Details',
    mandatoryRequirement: 'Name, complete address, telephone number, and email address of the person or officer who can be contacted by the consumer in case of complaints.',
    exactStatutoryText: 'The name, address, telephone number and e-mail address of the person who can be or the office which can be contacted, in case of consumer complaints, shall be mentioned on the package.',
    penaltySection: 'Section 36(1), Legal Metrology Act, 2009',
    penaltyFineRange: '₹25,000 to ₹1,00,000',
    standardFormats: ['"For Consumer Complaints, contact: Consumer Care Executive, Address: ..., Tel: 1800-XXX-XXXX, Email: care@brand.in"'],
    commonViolations: ['Only a website or QR code without physical telephone and email', 'Missing executive designation or physical contact address']
  },
  {
    id: 'rule_6_1_g',
    clause: 'Rule 6(1)(g) & Rule 6(1)(d)',
    title: 'Name & Address of Manufacturer / Packer / Importer & Country of Origin',
    mandatoryRequirement: 'Complete physical address (with street, city, pin code) of manufacturer/importer and Country of Origin (mandatory for all imported goods under 2017 & 2020 amendments).',
    exactStatutoryText: 'The name and complete address of the manufacturer, or where the manufacturer is not the packer, the name and complete address of the manufacturer and packer, and for imported goods, the country of origin shall be stated.',
    penaltySection: 'Section 36(1) & Customs / Legal Metrology Cross-Enforcement',
    penaltyFineRange: '₹25,000 to ₹1,00,000',
    standardFormats: ['"Manufactured & Packed by: GreenLife Organics Pvt Ltd, Plot 42, Industrial Area, Pune 411028, Maharashtra, India. Country of Origin: India"'],
    commonViolations: ['Missing Country of Origin on imported commodities', 'Incomplete address (e.g. only city name without registered premises or PIN code)']
  },
  {
    id: 'rule_9_1',
    clause: 'Rule 9(1) & First Schedule',
    title: 'Minimum Font Height & Principal Display Panel Proportions',
    mandatoryRequirement: 'The height of letters and numerals on the principal display panel must satisfy minimum prescribed millimeter dimensions according to packaging area (e.g., Area > 100 cm² to 500 cm² requires min 2.0 mm to 4.0 mm numerals for quantity).',
    exactStatutoryText: 'The height of any numeral and letter in the declaration on the principal display panel shall not be less than the minimum height specified in the table in the First Schedule.',
    penaltySection: 'Section 36(1) read with Rule 9',
    penaltyFineRange: '₹25,000 to ₹50,000',
    standardFormats: ['Package Area 100-500cm²: Font Height >= 2.5mm', 'Package Area > 500cm²: Font Height >= 4.0mm'],
    commonViolations: ['Tiny illegible net quantity or MRP font sizes tucked under folds or seams']
  },
  {
    id: 'LMPC_6_11_USP',
    clause: 'Rule 6(11)',
    title: 'Unit Sale Price Declaration',
    mandatoryRequirement: 'The unit sale price in rupees rounded off to the nearest two decimal places shall be declared on every package where the net quantity is more than one unit or specified measure.',
    exactStatutoryText: 'The unit sale price in rupees rounded off to the nearest two decimal places shall be declared on every package.',
    penaltySection: 'Section 36(1), Legal Metrology Act, 2009',
    penaltyFineRange: '₹25,000 to ₹1,00,000',
    standardFormats: ['Rs. XX.XX per g / kg / ml / l / unit'],
    commonViolations: ['Missing Unit Sale Price declaration on multi-unit or non-standard metric packages']
  }
];

export function getRuleByClause(clauseId: string): LegalRuleDetail | undefined {
  if (!clauseId) return undefined;
  const target = clauseId.toLowerCase().trim();
  const exact = LEGAL_METROLOGY_RULES_2011.find(r => {
    return r.clause.toLowerCase() === target || r.id.toLowerCase() === target;
  });
  if (exact) return exact;
  return LEGAL_METROLOGY_RULES_2011.find(r => {
    const clause = r.clause.toLowerCase();
    return clause.includes(target) || target.includes(clause);
  });
}
