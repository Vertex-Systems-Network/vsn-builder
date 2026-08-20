# Milestone N.3 — Developer Mode

Release: v2.5.76

N.3 completes the local Email Builder compatibility/export layer without enabling production email delivery.

Implemented:
- light/dark email preview,
- configurable dark-mode palette,
- email-client compatibility diagnostics,
- Gmail compiled-size/clipping warnings,
- Outlook Classic MSO/VML CTA fallback,
- HTML/MJML/plain-text export,
- client compatibility scores,
- backward-compatible Email Document v2 normalization.

Developer Mode limits:
- no SMTP/ESP sending,
- no real inbox screenshots,
- no claims of pixel-identical Gmail/Outlook rendering,
- no external Litmus/Email on Acid account integration,
- MJML is exported as source; VSN does not bundle the MJML compiler runtime.

No Prisma migration is required for N.3.
