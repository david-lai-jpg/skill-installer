# TODO

## In Progress
- Deliver UX changes on master. <!-- tracker: {"id":"master-delivery","status":"active","updated":"2026-09-28"} -->
  Goal: merge feat/batch-skill-selection into master and push origin/master directly, as authorized.
  Verified: clean working tree; both local branches match their remote branches after fetch.
  Next: fast-forward master, push, and verify remote HEAD. Use master directly for future work in this repo per user instruction.

## Done
- Highlight skill names in bold cyan. <!-- tracker: {"id":"skill-name-highlight","status":"done","updated":"2026-09-28"} -->
  Changed: shared labels style only the name; picker applies styling after wrapping and keeps header sanitization; update search no longer colors the whole focused row.
  Verified: four targeted PTY checks pass for color, NO_COLOR, update search, and long wrapped names; affected JS syntax checks and git diff --check pass. No catalog or dependency changes.
  Delivered: 6841571 pushed to origin/feat/batch-skill-selection.
  Remaining: none. Next: run skill-installer; no reinstall needed.

- Show skill details in every skill-selection interface. <!-- tracker: {"id":"skill-choice-details","status":"done","updated":"2026-09-28"} -->
  Changed: shared terminal-safe name/category, command, and optional description label with prominent bullets; install/delete picker and review lists, update search, list, duplicate warning, and import conflicts. Wrapped picker rows with PgUp/PgDn detail scrolling; README and terminal checks updated.
  Verified: all 29 disposable PTY scenarios pass, including optional descriptions, narrow terminals, and long-detail scrolling; affected JS syntax checks and git diff --check pass. Catalog and dependencies unchanged.
  Review: fresh astra review found inaccessible overflowing detail; corrected and independently verified in a 40x12 terminal. No remaining material findings.
  Delivered: implementation commit 546dd8b pushed to origin/feat/batch-skill-selection.
  Remaining: none. Next: run skill-installer; existing linked install uses the updated labels. No PR requested.

- Complete five CLI UX improvements. <!-- tracker: {"id":"cli-ux-followup","status":"done","updated":"2026-09-28"} -->
  Changed: searchable persistent batch picker; one install selection screen; launch menu; recoverable add/update input; multi-field draft with Save/Cancel; fail-closed catalog reads and validation before writes/imports; usage docs and terminal checks.
  Verified: 23-scenario PTY suite plus targeted menu-to-install scenario (24 total); all affected JS syntax checks; git diff --check. Real catalog and dependencies unchanged.
  Review: fresh astra review found signal cleanup and redirected-menu defects; both fixed and independently rechecked. Security review confirmed no introduced vulnerabilities; pre-existing display/concurrent-write risks remain outside this change.
  Evidence: terminal transcripts skill-installer-ux-yx_js6j_.log and skill-installer-ux-65xk2e6m.log in the system temporary directory.
  Delivered: implementation commit 156ef10 pushed to origin/feat/batch-skill-selection.
  Remaining: none. Next: run skill-installer to use the menu; no reinstall needed. No PR requested.

- Improve CLI batch selection UX. <!-- tracker: {"id":"batch-selection-ux","status":"done","updated":"2026-09-28"} -->
  Changed: shared optional text filter and checkbox selection for delete/install; default-No deletion review; README usage; disposable PTY regression check.
  Verified: 10 terminal scenarios pass, JavaScript syntax checks and git diff --check pass. Fresh astra review found search loss; corrected and reviewer verified with no remaining material findings.
  Real catalog unchanged. Installed command links to this checkout. No dependencies added.
  Delivered: implementation commit d1a3dcf pushed to origin/feat/batch-skill-selection.
  Remaining: none. No blockers.
  Next: use skill-installer delete or install; no PR requested.
