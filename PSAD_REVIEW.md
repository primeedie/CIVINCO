# PSAD content review — 29 September 2026

Scope: the six existing public PSAD bank documents, their 72 questions, and the public PSAD formula/concept library. No Gemini requests are made by the migration or offline variations.

## Completed

- All 72 existing bank questions have explicit worked solutions: Set 1: 25; Set 2: 5; Set 3: 17; Set 4: 4; Set 5: 9; Set 6: 12.
- Recalculated the vector resultants, equilibrium, motion, concrete design, steel, seismic and footing exercises. Source-key disagreements and assumptions are explained alongside the relevant solutions.
- Distinguished minimum bar counts from maximum permitted counts; checked provided reinforcement, rather than simply rounding an area.
- Corrected acceleration units, the torsion modulus conversion, wire equilibrium, and factored demand versus nominal/design footing shear resistance.
- Added source section/table crops to all corresponding follow-ups; retained actual source figures and suppressed text-only excerpts.
- Corrected the head-to-tail vector diagram and labeled the axis unit vectors and force direction.
- Removed 22 example-only formula records and repaired incomplete symbolic relationships. The remaining 586 PSAD formula expressions pass strict KaTeX validation. Code coefficients and physical constants are intentionally retained.
- Kept PDF section grouping/order, corrected bank-entry numbers being mistaken for module page numbers, and kept unreviewed formulas accessible.
- Protected explicitly delimited LaTeX from prose normalization, improved equation line breaks/mobile overflow, and avoided repeated formula rendering on unrelated UI updates.
- Checked all 13 existing PSAD offline variation families. Their supported givens are recalculated locally; source diagrams with stale values are replaced or omitted.

## Important content conventions

The hollow-shaft diameter exercise explicitly asks for simultaneous active limits; a unique minimum hollow-shaft diameter cannot be inferred without an additional geometry/design condition. The solution explains the source's 128 mm answer and the checked unrounded value.

The column eccentricity comparison explicitly uses the source's gross-concrete convention and explains the difference when displaced concrete is deducted.

Footing questions explicitly state load factors, effective depth, strength-reduction factors and the minimum-steel convention. The spacing exercise now specifies the outside bar-center offsets. Unsafe shear checks are identified as failures, rather than presented as adequate designs.

## Verification and rollout

- 28 automated tests pass, including independent PSAD calculations, all 72 solution notation checks, integer grading and idempotent/private-record preservation.
- Three browser workflows pass, including reviewed PSAD examples on desktop and 390 px mobile layouts.
- Production TypeScript/Vite build and publishable-file secret scan pass.
- Startup applies `server/psad-repairs.mjs` and `server/psad-formulas.mjs` to unowned public PSAD records once per content revision; private uploads, existing personal practice sessions and other SPEX are preserved.
- Generate a fresh practice set to receive revised bank copies; existing personal attempts are intentionally retained.
- The older one-off repair scripts predate this review. Do not run them over the reviewed database; use the revisioned startup migration.
- Offline changed-value support covers the 13 implemented families, not arbitrary changes to every source question. The source PDFs and their original answers remain available for comparison.
