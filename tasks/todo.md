# TODO

## In Progress

## Done
- Improve CLI batch selection UX. <!-- tracker: {"id":"batch-selection-ux","status":"done","updated":"2026-09-28"} -->
  Changed: shared optional text filter and checkbox selection for delete/install; default-No deletion review; README usage; disposable PTY regression check.
  Verified: 10 terminal scenarios pass, JavaScript syntax checks and git diff --check pass. Fresh astra review found search loss; corrected and reviewer verified with no remaining material findings.
  Real catalog unchanged. Installed command links to this checkout. No dependencies added.
  Delivered: implementation commit d1a3dcf pushed to origin/feat/batch-skill-selection.
  Remaining: none. No blockers.
  Next: use skill-installer delete or install; no PR requested.
