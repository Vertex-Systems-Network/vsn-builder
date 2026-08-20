# Milestone Q.4.6 — Email Studio 2.0 (Developer Mode)

VSN Email Builder is upgraded from a modal block editor to a full-canvas Email Studio while preserving the existing `BuilderEmailTemplate` persistence model, dynamic Shopify bindings, HTML renderer, MJML source export, plain-text export and N.3 compatibility diagnostics.

## Studio workspace

- Full-screen editor inside the embedded app viewport.
- Blocks, Layers, Data and Setup left workspaces.
- Design, Preview, Diagnostics and Code center modes.
- Content / Style inspector plus document-level Global Styles.
- Desktop/mobile canvas, light/dark preview and 50–140% zoom.
- Direct inline text editing on the canvas.
- Drag/reorder, duplicate, delete and selected-layer controls.
- Undo/redo history, Ctrl/Cmd+S save, Ctrl/Cmd+Z undo, Shift+Ctrl/Cmd+Z redo, Ctrl/Cmd+D duplicate, Delete/Backspace remove when focus is not in a field.

## Expanded email primitives

The original 14 blocks remain supported. Five new email-safe primitives are added: Logo, Navigation, Image + Text, Testimonial and Product Grid. The catalog now contains 19 block types.

## Data and export

Dynamic Shopify tokens remain first-class and preserve `{{ ... }}` placeholders in saved exports. The Data workspace exposes shop, customer, product, order, cart, discount, campaign and form tokens with preview values. The Code workspace exposes generated MJML, HTML and plain-text sources.

## GrapesJS reference

GrapesJS Studio SDK was used only as a product-capability reference. The proprietary Studio SDK/plugins are not bundled. VSN remains self-hosted and license-independent. A future optional adapter can evaluate the BSD-licensed `grapesjs-mjml` package separately.

## Safety

- No Prisma migration.
- No SMTP/ESP sending.
- No real inbox screenshot service.
- Existing client compatibility diagnostics and Outlook-safe HTML rendering remain active.
