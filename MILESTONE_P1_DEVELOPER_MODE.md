# Milestone P.1 — Developer Mode

Version: 2.5.78

Milestone P.1 is implemented in Developer Mode. It does not enable production billing, production credentials or irreversible deployment behavior.

Scope:
- Dependency / Usage Graph
- Design Tokens 2.0
- App-wide Command Palette
- Dynamic Binding Inspector
- State / Condition Builder expansion

No new Prisma migration is required. Design Tokens 2.0 reuses `BuilderShopSetting.designTokensJson` through a backward-compatible metadata envelope.
