import { gridImageRatio } from "../../builder/dataGridWidget.js";

// Canvas preview for article/search grids. With no preview data it shows sample
// cards, so the card options (image, title, excerpt, ratio, columns, gap) are
// visible while editing instead of a single "No results" line.
const SAMPLES = [1, 2, 3].map((n) => ({ id: `sample-${n}`, title: `Sample item ${n}`, excerpt: "A short excerpt shows how this card reads on the storefront.", author: "Author", date: "Jan 1, 2026" }));

export default function ContentGridPreview({ items = [], grid, columns = 3, style = {}, heading = "" }) {
  const rows = items.length ? items : SAMPLES.slice(0, Math.min(SAMPLES.length, Math.max(1, Number(grid.limit) || 3)));
  return <section style={style}>
    {heading ? <h2 style={{ margin: "0 0 12px" }}>{heading}</h2> : null}
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns},minmax(0,1fr))`, gap: grid.gap }}>
      {rows.map((item) => <article key={item.id} style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 14, display: "grid", gap: 8, opacity: items.length ? 1 : 0.85 }}>
        {grid.showImage ? (item.imageUrl ? <img src={item.imageUrl} alt={item.imageAlt || item.title} style={{ width: "100%", aspectRatio: gridImageRatio(grid.imageRatio), objectFit: "cover", borderRadius: 8 }} /> : <div aria-hidden="true" style={{ width: "100%", aspectRatio: gridImageRatio(grid.imageRatio) === "auto" ? "4 / 3" : gridImageRatio(grid.imageRatio), borderRadius: 8, background: "#f1f1f1" }} />) : null}
        {grid.showTitle ? <strong>{item.title}</strong> : null}
        {grid.showAuthor && item.author ? <small>{item.author}</small> : null}
        {grid.showDate && item.date ? <small style={{ color: "#777" }}>{item.date}</small> : null}
        {grid.showExcerpt && item.excerpt ? <p style={{ margin: 0, color: "#555" }}>{item.excerpt}</p> : null}
      </article>)}
    </div>
    {!items.length ? <div style={{ marginTop: 8, fontSize: 11, color: "#8a8a8a" }}>Sample cards. {grid.emptyText}</div> : null}
  </section>;
}
