# AI Quality Agent

P1.5a establishes a read-only deterministic quality report for Builder content. It intentionally does not generate or execute fixes.

## Contract

`buildQualityReport(nodes, options)` combines existing VSN validators with bounded deterministic checks and returns:

- `pass`: false only when an `error` or `danger` finding exists;
- `score`: a transparent bounded diagnostic score;
- severity and category counts;
- prioritized, stable findings;
- a deterministic explanation headline and top priorities;
- scan bounds so truncation is never hidden.

The current score formula is included in the response as `scoreMethod`. It is diagnostic metadata, not a substitute for the individual validators.

## Deterministic sources

The report reuses:

- VSN output validation;
- accessibility scanner;
- responsive scanner;
- dynamic binding contracts and optional preview resolution;
- motion conflict and reduced-motion contracts;
- email compatibility analysis when an email document is supplied.

It also adds conservative checks for link syntax/protocols, current Shopify resource widgets used on mismatched templates, eager/high-priority media pressure and autoplay video.

Link checks are intentionally offline. They validate supported syntax and protocols; they do not claim that an HTTP destination exists or returns a successful status.

## Bounds

Page traversal is capped at 600 nodes and findings are capped at 200. The existing scanners receive the bounded copy rather than the unbounded input tree. If the node cap is reached, the report adds an explicit `node-scan-truncated` warning.

No report operation mutates the supplied nodes.

## Safety boundary

P1.5a has no route, model/provider call, database access, network access, command execution or persistence. Deterministic validators are authoritative for pass/fail.

A later P1.5b may create an explanation or proposed fix plan. Any executable fix path must be separate, reversible, explicitly invoked, and re-run this deterministic report before the result can be treated as valid.
