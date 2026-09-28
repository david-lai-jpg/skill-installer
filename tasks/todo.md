# TODO

## In Progress
- Complete five CLI UX improvements. <!-- tracker: {"id":"cli-ux-followup","status":"active","updated":"2026-09-28"} -->
  Changed: searchable persistent batch picker; one install selection screen; launch menu; recoverable add/update input; multi-field draft with Save/Cancel; fail-closed catalog reads and validation before writes/imports; usage docs and terminal checks.
  Verified: 23-scenario PTY suite plus targeted menu-to-install scenario (24 total); all affected JS syntax checks; git diff --check. Real catalog and dependencies unchanged.
  Review: fresh astra review found signal cleanup and redirected-menu defects; both fixed and independently rechecked. Security review noted pre-existing display/concurrent-write risks; no expansion into those unrelated boundaries.
  Evidence: terminal transcripts skill-installer-ux-yx_js6j_.log and skill-installer-ux-65xk2e6m.log in the system temporary directory.
  Remaining: commit and push verified changes. Next: complete delivery on feat/batch-skill-selection; no PR requested.

## Done
- Improve CLI batch selection UX. <!-- tracker: {"id":"batch-selection-ux","status":"done","updated":"2026-09-28"} -->
  Changed: shared optional text filter and checkbox selection for delete/install; default-No deletion review; README usage; disposable PTY regression check.
  Verified: 10 terminal scenarios pass, JavaScript syntax checks and git diff --check pass. Fresh astra review found search loss; corrected and reviewer verified with no remaining material findings.
  Real catalog unchanged. Installed command links to this checkout. No dependencies added.
  Delivered: implementation commit d1a3dcf pushed to origin/feat/batch-skill-selection.
  Remaining: none. No blockers.
  Next: use skill-installer delete or install; no PR requested.
