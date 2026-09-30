#!/usr/bin/env node
/**
 * ETBZ-55 — source-mutation proofs for the PresentationProjection.
 *
 * For each guard of `buildPresentationProjection`, the long-form paginator, the
 * line measurer and the template: weaken it in exactly one place, run the suite
 * that claims to protect it, and require that suite to turn RED. A guard whose
 * removal leaves the suite green is decoration. Where a guard only defends
 * against a defect of the algorithm itself (the paginator's orphan rule, the
 * tolerance, the rounding), the mutant introduces the defect and the killer is
 * the line-for-line oracle against the canonical ETBZ-49 layout. The unmutated
 * baseline must be GREEN first — otherwise "red" proves nothing.
 *
 * RED means a TEST failed an ASSERTION (the ETBZ-30B semantics). A mutant that
 * names its killer is killed only by that test failing an assertion; a run that
 * times out, fails to load, or throws inside a test body is an error, not a kill.
 *
 * Every file is restored from bytes held in memory; the run fails if the tree
 * differs from before. Three guards have no mutant, by design: `assertEveryWordPlaced`
 * in the projection is defence in depth behind the paginator's own every-word
 * check, whose defect mutant ("the last line of a paragraph is dropped") is
 * below; the band flush's "no recorded line count" refusal guards a state the
 * paginator cannot reach (every band entry is recorded before it is placed); and
 * the advance-table check on every printed string is defence in depth behind the
 * checks each string's source already meets (the payload texts, the released
 * labels, the model values bound to a second source).
 *
 * A mutant whose name says "is not refused as <CODE>" proves only that the
 * guard names its own code: without it the input would still fail, later,
 * untyped or under another code. The boundary mutants create a file (and, for
 * the sibling folder or a new src directory, a directory) and remove it again.
 *
 *   npm run guards:etbz55
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const PROJECTION = 'src/application/presentation/projection.ts';
const LONG_FORM = 'src/application/presentation/long-form.ts';
const MEASURE = 'src/application/presentation/text-measure.ts';
const TEMPLATE = 'src/application/presentation/template.ts';

const T = {
  unit: 'tests/unit/etbz55-presentation.test.ts',
  longForm: 'tests/unit/etbz55-long-form.test.ts',
  negative: 'tests/negative/etbz55-presentation.negative.test.ts',
  contract: 'tests/contract/etbz55-presentation-evidence.contract.test.ts',
  architecture: 'tests/architecture/etbz55-presentation-boundary.test.ts',
  visualBoundary: 'tests/architecture/etbz49-visual-boundary.test.ts',
  skillBoundary: 'tests/architecture/etbz51-skill-boundary.test.ts',
  dependency: 'tests/architecture/dependency-direction.test.ts',
};
const DEPENDENCY = 'tests/architecture/dependency-direction.test.ts';
const RENDERER_PY = 'tools/pdf-renderer/render_pdf.py';
const PDF_LAYER_PY = 'tools/pdf-renderer/pdf_layer.py';

const TEMP = '// TEMPORARY MUTATION - scripts/verify-etbz55-presentation.mjs, never committed.\n';

/** [name, kind, file, find|contents, replace, tests, killer?] — kind 'text' (find occurs exactly once) or 'create'. */
const MUTANTS = [
  // --- the content payload ---------------------------------------------------------------------------------
  ['CONTENT: the payload schema tolerates unknown keys', 'text', PROJECTION,
    'const contentSchema = z.strictObject({', 'const contentSchema = z.object({',
    [T.negative], 'refuses a missing title, an extra key and an empty chapter list'],
  ['CONTENT: double spaces and padding are accepted', 'text', PROJECTION,
    ' && !/ {2}/u.test(text) && text.trim() === text, {', ', {',
    [T.negative], 'refuses text the layout would have to normalise'],
  ['CONTENT: control and format characters are accepted (only layout whitespace refused)', 'text', PROJECTION,
    'export const FORBIDDEN_CHARACTER = /[\\p{Cc}\\p{Cf}\\p{Cs}\\p{Co}\\p{Cn}\\p{Default_Ignorable_Code_Point}]|[^\\S ]/u;', 'export const FORBIDDEN_CHARACTER = /[\\t\\n\\r\\f\\v]/u;',
    [T.negative], 'refuses a control or format character anywhere in the payload'],
  ['CONTENT: lone surrogates, private-use and default-ignorable characters are not refused as INPUT_INVALID (the round-2 class; some would be refused later)', 'text', PROJECTION,
    'export const FORBIDDEN_CHARACTER = /[\\p{Cc}\\p{Cf}\\p{Cs}\\p{Co}\\p{Cn}\\p{Default_Ignorable_Code_Point}]|[^\\S ]/u;', 'export const FORBIDDEN_CHARACTER = /[\\p{Cc}\\p{Cf}]|[^\\S ]/u;',
    [T.negative], 'refuses a control or format character anywhere in the payload'],
  ['CONTENT: an unassigned code point is not refused as INPUT_INVALID (it would be refused later as TEXT_UNMEASURABLE)', 'text', PROJECTION,
    '\\p{Co}\\p{Cn}\\p{Default_Ignorable_Code_Point}', '\\p{Co}\\p{Default_Ignorable_Code_Point}',
    [T.negative], 'refuses a control or format character anywhere in the payload'],
  ['CONTENT: the title is not held to the pinned faces', 'text', PROJECTION,
    "  assertMeasurable(content.title, 'title');\n", '',
    [T.negative], 'refuses a character outside the pinned Inter advance tables (and not a CJK ideograph) in the texts the long form does not measure'],
  ['CONTENT: the reflection questions are not held to the pinned faces', 'text', PROJECTION,
    '  content.reflectionQuestions.forEach((question, index) => assertMeasurable(question, `reflectionQuestions.${String(index)}`));\n', '',
    [T.negative], 'refuses a character outside the pinned Inter advance tables (and not a CJK ideograph) in the texts the long form does not measure'],
  ['CONTENT: the method note is not held to the pinned faces', 'text', PROJECTION,
    "  assertMeasurable(content.methodNote, 'methodNote');\n", '',
    [T.negative], 'refuses a character outside the pinned Inter advance tables (and not a CJK ideograph) in the texts the long form does not measure'],
  ['CONTENT: the display name is not held to the pinned faces', 'text', PROJECTION,
    "  assertMeasurable(model.displayName, 'displayName');\n", '',
    [T.negative], 'refuses a character outside the pinned Inter advance tables (and not a CJK ideograph) in the texts the long form does not measure'],
  ['CONTENT: an empty display name is accepted', 'text', PROJECTION,
    "  if (model.displayName === '' || model.displayName.trim()", '  if (model.displayName.trim()',
    [T.negative], 'refuses a padded or empty display name'],
  ['CONTENT: a padded display name is accepted', 'text', PROJECTION,
    " || model.displayName.trim() !== model.displayName || FORBIDDEN", ' || FORBIDDEN',
    [T.negative], 'refuses a padded or empty display name'],
  ['CONTENT: a display name with a forbidden character is printed on every page', 'text', PROJECTION,
    ' || FORBIDDEN_CHARACTER.test(model.displayName)', '',
    [T.negative], 'holds the display name - printed on every page - to the payload rule'],
  ['CONTENT: a double-spaced display name is accepted', 'text', PROJECTION,
    ' || / {2}/u.test(model.displayName)) {', ') {',
    [T.negative], 'holds the display name - printed on every page - to the payload rule'],
  ['TIME: an unknown birth time on the input is rendered', 'text', PROJECTION,
    '  if (!model.birth.birthTimeKnown || precisions.some(', '  if (precisions.some(',
    [T.negative], 'refuses an unknown or provisional birth time'],
  ['TIME: an unknown birth time in a chart answer is rendered', 'text', PROJECTION,
    'precisions.some((precision) => !precision.birthTimeKnown || precision.provisionalFields.length > 0)', 'precisions.some((precision) => precision.provisionalFields.length > 0)',
    [T.negative], 'refuses an unknown or provisional birth time'],
  ['TIME: a provisional hour is rendered', 'text', PROJECTION,
    'precisions.some((precision) => !precision.birthTimeKnown || precision.provisionalFields.length > 0)', 'precisions.some((precision) => !precision.birthTimeKnown)',
    [T.negative], 'refuses an unknown or provisional birth time'],
  ['TIME: the Wu Xing answer\'s precision is ignored', 'text', PROJECTION,
    '  const precisions = [model.precision, model.natal.precision, model.wuxing.precision];', '  const precisions = [model.precision, model.natal.precision];',
    [T.negative], 'refuses an unknown or provisional birth time'],

  // --- chart values that disagree ------------------------------------------------------------------------------
  ['FACT: BaZi and natal stems may differ', 'text', PROJECTION,
    '    if (pillar.stemHanzi !== natal.stemCn) mismatch(', '    if (false) mismatch(',
    [T.negative], 'refuses a pillar whose BaZi and natal characters differ'],
  ['FACT: BaZi and natal branches may differ', 'text', PROJECTION,
    '    if (pillar.branchHanzi !== natal.branchCn) mismatch(', '    if (false) mismatch(',
    [T.negative], 'refuses a pillar whose BaZi and natal characters differ'],
  ['FACT: the stem element may differ between BaZi and natal', 'text', PROJECTION,
    '    if (natal.stemElement !== stemPhase) mismatch(', '    if (false) mismatch(',
    [T.negative], 'refuses a stem element that differs between the BaZi and natal answers'],
  ['FACT: a stem phase the glyph contract contradicts is accepted', 'text', PROJECTION,
    '  if (glyph.phase !== phase) mismatch(`${where}: the chart places ${character} in ${phase}', '  if (false) mismatch(`${where}: the chart places ${character} in ${phase}',
    [T.negative], 'refuses a stem phase the glyph contract does not give that character'],
  ['FACT: a polarity the glyph contract contradicts is accepted', 'text', PROJECTION,
    '  if (glyph.polarity !== polarity) mismatch(', '  if (false) mismatch(',
    [T.negative], 'refuses a branch phase, a hidden-stem phase, a polarity or a pinyin'],
  ['FACT: a stem pinyin the glyph contract contradicts is accepted', 'text', PROJECTION,
    '  if (glyph.pinyin !== pinyin) mismatch(', '  if (false) mismatch(',
    [T.negative], 'refuses a branch phase, a hidden-stem phase, a polarity or a pinyin'],
  ['FACT: a branch phase the glyph contract contradicts is accepted', 'text', PROJECTION,
    '    if (branchGlyph.phase !== branchPhase) {', '    if (false) {',
    [T.negative], 'refuses a branch phase, a hidden-stem phase, a polarity or a pinyin'],
  ['FACT: a branch pinyin the glyph contract contradicts is accepted', 'text', PROJECTION,
    '    if (branchGlyph.pinyin !== pillar.branchPinyin) mismatch(', '    if (false) mismatch(',
    [T.negative], 'refuses a branch phase, a hidden-stem phase, a polarity or a pinyin'],
  ['FACT: a hidden-stem phase the glyph contract contradicts is accepted', 'text', PROJECTION,
    '      if (glyph.phase !== phase) mismatch(`${at}:', '      if (false) mismatch(`${at}:',
    [T.negative], 'refuses a branch phase, a hidden-stem phase, a polarity or a pinyin'],
  ['FACT: a hidden stem the Sizhu table spells differently is accepted', 'text', PROJECTION,
    '      if (stemFactByName(entry.stem).pinyin !== glyph.pinyin) mismatch(', '      if (false) mismatch(',
    [T.negative], 'refuses a hidden stem the Sizhu table spells differently from the glyph contract'],
  ['FACT: a day pillar with a relation to itself is accepted', 'text', PROJECTION,
    '      if (natal.tenGod !== null) mismatch(', '      if (false) mismatch(',
    [T.negative], 'refuses a day pillar that carries a relation to itself'],
  ['FACT: a BaZi Day Master character that is not the day stem is accepted', 'text', PROJECTION,
    '  if (bazi.stemHanzi !== day.stem.character || ', '  if (',
    [T.negative], 'a Day Master that is not the day stem'],
  ['FACT: a BaZi Day Master pinyin that differs from the day stem is accepted', 'text', PROJECTION,
    ' || bazi.stemPinyin !== day.stem.pinyin || ', ' || ',
    [T.negative], 'a Day Master that is not the day stem'],
  ['FACT: a BaZi Day Master element that differs from the day stem is accepted', 'text', PROJECTION,
    ' || bazi.elementDe !== day.stem.phaseLabel) {', ') {',
    [T.negative], 'a Day Master that is not the day stem'],
  ['FACT: a natal Day Master character that is not the day stem is accepted', 'text', PROJECTION,
    '  if (natalDm.stemCn !== day.stem.character) mismatch(', '  if (false) mismatch(',
    [T.negative], 'refuses a natal Day Master that differs from the day stem'],
  ['FACT: a natal Day Master element that differs from the day stem is accepted', 'text', PROJECTION,
    "  if (asPhase(natalDm.element, 'natal.dayMaster.element') !== day.stem.phase) mismatch(", '  if (false) mismatch(',
    [T.negative], 'refuses a natal Day Master that differs from the day stem'],
  ['FACT: a natal Day Master polarity that differs from the day stem is accepted', 'text', PROJECTION,
    '  if (natalDm.polarity !== day.stem.polarity) mismatch(', '  if (false) mismatch(',
    [T.negative], 'refuses a natal Day Master that differs from the day stem'],

  // --- chart values that are missing ---------------------------------------------------------------------------
  ['MISSING: a branch without its animal is accepted', 'text', PROJECTION,
    "    if (pillar.tierDe.trim() === '') missing(", '    if (false) missing(',
    [T.negative], 'refuses a pillar without hidden stems, a visible stem without its relation, and a branch without its animal'],
  ['MISSING: a pillar without hidden stems is accepted', 'text', PROJECTION,
    '    if (natal.hiddenStems.length < 1) missing(', '    if (false) missing(',
    [T.negative], 'refuses a pillar without hidden stems, a visible stem without its relation, and a branch without its animal'],
  ['MISSING: a pillar with four hidden stems is accepted', 'text', PROJECTION,
    '    if (natal.hiddenStems.length > 3) missing(', '    if (false) missing(',
    [T.negative], 'refuses a pillar without hidden stems, a visible stem without its relation, and a branch without its animal'],
  ['MISSING: a visible stem without its relation is not refused as FACT_MISSING (it would crash untyped)', 'text', PROJECTION,
    '      if (natal.tenGod === null) missing(', '      if (false) missing(',
    [T.negative], 'refuses a pillar without hidden stems, a visible stem without its relation, and a branch without its animal'],
  ['MISSING: a four-phase Wu Xing distribution is not refused as FACT_MISSING (it would surface downstream)', 'text', PROJECTION,
    '  if (suppliedKeys.length !== PHASES.length) missing(', '  if (false) missing(',
    [T.negative], 'refuses a Wu Xing distribution of four phases'],

  // --- released contracts -----------------------------------------------------------------------------------------
  ['LEXICON: an unbound Ten-God relation is not refused as TEN_GOD_UNBOUND (it would crash untyped)', 'text', PROJECTION,
    '  if (matches.length !== 1) {', '  if (matches.length === 0 && false) {',
    [T.negative], 'refuses a Ten-God relation the Lexicon does not carry'],
  ['LEXICON: the traditional Hanzi form is printed instead of the simplified one', 'text', PROJECTION,
    '  return forms[forms.length - 1] ?? hanzi;', '  return forms[0] ?? hanzi;',
    [T.unit], 'names every Ten-God relation with the Lexicon Hanzi'],
  ['TEN GODS: a relation both visible and hidden is marked visible only', 'text', PROJECTION,
    "  if (visible && hidden) return 'both';\n", '',
    [T.unit], 'marks all four presence states'],
  ['TEMPLATE: the released-identity check compares nothing', 'text', TEMPLATE,
    '  if (released !== binding.structuralHash) {', '  if (false) {',
    [T.negative], 'refuses a template that no longer hashes to its released identity'],
  ['TEMPLATE: a label is edited without a new template version', 'text', TEMPLATE,
    "  continued: ui('Fortsetzung'),", "  continued: ui('weiter'),",
    [T.unit], 'frozen by its released hash'],
  ['TEMPLATE: the long-form typography is left out of the template identity', 'text', TEMPLATE,
    '      lineToleranceCp: LINE_TOLERANCE_CP,\n', '',
    [T.unit], 'binds the long-form typography that decides every line break'],

  // --- customer text and the page strings ------------------------------------------------------------------------
  ['TEXT: prohibited wording is accepted', 'text', PROJECTION,
    '  if (prohibited !== null) {', '  if (false) {',
    [T.negative], 'refuses wording the Lexicon prohibits'],
  ['TEXT: a deferred method is accepted', 'text', PROJECTION,
    '  if (method !== null) {', '  if (false) {',
    [T.negative], 'refuses wording the Lexicon prohibits and a method the profile defers'],
  ['TEXT: evidence chrome is accepted', 'text', PROJECTION,
    '  assertCustomerSurfaceClean(text);\n', '  void text;\n',
    [T.negative], 'refuses evidence chrome on the customer surface'],
  ['STRINGS: a page omits its own page number from the strings it prints', 'text', PROJECTION,
    '    if (chrome !== null) printed.add(pageLabel);\n', '',
    [T.unit], 'gives every page exactly the strings it prints'],
  ['STRINGS: the Ten-God presence marks are listed as printed strings', 'text', PROJECTION,
    "  'marks',\n", '',
    [T.unit], 'gives every page exactly the strings it prints'],
  ['STRINGS: the closing page loses its page number', 'text', PROJECTION,
    "draft.content.kind === 'closing' ? { ...draft.content, pageNumberLabel: pageLabel } : draft.content;", 'draft.content;',
    [T.unit], 'gives every page exactly the strings it prints'],
  ['STRINGS: an identifier is listed as a printed string', 'text', PROJECTION,
    "  'familyId',\n", '',
    [T.unit], 'prints no identifier or classification value'],
  ['NOTE: the method page no longer carries the data note', 'text', PROJECTION,
    "        dataNote: hasWarnings ? { label: label('dataNote'), text: label('dataNoteText') } : null,", '        dataNote: null,',
    [T.unit], 'which carries it'],
  ['NOTE: the data note is printed on a chart without warnings', 'text', PROJECTION,
    '  const hasWarnings = model.sourceWarnings.length > 0;', '  const hasWarnings = true;',
    [T.unit], 'carries no data note when the chart has no source warning'],
  ['NOTE: the identity page no longer points at the method page', 'text', PROJECTION,
    '  if (model.sourceWarnings.length > 0 && identity !== undefined', '  if (false && identity !== undefined',
    [T.unit], 'points the data note at the method page'],
  ['WU XING: the zero caption is printed although no phase is 0', 'text', PROJECTION,
    "...(wuXing.zeroPhases.length > 0 ? [label('wuXingZeroIsZero')] : [])", "label('wuXingZeroIsZero')",
    [T.unit], 'prints the zero caption only when a phase is 0'],

  // --- the long form ---------------------------------------------------------------------------------------------------
  ['LONG FORM: the visual contract no longer judges the chapter budget', 'text', PROJECTION,
    '    validateLongFormPlacement(placement);\n', '    void placement;\n',
    [T.negative], 'refuses a chapter outside the long-form word budget'],
  ['LONG FORM: the short final page no longer receives the reference panel', 'text', PROJECTION,
    '      const shortFinal = page.pageNumber === lastPage && fill < 0.6;', '      const shortFinal = page.pageNumber === lastPage && fill < 0;',
    [T.unit], 'places the reference panel on a short final chapter page only'],
  ['MEASURE: a word wider than the measure is not refused as WORD_EXCEEDS_MEASURE (it would surface downstream)', 'text', MEASURE,
    '    if (textWidth(word, styleId) > limit) {', '    if (false) {',
    [T.negative], 'refuses a word wider than its measure'],
  ['MEASURE: an unmeasurable character is measured as a CJK ideograph', 'text', MEASURE,
    '    if (isCjkIdeograph(codepoint)) {', '    if (true) {',
    [T.negative], 'refuses a character the pinned face cannot measure'],
  ['MEASURE: a CJK ideograph is measured narrower than one em', 'text', MEASURE,
    'export const CJK_IDEOGRAPH_ADVANCE_EM = 1;', 'export const CJK_IDEOGRAPH_ADVANCE_EM = 0.9;',
    [T.longForm], 'sets a CJK ideograph in running text one em wide'],
  ['MEASURE: rounding is half-up instead of Python half-even', 'text', MEASURE,
    '  return floor % 2 === 0 ? floor : floor + 1;', '  return floor + 1;',
    [T.longForm], 'rounds like Python'],
  ['MEASURE: a line may run into the tolerance', 'text', MEASURE,
    'export const LINE_TOLERANCE_CP = 300;', 'export const LINE_TOLERANCE_CP = 0;',
    [T.longForm], 'lays out fixture-customer-chapter.json exactly'],
  ['MEASURE: the last line of a paragraph is dropped', 'text', MEASURE,
    "  if (current !== '') lines.push(current);\n  return lines;", '  return lines;',
    [T.longForm], 'lays out fixture-customer-chapter.json exactly'],
  ['MEASURE: a fractional centipoint position is rounded up silently', 'text', MEASURE,
    '  if (!Number.isInteger(valueCp)) {', '  if (false) {',
    [T.negative], 'refuses a fractional centipoint position'],
  ['PAGINATE: the widow rule no longer keeps two lines together', 'text', LONG_FORM,
    '        if (remaining - take < 2) take = remaining - 2;', '        if (remaining - take < 0) take = remaining - 2;',
    [T.longForm], 'reproduces the canonical layout of widow-'],
  ['PAGINATE: a subhead no longer keeps with the next two lines', 'text', LONG_FORM,
    '          if (fit < remaining || c.bottom - (y0 + remaining * lead) < 2 * bodyLead) {', '          if (fit < remaining) {',
    [T.longForm], 'reproduces the canonical layout of subhead-'],
  ['PAGINATE: the balancer may split a band right after a subhead', 'text', LONG_FORM,
    "      if (a[1] === 'subhead') return false;\n", '',
    [T.longForm], 'reproduces the canonical layout of band-'],
  ['PAGINATE: a subhead inside a rebalanced band loses its space before', 'text', LONG_FORM,
    "      let y = c.y + (c.y > bandStart && kind === 'subhead' ? spaceBefore(kind) : 0);", '      let y = c.y;',
    [T.longForm], 'reproduces the canonical layout of band-'],
  ['PAGINATE: a module opening a region keeps its space before', 'text', LONG_FORM,
    '    let sb = y0 > page.top ? spaceBefore(kind) : 0;', '    let sb = spaceBefore(kind);',
    [T.longForm], 'reproduces the canonical layout of lead-'],
  ['PAGINATE: a module that does not fit no longer leads the next page', 'text', LONG_FORM,
    '    if (y0 + sb + module.heightCp > CONTENT_BOTTOM) {', '    if (false) {',
    [T.longForm], 'reproduces the canonical layout of module-'],
  ['PAGINATE: a band too short below a spanning module stays on the page', 'text', LONG_FORM,
    '      if (CONTENT_BOTTOM - bandStart < MIN_BAND_LINES * BASELINE_CP) {', '      if (false) {',
    [T.longForm], 'reproduces the canonical layout of module-'],
  ['PAGINATE: the opener band is no longer balanced around an atomic module', 'text', LONG_FORM,
    '    if (page.colmode !== 2) return;', '    return;',
    [T.longForm], 'lays out fixture-customer-chapter.json exactly'],
  ['PAGINATE: the opener header band loses its bottom space', 'text', LONG_FORM,
    '  return height + 3 * BASELINE_CP;', '  return height + 2 * BASELINE_CP;',
    [T.longForm], 'lays out fixture-customer-chapter.json exactly'],
  ['PAGINATE: a layout that breaks its own geometry is returned', 'text', LONG_FORM,
    '  if (findings.length > 0) {', '  if (false) {',
    [T.negative], 'refuses a layout that breaks its own geometry'],
  ['PAGINATE: a subhead taller than a fresh continuation column adds pages until the backstop', 'text', LONG_FORM,
    '            if (page.colmode === 1 && c.y === c.top) {', '            if (false) {',
    [T.negative], 'refuses a subhead taller than a fresh continuation column'],
  ['PAGINATE: a runaway layout is returned past the page backstop', 'text', LONG_FORM,
    '    if (pages.length >= MAX_LAYOUT_PAGES) {', '    if (false) {',
    [T.negative], 'refuses a layout that would run past the page backstop'],

  // --- the module boundary ----------------------------------------------------------------------------------------------
  ['BOUNDARY: another application module imports the presentation module', 'create',
    'src/application/etbz55-mutant-consumer.ts',
    `${TEMP}import { TEMPLATE_REF } from './presentation/index.js';\nexport const ref = TEMPLATE_REF;\n`,
    null, [T.architecture], 'is imported by no other application module'],
  ['BOUNDARY: the presentation module escapes its folder through a ./../ specifier', 'create',
    'src/application/presentation/etbz55-mutant-escape.ts',
    `${TEMP}export * from './../interpretation/index.js';\n`,
    null, [T.architecture], 'imports nothing but zod'],
  ['BOUNDARY: the presentation module deep-imports the visual system past its index', 'create',
    'src/application/presentation/etbz55-mutant-deep.ts',
    `${TEMP}export { DISPLAY_GLYPH_SET } from '../visual/glyphs.js';\n`,
    null, [T.visualBoundary], 'and there only through its index'],
  ['BOUNDARY: a sibling folder named presentation-x consumes the skill contract', 'create',
    'src/application/presentation-x/index.ts',
    `${TEMP}export { CHART_TERMINOLOGY } from '../skill/index.js';\n`,
    null, [T.skillBoundary], 'and there only through its index'],
  ['BOUNDARY: a sibling folder named presentation-x consumes the visual system', 'create',
    'src/application/presentation-x/index.ts',
    `${TEMP}export { DISPLAY_GLYPH_SET } from '../visual/index.js';\n`,
    null, [T.visualBoundary], 'and there only through its index'],
  ['BOUNDARY: a sibling folder named visual-x consumes the visual system and escapes the leaf check', 'create',
    'src/application/visual-x/index.ts',
    `${TEMP}export { DISPLAY_GLYPH_SET } from '../visual/index.js';\n`,
    null, [T.visualBoundary], 'and there only through its index'],
  ['BOUNDARY: a sibling folder named skill-x consumes the skill contract and escapes the leaf check', 'create',
    'src/application/skill-x/index.ts',
    `${TEMP}export { CHART_TERMINOLOGY } from '../skill/index.js';\n`,
    null, [T.skillBoundary], 'and there only through its index'],
  ['BOUNDARY: a sibling folder named presentation-x imports the presentation module', 'create',
    'src/application/presentation-x/index.ts',
    `${TEMP}export { TEMPLATE_REF } from '../presentation/index.js';\n`,
    null, [T.architecture], 'is imported by no other application module'],
  ['BOUNDARY: a served module imports a path the guard cannot resolve', 'create',
    'src/http/etbz55-mutant-dynamic.ts',
    `${TEMP}export const load = (specifier: string): Promise<unknown> => import(specifier);\n`,
    null, [T.architecture], 'is imported by no module under src/http'],
  ['BOUNDARY: a served module imports a path the ETBZ-49 leaf check cannot resolve', 'create',
    'src/http/etbz55-mutant-dynamic.ts',
    `${TEMP}export const load = (specifier: string): Promise<unknown> => import(specifier);\n`,
    null, [T.visualBoundary], 'is imported by no module under src/http'],
  ['BOUNDARY: a served module imports a path the ETBZ-51 leaf check cannot resolve', 'create',
    'src/http/etbz55-mutant-dynamic.ts',
    `${TEMP}export const load = (specifier: string): Promise<unknown> => import(specifier);\n`,
    null, [T.skillBoundary], 'is imported by no module under src/http'],
  ['BOUNDARY: a served module requires a computed path', 'create',
    'src/http/etbz55-mutant-require.ts',
    `${TEMP}const name = 'presentation';\nexport const load = (): unknown => require(\`../application/\${name}/index.js\`);\n`,
    null, [T.architecture], 'is imported by no module under src/http'],
  ['BOUNDARY: a served .mts module imports the presentation module', 'create',
    'src/http/etbz55-mutant-consumer.mts',
    `${TEMP}export { TEMPLATE_REF } from '../application/presentation/index.js';\n`,
    null, [T.architecture], 'is imported by no module under src/http'],
  ['EXTRACTOR: a type-position import is not seen', 'text', DEPENDENCY,
    '    } else if (ts.isImportTypeNode(node)) {', '    } else if (false) {',
    [T.dependency], 'sees the specifier in a type-position import'],
  ['BOUNDARY: a top-level src module imports the presentation module', 'create',
    'src/etbz55-mutant-root.ts',
    `${TEMP}export { TEMPLATE_REF } from './application/presentation/index.js';\n`,
    null, [T.architecture], 'is imported by no top-level src module'],
  ['BOUNDARY: a top-level src module imports the visual system', 'create',
    'src/etbz55-mutant-root.ts',
    `${TEMP}export { DISPLAY_GLYPH_SET } from './application/visual/index.js';\n`,
    null, [T.visualBoundary], 'is imported by no top-level src module'],
  ['BOUNDARY: a top-level src module imports the skill contract', 'create',
    'src/etbz55-mutant-root.ts',
    `${TEMP}export { CHART_TERMINOLOGY } from './application/skill/index.js';\n`,
    null, [T.skillBoundary], 'is imported by no top-level src module'],
  ['BOUNDARY: a module in a new src directory imports the presentation module', 'create',
    'src/etbz55-mutant-dir/probe.ts',
    `${TEMP}export { TEMPLATE_REF } from '../application/presentation/index.js';\n`,
    null, [T.architecture], 'scans every src directory there is'],
  ['BOUNDARY: a top-level src .mts module imports the presentation module', 'create',
    'src/etbz55-mutant-root.mts',
    `${TEMP}export { TEMPLATE_REF } from './application/presentation/index.js';\n`,
    null, [T.architecture], 'is imported by no top-level src module'],
  ['BOUNDARY: a module in a new src directory imports the visual system', 'create',
    'src/etbz55-mutant-dir/probe.ts',
    `${TEMP}export { DISPLAY_GLYPH_SET } from '../application/visual/index.js';\n`,
    null, [T.visualBoundary], 'scans every src directory there is'],
  ['BOUNDARY: a top-level src .mts module imports the visual system', 'create',
    'src/etbz55-mutant-root.mts',
    `${TEMP}export { DISPLAY_GLYPH_SET } from './application/visual/index.js';\n`,
    null, [T.visualBoundary], 'is imported by no top-level src module'],
  ['BOUNDARY: a module in a new src directory imports the skill contract', 'create',
    'src/etbz55-mutant-dir/probe.ts',
    `${TEMP}export { CHART_TERMINOLOGY } from '../application/skill/index.js';\n`,
    null, [T.skillBoundary], 'scans every src directory there is'],
  ['BOUNDARY: a top-level src .mts module imports the skill contract', 'create',
    'src/etbz55-mutant-root.mts',
    `${TEMP}export { CHART_TERMINOLOGY } from './application/skill/index.js';\n`,
    null, [T.skillBoundary], 'is imported by no top-level src module'],
  ['BOUNDARY: an application .mts module imports the skill contract', 'create',
    'src/application/etbz55-mutant-app.mts',
    `${TEMP}export { CHART_TERMINOLOGY } from './skill/index.js';\n`,
    null, [T.skillBoundary], 'is imported by no OTHER application module'],
  ['BOUNDARY: a served .mts module imports the visual system', 'create',
    'src/http/etbz55-mutant-visual.mts',
    `${TEMP}export { DISPLAY_GLYPH_SET } from '../application/visual/index.js';\n`,
    null, [T.visualBoundary], 'is imported by no module under src/http'],
  ['BOUNDARY: a served .mts module imports the skill contract', 'create',
    'src/http/etbz55-mutant-skill.mts',
    `${TEMP}export { CHART_TERMINOLOGY } from '../application/skill/index.js';\n`,
    null, [T.skillBoundary], 'is imported by no module under src/http'],
  ['EXTRACTOR: a computed require is skipped instead of reported', 'text', DEPENDENCY,
    '        } else {\n          // A computed specifier', '        } else if (isDynamicImport) {\n          // A computed specifier',
    [T.dependency], 'sees the specifier in a computed require'],
  ['BOUNDARY: the visual system escapes its folder through a ./../ specifier', 'create',
    'src/application/visual/etbz55-mutant-escape.ts',
    `${TEMP}export * from './../interpretation/index.js';\n`,
    null, [T.visualBoundary], 'imports nothing but zod and its own relative modules'],
  ['BOUNDARY: the skill contract escapes its folder through a ./../ specifier', 'create',
    'src/application/skill/etbz55-mutant-escape.ts',
    `${TEMP}export * from './../horoscope-model.js';\n`,
    null, [T.skillBoundary], 'imports nothing but zod, its own modules, the interpretation modules it binds'],
  ['BOUNDARY: a .mts file sits in the presentation module', 'create',
    'src/application/presentation/etbz55-mutant.mts',
    `${TEMP}export const probe = 1;\n`,
    null, [T.architecture], 'ships the declared modules, and no other file of any extension'],
  ['BOUNDARY: a TypeScript file sits deep in the renderer', 'create',
    'tools/pdf-renderer/qa/etbz55-mutant.ts',
    `${TEMP}export const probe = 1;\n`,
    null, [T.architecture], 'contains no TypeScript at any depth'],
  ['PURITY: the presentation module reads a clock', 'create',
    'src/application/presentation/etbz55-mutant-clock.ts',
    `${TEMP}export const stamp = Date.now();\n`,
    null, [T.architecture], 'does not reach for a clock'],

  // --- the evidence on disk ---------------------------------------------------------------------------------------------
  ['FACT: an animal label that differs from the Sizhu table is accepted', 'text', PROJECTION,
    '    if (released === undefined || released.tierDe !== pillar.tierDe) {', '    if (false) {',
    [T.negative], 'refuses an animal label the Sizhu table does not give the branch'],
  // Both run only inside `if foreign:`, so the added branch never executes; only the source changes.
  ['COVERAGE: the renderer gains a single-quoted finding code no canary observes', 'text', RENDERER_PY,
    'findings.append({"code": "TEXT_SET_IN_UNPINNED_FACE", "families": foreign})',
    "findings.append({\"code\": \"TEXT_SET_IN_UNPINNED_FACE\", \"families\": foreign} if foreign else {'code': 'ETBZ55_MUTANT_UNCANARIED'})",
    [T.contract], 'covers every check id and finding code the renderer can emit'],
  ['COVERAGE: the renderer sets a finding code through a conditional expression', 'text', RENDERER_PY,
    'findings.append({"code": "TEXT_SET_IN_UNPINNED_FACE", "families": foreign})',
    'findings.append({"code": "TEXT_SET_IN_UNPINNED_FACE" if foreign else etbz55_mutant_code, "families": foreign})',
    [T.contract], 'covers every check id and finding code the renderer can emit'],
  ['COVERAGE: the renderer raises a blocked check whose id is a variable', 'text', RENDERER_PY,
    'raise Blocked("PROJECTION_HASH", {"stated": stated, "actual": actual})', 'raise Blocked(etbz55_mutant_check, {"stated": stated, "actual": actual})',
    [T.contract], 'covers every check id and finding code the renderer can emit'],
  ['COVERAGE: the page check passes a finding code as a JavaScript shorthand', 'text', RENDERER_PY,
    'MIN_FONT_PX = 11, VISIBLE = 0.5, findings = [];',
    'MIN_FONT_PX = 11, VISIBLE = 0.5, findings = [];\n  const etbz55Mutant = (code) => findings.push({code});',
    [T.contract], 'covers every check id and finding code the renderer can emit'],
  ['COVERAGE: the renderer sets a finding code by subscript from a variable', 'text', RENDERER_PY,
    'findings.append({"code": "TEXT_SET_IN_UNPINNED_FACE", "families": foreign})',
    'findings.append({"code": "TEXT_SET_IN_UNPINNED_FACE", "families": foreign})\n                findings[-1]["code"] = etbz55_mutant_code',
    [T.contract], 'covers every check id and finding code the renderer can emit'],
  ['COVERAGE: the renderer sets a finding code from a variable', 'text', RENDERER_PY,
    'findings.append({"code": "TEXT_SET_IN_UNPINNED_FACE", "families": foreign})',
    'findings.append({"code": "TEXT_SET_IN_UNPINNED_FACE", "families": foreign} if foreign else {"code": etbz55_mutant_code})',
    [T.contract], 'covers every check id and finding code the renderer can emit'],
  ['COVERAGE: the final-artifact readback gains a finding code no canary observes', 'text', PDF_LAYER_PY,
    'findings.append({"code": "PDF_TEXT_NOT_UPRIGHT", "text": unit["text"][:20], "reason": "the glyph is turned, skewed or mirrored"})',
    'findings.append({"code": "PDF_TEXT_NOT_UPRIGHT", "text": unit["text"][:20], "reason": "the glyph is turned, skewed or mirrored"} if unit else {"code": "ETBZ55_MUTANT_UNCANARIED"})',
    [T.contract], 'covers every check id and finding code the renderer can emit'],
  ['COVERAGE: a new renderer module sets a finding code', 'create',
    'tools/pdf-renderer/etbz55_mutant.py',
    '# TEMPORARY MUTATION - scripts/verify-etbz55-presentation.mjs, never committed.\nFINDING = {"code": "ETBZ55_MUTANT_UNCANARIED"}\n',
    null, [T.contract], 'covers every check id and finding code the renderer can emit'],
  ['DATA: a stray file appears in the evidence folder', 'create',
    'docs/evidence/etbz-55/NOTES.md',
    '# TEMPORARY MUTATION - scripts/verify-etbz55-presentation.mjs, never committed.\n',
    null, [T.contract], 'holds exactly the declared files'],
];

const REPORT_DIR = mkdtempSync(join(tmpdir(), 'etbz55-mutants-'));
const REPORT = join(REPORT_DIR, 'vitest.json');

function run(tests) {
  rmSync(REPORT, { force: true });
  const result = spawnSync('npx', ['vitest', 'run', ...tests, '--reporter=json', `--outputFile=${REPORT}`], { encoding: 'utf8' });
  if (result.status === null || result.error !== undefined) return { outcome: 'DID_NOT_FINISH' };
  if (result.status === 0) return { outcome: 'GREEN' };
  let report;
  try {
    report = JSON.parse(readFileSync(REPORT, 'utf8'));
  } catch {
    return { outcome: 'NO_REPORT' };
  }
  const failed = (report.testResults ?? []).flatMap((file) => (file.assertionResults ?? []).filter((test) => test.status === 'failed'));
  if (failed.length === 0) return { outcome: 'NO_ASSERTION_FAILED' };
  if (failed.some((test) => (test.failureMessages ?? []).some((message) => /timed out/iu.test(message)))) return { outcome: 'TIMEOUT' };
  return {
    outcome: 'RED',
    failed: failed.map((test) => ({
      fullName: test.fullName,
      asserted: (test.failureMessages ?? []).some((message) => message.startsWith('AssertionError')),
    })),
  };
}

function verdictOf(verdict, killer) {
  if (verdict.outcome === 'GREEN') return 'STAYED GREEN — guard is decoration';
  if (verdict.outcome !== 'RED') return `RUN_ERROR (${verdict.outcome}) — not a proof`;
  if (killer === undefined || killer === null) return `RED (guard holds) <- ${verdict.failed[0].fullName}`;
  const named = verdict.failed.filter((test) => test.fullName.includes(killer));
  const by = named.find((test) => test.asserted);
  if (by !== undefined) return `RED (guard holds) <- ${by.fullName}`;
  return named.length > 0
    ? `RUN_ERROR (KILLER_DID_NOT_ASSERT: "${named[0].fullName}" threw instead of failing an assertion) — not a proof`
    : `RUN_ERROR (KILLED_BY_OTHER_TEST: "${verdict.failed[0].fullName}", expected "${killer}") — not a proof`;
}

const trackedState = () =>
  execFileSync('git', ['status', '--porcelain', '--', 'src', 'tests', 'scripts', 'docs', 'tools'], { encoding: 'utf8' }).trim();
const stateBefore = trackedState();

const ALL_SUITES = [T.unit, T.longForm, T.negative, T.contract, T.architecture, T.visualBoundary, T.skillBoundary, T.dependency];
const baseline = run(ALL_SUITES);
if (baseline.outcome !== 'GREEN') {
  process.stdout.write(`BASELINE_NOT_GREEN (${baseline.outcome}): the unmutated suites fail, so a red mutant would prove nothing\n`);
  process.exit(1);
}
process.stdout.write('BASELINE GREEN (unmutated)\n');

const results = [];
for (const [name, kind, file, find, replace, tests, killer] of MUTANTS) {
  let restore;
  try {
    if (kind === 'text') {
      const original = readFileSync(file, 'utf8');
      const occurrences = original.split(find).length - 1;
      if (occurrences !== 1) {
        results.push([name, `SETUP_ERROR (pattern occurs ${occurrences}x in ${file})`]);
        continue;
      }
      writeFileSync(file, original.replace(find, replace));
      restore = () => writeFileSync(file, original);
    } else if (kind === 'create') {
      if (existsSync(file)) {
        results.push([name, `SETUP_ERROR (${file} already exists)`]);
        continue;
      }
      const folder = dirname(file);
      const createdFolder = !existsSync(folder);
      if (createdFolder) mkdirSync(folder, { recursive: true });
      writeFileSync(file, find);
      restore = () => {
        rmSync(file, { force: true });
        if (createdFolder) rmSync(folder, { recursive: true, force: true });
      };
    } else {
      results.push([name, `SETUP_ERROR (unknown mutation kind "${kind}")`]);
      continue;
    }
    let verdict;
    try {
      verdict = run(tests);
    } finally {
      restore();
    }
    results.push([name, verdictOf(verdict, killer)]);
  } catch (error) {
    if (restore !== undefined) restore();
    results.push([name, `SETUP_ERROR (${error.message})`]);
  }
}
rmSync(REPORT_DIR, { recursive: true, force: true });

let killed = 0;
for (const [name, outcome] of results) {
  if (outcome.startsWith('RED')) killed += 1;
  process.stdout.write(`${name}\n    ${outcome}\n`);
}
const stateAfter = trackedState();
const residue = stateAfter === stateBefore ? '' : stateAfter;
if (residue.length > 0) process.stdout.write(`MUTATION_RESIDUE (tree differs from before the run):\n${residue}\n`);
const after = run(ALL_SUITES);
process.stdout.write(`\n${killed}/${MUTANTS.length} mutants killed · baseline after restore: ${after.outcome}\n`);
if (killed !== MUTANTS.length || after.outcome !== 'GREEN' || residue.length > 0) process.exit(1);
