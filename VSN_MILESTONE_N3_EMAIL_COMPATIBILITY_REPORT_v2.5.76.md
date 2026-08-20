# VSN Milestone N.3 — Email Compatibility, Dark Preview & MJML Export

Version: **2.5.76**  
Milestone: **N.3**  
Mode: **Developer**

## Delivered

1. Added deterministic email-client compatibility analysis with overall and per-client scores.
2. Added Gmail compiled-size diagnostics and clipping-risk warning thresholds.
3. Added Outlook Classic MSO/VML fallback markup for CTA buttons.
4. Added authored email dark-mode metadata/CSS and explicit Light/Dark editor preview.
5. Added configurable dark canvas/content/text/link colors.
6. Added portable MJML source export without introducing an MJML runtime dependency.
7. Added HTML, MJML and plain-text exports directly in the visual editor and template list.
8. Added compatibility health badges to saved email templates.
9. Preserved Email Document schema v2 and N.1 persistence; N.3 requires no database migration.

## Rendering boundary

VSN's table-based HTML renderer remains the authoritative local compiler. MJML is an export target. Real inbox screenshots and exact cross-version Gmail/Outlook rendering require a third-party inbox testing service and are intentionally not simulated as guaranteed output.

## Security / production boundary

Production sending remains disabled. No SMTP credentials, ESP tokens or customer-recipient delivery paths were added.
