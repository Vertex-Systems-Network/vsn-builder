# VSN Builder v2.5.106 — Q.6.3.5 Stock API Usage Percentage Progress

## Scope
- Shared client-safe quota percentage calculation.
- Percentage progress bars in Settings provider usage rows.
- Percentage progress bars in the shared Stock Images/Videos/Audio API Usage popup.
- Accessible progressbar semantics, responsive layout and dark mode.
- No database or Prisma schema changes.

## Calculation
When the provider reports `limit` and `remaining`, VSN computes `used = limit - remaining`, clamps invalid boundaries, and displays used and remaining percentages. If either numeric input is unavailable, no percentage bar is rendered.
