# Module Map and Ownership

- `BuilderPanelHost.jsx`: panel composition only; shared formatting/browser/panel contracts have been extracted in Milestone G.
- `editor/PageEditor.jsx`: editor orchestration; future extraction target for collaboration, keyboard and workspace lifecycle hooks.
- `editor/Canvas.jsx`: canvas selection/drag/drop/viewport orchestration; future extraction target for viewport and DnD modules.
- `editor/PropertiesPanel.jsx`: inspector composition; controls should move by domain without changing Content/Style/Advanced contracts.
- `editor/EditorControls.jsx`: reusable editor field/control implementations.
- `editor/PreviewRenderer.jsx`: shared schema rendering surface; widget-specific rendering should migrate toward registry/SDK renderers.

Existing large files are tracked technical debt. Their current size is a ceiling, not a target.

## Widget Platform 2.0

- `builder/visualTemplate.js`: safe protected-template parser, interpolation and scoped CSS.
- `services/widget-studio.server.js`: tenant-scoped Widget Template/Custom Widget persistence.
- `sdk/visualWidgets.js`: merchant custom widget registration into the shared SDK registry.
- `components/builder-panel/WidgetStudioPanel.jsx`: Template Lab, visual field builder and SDK extension overview.
- `sdk/registry.js`: built-in, merchant and plugin extension ownership/rollback.
