// ──────────────────────────────────────────────────────────────────────
// Energy Crisis Policy Response Tracker — 2026 picture
//
// Inspired by the IEA "Energy Crisis Policy Response Tracker"
// (last IEA update: 14 April 2026). Coverage prioritises EU-27 plus
// selected non-EU comparators.
//
// Notes on the 2026 landscape:
//   • Most acute-crisis (2022-23) electricity / gas price caps have
//     expired. Several have been replaced by structural reforms or
//     more narrowly targeted instruments.
//   • The IEA April-2026 tracker shows that surviving measures cluster
//     around road-fuel taxation, fuel-station price discipline and
//     targeted support for vulnerable households / specific sectors
//     (transport, agriculture, fisheries).
//   • EU-level action in Q1 2026 has been dominated by the Citizens
//     Energy Package, the Affordable Energy Action Plan follow-through
//     and the launch of the Social Climate Fund.
//
// Each entry below carries a `source_url` to a primary government, EU
// institution or major broadcaster page. Statuses should be re-checked
// against the linked source before citation.
// ──────────────────────────────────────────────────────────────────────

export const POLICY_CATEGORIES = {
  conservation: {
    id: 'conservation',
    label: 'Energy Conservation',
    short: 'Conservation',
    color: { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' },
    subcategories: [
      { id: 'heating_limits',   label: 'Heating temperature limits' },
      { id: 'cooling_limits',   label: 'Cooling temperature limits' },
      { id: 'lighting',         label: 'Lighting / illuminated signs' },
      { id: 'public_buildings', label: 'Public-building rules' },
      { id: 'campaigns',        label: 'Public information campaigns' },
      { id: 'transport',        label: 'Transport / mobility' },
      { id: 'demand_target',    label: 'Demand-reduction targets' },
    ],
  },
  support: {
    id: 'support',
    label: 'Consumer Support',
    short: 'Support',
    color: { bg: 'bg-sky-100', text: 'text-sky-800', dot: 'bg-sky-500' },
    subcategories: [
      { id: 'price_caps',      label: 'Price caps / regulated tariffs' },
      { id: 'tax_cuts',        label: 'VAT / excise reductions' },
      { id: 'household_grant', label: 'Household grants / vouchers' },
      { id: 'business_grant',  label: 'Business / industry support' },
      { id: 'vulnerable',      label: 'Targeted vulnerable households' },
      { id: 'windfall_tax',    label: 'Windfall / solidarity levy' },
      { id: 'fuel_margin',     label: 'Retail fuel margin caps' },
      { id: 'network_fees',    label: 'Network / grid fee subsidies' },
    ],
  },
}

// Helper for status badges on individual measures
export const POLICY_STATUS = {
  active:    { label: 'Active in 2026',  bg: 'bg-emerald-100', text: 'text-emerald-800' },
  expired:   { label: 'Expired',         bg: 'bg-slate-100',   text: 'text-slate-700' },
  announced: { label: 'Announced',       bg: 'bg-amber-100',   text: 'text-amber-800' },
  extended:  { label: 'Extended into 2026', bg: 'bg-indigo-100', text: 'text-indigo-800' },
}

// EU-level pseudo-country plus EU-27 plus comparators.
export const COUNTRIES = [
  { iso: 'EU', name: 'European Union (EU-wide)', region: 'EU-level' },
  { iso: 'AT', name: 'Austria',        region: 'EU' },
  { iso: 'BE', name: 'Belgium',        region: 'EU' },
  { iso: 'BG', name: 'Bulgaria',       region: 'EU' },
  { iso: 'HR', name: 'Croatia',        region: 'EU' },
  { iso: 'CY', name: 'Cyprus',         region: 'EU' },
  { iso: 'CZ', name: 'Czechia',        region: 'EU' },
  { iso: 'DK', name: 'Denmark',        region: 'EU' },
  { iso: 'EE', name: 'Estonia',        region: 'EU' },
  { iso: 'FI', name: 'Finland',        region: 'EU' },
  { iso: 'FR', name: 'France',         region: 'EU' },
  { iso: 'DE', name: 'Germany',        region: 'EU' },
  { iso: 'GR', name: 'Greece',         region: 'EU' },
  { iso: 'HU', name: 'Hungary',        region: 'EU' },
  { iso: 'IE', name: 'Ireland',        region: 'EU' },
  { iso: 'IT', name: 'Italy',          region: 'EU' },
  { iso: 'LV', name: 'Latvia',         region: 'EU' },
  { iso: 'LT', name: 'Lithuania',      region: 'EU' },
  { iso: 'LU', name: 'Luxembourg',     region: 'EU' },
  { iso: 'MT', name: 'Malta',          region: 'EU' },
  { iso: 'NL', name: 'Netherlands',    region: 'EU' },
  { iso: 'PL', name: 'Poland',         region: 'EU' },
  { iso: 'PT', name: 'Portugal',       region: 'EU' },
  { iso: 'RO', name: 'Romania',        region: 'EU' },
  { iso: 'SK', name: 'Slovakia',       region: 'EU' },
  { iso: 'SI', name: 'Slovenia',       region: 'EU' },
  { iso: 'ES', name: 'Spain',          region: 'EU' },
  { iso: 'SE', name: 'Sweden',         region: 'EU' },
  // Comparators
  { iso: 'GB', name: 'United Kingdom', region: 'Non-EU' },
  { iso: 'NO', name: 'Norway',         region: 'Non-EU' },
  { iso: 'CH', name: 'Switzerland',    region: 'Non-EU' },
]

// ──────────────────────────────────────────────────────────────────────
// MEASURES (2026)
// All entries below describe measures either adopted in 2026 or still
// in force in 2026. Verified against IEA tracker (Apr 2026), European
// Commission affordable-energy actions list, national budget documents
// and ministry pages.
// ──────────────────────────────────────────────────────────────────────
export const MEASURES = [
  // ── EU level ───────────────────────────────────────────────────────
  {
    country: 'EU',
    category: 'support',
    subcategory: 'household_grant',
    title: 'Citizens Energy Package',
    description: 'Commission package adopted on 10 March 2026 setting out concrete actions to lower energy bills for households, protect and empower consumers and tackle energy poverty.',
    announced: '2026-03-10',
    status: 'active',
    source_url: 'https://energy.ec.europa.eu/news/commission-boost-access-affordable-and-clean-energy-all-europeans-2026-03-10_en',
    source_label: 'energy.ec.europa.eu',
  },
  {
    country: 'EU',
    category: 'support',
    subcategory: 'vulnerable',
    title: 'Social Climate Fund (operational from 2026)',
    description: '€86.7 billion EU fund supporting vulnerable households and micro-enterprises with building renovations, zero-emission heating/cooling and direct income support to offset ETS2 costs.',
    announced: '2026-01-01',
    status: 'active',
    source_url: 'https://climate.ec.europa.eu/eu-action/social-climate-fund_en',
    source_label: 'climate.ec.europa.eu',
  },
  {
    country: 'EU',
    category: 'support',
    subcategory: 'tax_cuts',
    title: 'Recommendation: lower national electricity taxes',
    description: 'Commission follow-up to the Affordable Energy Action Plan recommending Member States reduce national electricity taxes and review network charges to lower household and industrial bills.',
    announced: '2026-02-17',
    status: 'active',
    source_url: 'https://energy.ec.europa.eu/strategy/affordable-energy/actions-supporting-affordable-energy_en',
    source_label: 'energy.ec.europa.eu',
  },
  {
    country: 'EU',
    category: 'support',
    subcategory: 'business_grant',
    title: 'Clean Energy Investment Strategy',
    description: 'Adopted 10 March 2026 to mobilise private capital towards Europe\'s pipeline of energy projects, lowering long-run system costs.',
    announced: '2026-03-10',
    status: 'active',
    source_url: 'https://energy.ec.europa.eu/topics/markets-and-consumers/clean-energy-investment-strategy_en',
    source_label: 'energy.ec.europa.eu',
  },

  // ── Ireland ─────────────────────────────────────────────────────────
  // 2026 timeline: Budget 2026 (7 Oct 2025) — targeted, no universal credits.
  // Feb: arrears support. 24 Mar: €250m "Iran-war" package. 2 Apr: fuel
  // conservation information campaign. 12-13 Apr: €505m post-protest package.
  // ────────────────────────────────────────────────────────────────────
  {
    country: 'IE',
    category: 'support',
    subcategory: 'tax_cuts',
    title: 'Emergency Mineral Oil Tax cuts — Apr 2026 top-up (€505m package)',
    description: 'After nearly a week of fuel-supply blockades, Cabinet added a further 10c/litre cut to petrol and diesel excise and a 2.4c/litre cut on green diesel, effective from midnight on Tuesday 14 April and running to end-July 2026 (subject to Oireachtas approval). Layered on top of the 24 March cuts.',
    announced: '2026-04-13',
    status: 'active',
    source_url: 'https://www.rte.ie/news/politics/2026/0412/1567813-fuel-protests-cabinet/',
    source_label: 'rte.ie',
  },
  {
    country: 'IE',
    category: 'support',
    subcategory: 'business_grant',
    title: 'Transport Support Scheme for hauliers, food & agriculture',
    description: 'Part of the €505m April package: direct-payment scheme for hauliers and the food/agriculture sectors, backdated to 1 March 2026. Includes enhanced support for Local Link and school-transport providers and direct payments to agricultural contractors and fisheries operators.',
    announced: '2026-04-13',
    status: 'active',
    source_url: 'https://www.rte.ie/news/politics/2026/0412/1567813-fuel-protests-cabinet/',
    source_label: 'rte.ie',
  },
  {
    country: 'IE',
    category: 'conservation',
    subcategory: 'campaigns',
    title: 'Voluntary fuel conservation information campaign',
    description: 'On 2 April 2026 Minister O\'Brien and Minister of State Canney launched a public information campaign encouraging carpooling, public transport, cycling/walking, avoiding electricity waste and remote-work arrangements. Explicitly voluntary — "to assist people, not to direct them".',
    announced: '2026-04-02',
    status: 'active',
    source_url: 'https://www.rte.ie/news/politics/2026/0402/1566506-energy-crisis-government/',
    source_label: 'rte.ie',
  },
  {
    country: 'IE',
    category: 'support',
    subcategory: 'tax_cuts',
    title: 'Mineral Oil Tax & NORA levy cuts — 24 Mar 2026 (€250m package)',
    description: 'Government announced a €250m package in response to the energy-price impact of the Iran war: 17c/litre cut on petrol and 22c/litre cut on diesel via Mineral Oil Tax reductions, plus the NORA (oil reserves) levy reduced from 2c/litre to a nominal level. Commenced by ministerial order on 1 April 2026; running to 31 May 2026.',
    announced: '2026-03-24',
    status: 'active',
    source_url: 'https://www.gov.ie/en/department-of-the-taoiseach/press-releases/government-announces-measures-to-reduce-energy-costs/',
    source_label: 'gov.ie',
  },
  {
    country: 'IE',
    category: 'support',
    subcategory: 'vulnerable',
    title: 'Fuel Allowance season extended by 4 weeks',
    description: 'As part of the 24 March package, the Fuel Allowance payment season was extended by four additional weeks, giving ~470,000 recipient households an extra €152 (4 × €38/week).',
    announced: '2026-03-24',
    status: 'active',
    source_url: 'https://www.gov.ie/en/department-of-the-taoiseach/press-releases/government-announces-measures-to-reduce-energy-costs/',
    source_label: 'gov.ie',
  },
  {
    country: 'IE',
    category: 'support',
    subcategory: 'vulnerable',
    title: 'Electricity-arrears targeted support (~320k customers)',
    description: 'Tánaiste announcement (27 Feb 2026) responding to CRU data showing arrears-affected domestic electricity customers up 20% YoY to 319,459. Government confirmed targeted supports rather than universal credits, including widened Fuel Allowance eligibility (50,000 additional Working Family Payment households, backdated to January 2026).',
    announced: '2026-02-27',
    status: 'active',
    source_url: 'https://www.rte.ie/news/ireland/2026/0227/1560686-energy-bill-arrears/',
    source_label: 'rte.ie',
  },
  {
    country: 'IE',
    category: 'support',
    subcategory: 'windfall_tax',
    title: 'Carbon tax October increase delayed',
    description: 'As part of the post-protest package, the scheduled carbon-tax increase was deferred to the October Budget.',
    announced: '2026-04-13',
    status: 'announced',
    source_url: 'https://www.rte.ie/news/politics/2026/0412/1567813-fuel-protests-cabinet/',
    source_label: 'rte.ie',
  },
  {
    country: 'IE',
    category: 'support',
    subcategory: 'tax_cuts',
    title: 'VAT 9% on gas and electricity extended to end-2030',
    description: 'Budget 2026 extended the reduced 9% VAT rate on domestic gas and electricity supply for a further five years. Estimated annual saving of about €53 on a typical household electricity bill.',
    announced: '2025-10-07',
    status: 'extended',
    source_url: 'https://www.gov.ie/en/publication/budget-2026/',
    source_label: 'gov.ie',
  },
  {
    country: 'IE',
    category: 'support',
    subcategory: 'vulnerable',
    title: 'Fuel Allowance rate raised €33 → €38/week',
    description: 'Budget 2026 raised the weekly Fuel Allowance from €33 to €38 (first increase in four years), paid across the standard 28-week winter season.',
    announced: '2025-10-07',
    status: 'active',
    source_url: 'https://www.gov.ie/en/service/00aa38-fuel-allowance/',
    source_label: 'gov.ie',
  },
  {
    country: 'IE',
    category: 'support',
    subcategory: 'household_grant',
    title: 'No universal electricity credits in Budget 2026',
    description: 'Government confirmed no broad cost-of-living package and no universal Electricity Costs Emergency Benefit credits for 2026; the scheme that paid €450 in 2024-25 has lapsed. Policy shift to targeted supports. Note: this stance pre-dates the March 2026 Iran-war crisis response, which used excise and sectoral tools rather than reviving universal credits.',
    announced: '2025-10-07',
    status: 'expired',
    source_url: 'https://www.rte.ie/news/budget-2026/2025/1007/1537074-budget-2026-energy-fuel-excise-duty/',
    source_label: 'rte.ie',
  },

  // ── Germany (effective 1 Jan 2026) ──────────────────────────────────
  {
    country: 'DE',
    category: 'support',
    subcategory: 'network_fees',
    title: 'Transmission grid fee subsidy (€6.5bn in 2026)',
    description: 'Federal subsidy of €6.5 billion lowering transmission grid charges for all electricity consumers from 1 January 2026, applied through reduced Übertragungsnetzentgelte.',
    announced: '2025-12-12',
    status: 'active',
    source_url: 'https://www.bundesregierung.de/breg-en/news/reduction-in-energy-prices-2358994',
    source_label: 'bundesregierung.de',
  },
  {
    country: 'DE',
    category: 'support',
    subcategory: 'tax_cuts',
    title: 'Permanent electricity-tax reduction (Stromsteuer)',
    description: 'Permanent reduction in the electricity tax for manufacturing, agriculture and forestry from 1 January 2026, worth roughly €3 billion per year. Domestic consumers benefit indirectly via lower industrial costs.',
    announced: '2026-01-01',
    status: 'active',
    source_url: 'https://www.bundesregierung.de/breg-en/news/reduction-in-energy-prices-2358994',
    source_label: 'bundesregierung.de',
  },
  {
    country: 'DE',
    category: 'support',
    subcategory: 'tax_cuts',
    title: 'Gas-storage levy abolished',
    description: 'Gasspeicherumlage abolished with effect from 1 January 2026, removing roughly €0.0099/kWh from gas bills and lowering wholesale gas costs across the German market.',
    announced: '2026-01-01',
    status: 'active',
    source_url: 'https://www.bundesregierung.de/breg-en/news/reduction-in-energy-prices-2358994',
    source_label: 'bundesregierung.de',
  },
  {
    country: 'DE',
    category: 'support',
    subcategory: 'fuel_margin',
    title: 'Daily fuel-price change cap',
    description: 'Per IEA tracker (Apr 2026): rule limiting fuel stations to one gasoline and diesel price increase per day, retained alongside earlier petrol/diesel tax cuts and a tax-free employer commuting bonus.',
    announced: '2026-04-14',
    status: 'active',
    source_url: 'https://www.iea.org/data-and-statistics/data-tools/2026-energy-crisis-policy-response-tracker',
    source_label: 'iea.org',
  },

  // ── France ─────────────────────────────────────────────────────────
  {
    country: 'FR',
    category: 'support',
    subcategory: 'business_grant',
    title: 'Targeted support for transport, fishing and agriculture',
    description: 'Per IEA tracker (Apr 2026): France maintains targeted, time-limited support for energy-intensive transport, fishing and agriculture sectors; broad household price-shield measures have wound down.',
    announced: '2026-04-14',
    status: 'active',
    source_url: 'https://www.iea.org/data-and-statistics/data-tools/2026-energy-crisis-policy-response-tracker',
    source_label: 'iea.org',
  },
  {
    country: 'FR',
    category: 'support',
    subcategory: 'household_grant',
    title: 'Chèque énergie (annual)',
    description: 'Means-tested annual energy voucher continues in 2026 (typical value €48-€277) for ~5.6 million eligible households; can be used for energy bills or retrofit works.',
    announced: '2026-01-01',
    status: 'active',
    source_url: 'https://chequeenergie.gouv.fr/',
    source_label: 'chequeenergie.gouv.fr',
  },

  // ── Italy ──────────────────────────────────────────────────────────
  {
    country: 'IT',
    category: 'support',
    subcategory: 'vulnerable',
    title: 'Decreto Bollette — €200 contribution for low-income households',
    description: 'Decree-Law 28 February 2025, n. 19 ("Decreto Bollette") provided a one-off €200 extraordinary contribution to families in poor economic conditions; effects continued into early 2026 alongside the standard ARERA bonus sociale.',
    announced: '2025-02-28',
    status: 'extended',
    source_url: 'https://www.gazzettaufficiale.it/eli/id/2025/02/28/25G00027/sg',
    source_label: 'gazzettaufficiale.it',
  },
  {
    country: 'IT',
    category: 'support',
    subcategory: 'vulnerable',
    title: 'Bonus sociale elettrico e gas',
    description: 'Automatic discount on electricity and gas bills for households below the ISEE threshold continues in 2026, administered by ARERA via suppliers.',
    announced: '2026-01-01',
    status: 'active',
    source_url: 'https://www.arera.it/bonus-sociale',
    source_label: 'arera.it',
  },
  {
    country: 'IT',
    category: 'support',
    subcategory: 'tax_cuts',
    title: 'Fuel excise reductions and sectoral relief',
    description: 'Per IEA tracker (Apr 2026): Italy retains cuts to fuel excise taxes plus targeted tax relief for road haulage and fisheries and a tax credit for agricultural businesses.',
    announced: '2026-04-14',
    status: 'active',
    source_url: 'https://www.iea.org/data-and-statistics/data-tools/2026-energy-crisis-policy-response-tracker',
    source_label: 'iea.org',
  },

  // ── Spain ──────────────────────────────────────────────────────────
  {
    country: 'ES',
    category: 'support',
    subcategory: 'tax_cuts',
    title: 'Income-tax relief for energy renovations',
    description: 'Personal income tax deductions for renovations, residential solar PV installations and electrification works, retained and extended into 2026.',
    announced: '2026-01-01',
    status: 'extended',
    source_url: 'https://sede.agenciatributaria.gob.es/',
    source_label: 'agenciatributaria.gob.es',
  },
  {
    country: 'ES',
    category: 'support',
    subcategory: 'tax_cuts',
    title: 'Fuel VAT cut and hydrocarbon excise suspension',
    description: 'Per IEA tracker (Apr 2026): Spain retains a reduced VAT rate on automotive fuels and a partial suspension of the hydrocarbon excise duty.',
    announced: '2026-04-14',
    status: 'active',
    source_url: 'https://www.iea.org/data-and-statistics/data-tools/2026-energy-crisis-policy-response-tracker',
    source_label: 'iea.org',
  },
  {
    country: 'ES',
    category: 'support',
    subcategory: 'business_grant',
    title: 'Self-consumption / energy communities reform',
    description: 'Regulatory changes promoting new energy communities and additional self-consumption modalities — ongoing implementation through 2026.',
    announced: '2026-01-01',
    status: 'active',
    source_url: 'https://www.miteco.gob.es/es/energia.html',
    source_label: 'miteco.gob.es',
  },

  // ── Austria ────────────────────────────────────────────────────────
  {
    country: 'AT',
    category: 'support',
    subcategory: 'fuel_margin',
    title: 'Cap on fuel-retailer margins',
    description: 'Per IEA tracker (Apr 2026): cap on the margin retailers can apply to fuel sales, alongside reduced gasoline and diesel taxes.',
    announced: '2026-04-14',
    status: 'active',
    source_url: 'https://www.iea.org/data-and-statistics/data-tools/2026-energy-crisis-policy-response-tracker',
    source_label: 'iea.org',
  },

  // ── Bulgaria ───────────────────────────────────────────────────────
  {
    country: 'BG',
    category: 'support',
    subcategory: 'vulnerable',
    title: 'Income-targeted fuel subsidy for car owners',
    description: 'Per IEA tracker (Apr 2026): means-tested fuel subsidy for private car owners, plus increased fuel excise compensation for farmers.',
    announced: '2026-04-14',
    status: 'active',
    source_url: 'https://www.iea.org/data-and-statistics/data-tools/2026-energy-crisis-policy-response-tracker',
    source_label: 'iea.org',
  },

  // ── Croatia ────────────────────────────────────────────────────────
  {
    country: 'HR',
    category: 'support',
    subcategory: 'price_caps',
    title: 'Cap on oil and diesel prices',
    description: 'Per IEA tracker (Apr 2026): Croatia continues to cap retail oil and diesel prices, cut fuel excise duty and provide direct financial support for vulnerable groups and targeted aid for transport and agriculture.',
    announced: '2026-04-14',
    status: 'active',
    source_url: 'https://www.iea.org/data-and-statistics/data-tools/2026-energy-crisis-policy-response-tracker',
    source_label: 'iea.org',
  },

  // ── Czechia ────────────────────────────────────────────────────────
  {
    country: 'CZ',
    category: 'support',
    subcategory: 'fuel_margin',
    title: 'Cap on fuel-retailer profit margins + excise cut',
    description: 'Per IEA tracker (Apr 2026): retailer profit-margin cap on fuels combined with a cut to fuel excise tax.',
    announced: '2026-04-14',
    status: 'active',
    source_url: 'https://www.iea.org/data-and-statistics/data-tools/2026-energy-crisis-policy-response-tracker',
    source_label: 'iea.org',
  },

  // ── Greece ─────────────────────────────────────────────────────────
  {
    country: 'GR',
    category: 'support',
    subcategory: 'vulnerable',
    title: 'Diesel subsidy + household fuel card + farmer fertilizer subsidy',
    description: 'Per IEA tracker (Apr 2026): combined package — diesel subsidy, fuel card for households and a fertilizer subsidy for farmers — alongside a 3-month cap on fuel-retailer profit margins.',
    announced: '2026-04-14',
    status: 'active',
    source_url: 'https://www.iea.org/data-and-statistics/data-tools/2026-energy-crisis-policy-response-tracker',
    source_label: 'iea.org',
  },

  // ── Hungary ────────────────────────────────────────────────────────
  {
    country: 'HU',
    category: 'support',
    subcategory: 'price_caps',
    title: 'Fuel-price cap + excise cuts',
    description: 'Per IEA tracker (Apr 2026): retail fuel price cap maintained, alongside cuts to gasoline and diesel excise taxes.',
    announced: '2026-04-14',
    status: 'active',
    source_url: 'https://www.iea.org/data-and-statistics/data-tools/2026-energy-crisis-policy-response-tracker',
    source_label: 'iea.org',
  },

  // ── Latvia ─────────────────────────────────────────────────────────
  {
    country: 'LV',
    category: 'support',
    subcategory: 'tax_cuts',
    title: 'Excise reduction on diesel and "green" diesel',
    description: 'Per IEA tracker (Apr 2026): reduction of excise duty on diesel and on agricultural ("green") diesel.',
    announced: '2026-04-14',
    status: 'active',
    source_url: 'https://www.iea.org/data-and-statistics/data-tools/2026-energy-crisis-policy-response-tracker',
    source_label: 'iea.org',
  },

  // ── Lithuania ──────────────────────────────────────────────────────
  {
    country: 'LT',
    category: 'conservation',
    subcategory: 'transport',
    title: 'Local rail fares cut by 50% for two months',
    description: 'Per IEA tracker (Apr 2026): temporary 50% reduction on local train fares for a two-month window to encourage modal shift away from private car use.',
    announced: '2026-04-14',
    status: 'active',
    source_url: 'https://www.iea.org/data-and-statistics/data-tools/2026-energy-crisis-policy-response-tracker',
    source_label: 'iea.org',
  },

  // ── Poland ─────────────────────────────────────────────────────────
  {
    country: 'PL',
    category: 'support',
    subcategory: 'price_caps',
    title: 'Petrol and diesel price caps',
    description: 'Per IEA tracker (Apr 2026): cap on retail petrol and diesel prices, alongside a VAT cut on fuel and reduced excise duty.',
    announced: '2026-04-14',
    status: 'active',
    source_url: 'https://www.iea.org/data-and-statistics/data-tools/2026-energy-crisis-policy-response-tracker',
    source_label: 'iea.org',
  },

  // ── Portugal ───────────────────────────────────────────────────────
  {
    country: 'PT',
    category: 'support',
    subcategory: 'tax_cuts',
    title: 'Temporary fuel-tax cut',
    description: 'Per IEA tracker (Apr 2026): temporary cut to fuel taxes retained.',
    announced: '2026-04-14',
    status: 'active',
    source_url: 'https://www.iea.org/data-and-statistics/data-tools/2026-energy-crisis-policy-response-tracker',
    source_label: 'iea.org',
  },

  // ── Romania ────────────────────────────────────────────────────────
  {
    country: 'RO',
    category: 'support',
    subcategory: 'tax_cuts',
    title: 'Diesel excise cut + transport-operator extension + windfall levy',
    description: 'Per IEA tracker (Apr 2026): diesel excise cut, an extension of the diesel-excise scheme for transport operators, and a new solidarity levy on exceptional revenues from crude oil and petroleum sales.',
    announced: '2026-04-14',
    status: 'active',
    source_url: 'https://www.iea.org/data-and-statistics/data-tools/2026-energy-crisis-policy-response-tracker',
    source_label: 'iea.org',
  },

  // ── Slovakia ───────────────────────────────────────────────────────
  {
    country: 'SK',
    category: 'conservation',
    subcategory: 'transport',
    title: 'Cap on fuel purchases (higher prices for foreign plates)',
    description: 'Per IEA tracker (Apr 2026): cap on fuel purchases at the pump, with higher prices applied to vehicles bearing foreign number plates.',
    announced: '2026-04-14',
    status: 'active',
    source_url: 'https://www.iea.org/data-and-statistics/data-tools/2026-energy-crisis-policy-response-tracker',
    source_label: 'iea.org',
  },

  // ── Slovenia ───────────────────────────────────────────────────────
  {
    country: 'SI',
    category: 'conservation',
    subcategory: 'transport',
    title: 'Temporary cap on fuel purchases',
    description: 'Per IEA tracker (Apr 2026): temporary cap on volume of fuel purchases per transaction.',
    announced: '2026-04-14',
    status: 'active',
    source_url: 'https://www.iea.org/data-and-statistics/data-tools/2026-energy-crisis-policy-response-tracker',
    source_label: 'iea.org',
  },
  {
    country: 'SI',
    category: 'support',
    subcategory: 'tax_cuts',
    title: 'Excise reduction on petrol, diesel and heating oil',
    description: 'Per IEA tracker (Apr 2026): reduction of excise duty on petrol, diesel and heating oil.',
    announced: '2026-04-14',
    status: 'active',
    source_url: 'https://www.iea.org/data-and-statistics/data-tools/2026-energy-crisis-policy-response-tracker',
    source_label: 'iea.org',
  },

  // ── Sweden ─────────────────────────────────────────────────────────
  {
    country: 'SE',
    category: 'support',
    subcategory: 'tax_cuts',
    title: 'Temporary cut to vehicle-fuels duty',
    description: 'Per IEA tracker (Apr 2026): temporary reduction in the duty on vehicle fuels.',
    announced: '2026-04-14',
    status: 'active',
    source_url: 'https://www.iea.org/data-and-statistics/data-tools/2026-energy-crisis-policy-response-tracker',
    source_label: 'iea.org',
  },

  // ── United Kingdom ─────────────────────────────────────────────────
  {
    country: 'GB',
    category: 'support',
    subcategory: 'vulnerable',
    title: 'Heating support for vulnerable consumers',
    description: 'Per IEA tracker (Apr 2026): targeted heating support for vulnerable consumers; the universal Energy Price Guarantee from 2022-23 has long since ended.',
    announced: '2026-04-14',
    status: 'active',
    source_url: 'https://www.iea.org/data-and-statistics/data-tools/2026-energy-crisis-policy-response-tracker',
    source_label: 'iea.org',
  },
  {
    country: 'GB',
    category: 'support',
    subcategory: 'household_grant',
    title: 'Warm Homes Plan acceleration + plug-in solar approval',
    description: 'Per IEA tracker (Apr 2026): government accelerating the Warm Homes Plan, working to approve plug-in solar devices and issuing ministerial statements against fuel price gouging.',
    announced: '2026-04-14',
    status: 'active',
    source_url: 'https://www.iea.org/data-and-statistics/data-tools/2026-energy-crisis-policy-response-tracker',
    source_label: 'iea.org',
  },

  // ── Norway ─────────────────────────────────────────────────────────
  {
    country: 'NO',
    category: 'support',
    subcategory: 'tax_cuts',
    title: 'Petrol and diesel tax cuts',
    description: 'Per IEA tracker (Apr 2026): reductions in petrol and diesel taxes.',
    announced: '2026-04-14',
    status: 'active',
    source_url: 'https://www.iea.org/data-and-statistics/data-tools/2026-energy-crisis-policy-response-tracker',
    source_label: 'iea.org',
  },
]

// Convenience helpers consumed by the page component ────────────────
export function getMeasuresByCountry(iso) {
  return MEASURES.filter(m => m.country === iso)
}

export function getCountriesWithCounts() {
  const counts = MEASURES.reduce((acc, m) => {
    acc[m.country] = (acc[m.country] || 0) + 1
    return acc
  }, {})
  return COUNTRIES.map(c => ({ ...c, measureCount: counts[c.iso] || 0 }))
}
