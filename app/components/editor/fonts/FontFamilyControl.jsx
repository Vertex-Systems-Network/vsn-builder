import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, Trash2, Upload, X } from "lucide-react";
import { VsnButton, VsnTextField, VsnSelect, VsnOption } from "../EditorUi";
import { AnchoredOverlay, ModalPortal } from "../OverlayManager";
import { useFontRegistry } from "./FontRegistryContext";

const primary = (value = "") => String(value || "").split(",")[0].trim().replace(/^[\'"]|[\'"]$/g, "");

export default function FontFamilyControl({ label = "Font family", value = "Inter, system-ui, sans-serif", fontWeight = 400, fontStyle = "normal", onChange }) {
  const { catalog, loading, ensureFontLoaded, uploadCustomFont, deleteCustomFont } = useFontRegistry();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [family, setFamily] = useState("");
  const [weight, setWeight] = useState("400");
  const [style, setStyle] = useState("normal");
  const [file, setFile] = useState(null);
  const triggerRef = useRef(null);

  useEffect(() => ensureFontLoaded(value, { weight: fontWeight, style: fontStyle }), [value, fontWeight, fontStyle, ensureFontLoaded]);

  const groups = useMemo(() => {
    const q = query.toLowerCase();
    const filter = (items) => (items || []).filter((item) => !q || item.family.toLowerCase().includes(q));
    return [
      { name: "Custom Fonts", items: filter(catalog.custom) },
      { name: "Google Fonts", items: filter(catalog.google) },
      { name: "System Fonts", items: filter(catalog.system) },
    ].filter((group) => group.items.length);
  }, [catalog, query]);

  const choose = (font) => {
    ensureFontLoaded(font.value, { weight: fontWeight, style: fontStyle });
    onChange?.(font.value);
    setOpen(false);
    setQuery("");
  };

  const submit = async () => {
    if (!family.trim() || !file) {
      setError("Family name and font file are required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const uploaded = await uploadCustomFont({ family: family.trim(), weight: Number(weight), style, file });
      if (uploaded) choose(uploaded);
      setUploadOpen(false);
      setFamily("");
      setFile(null);
    } catch (exception) {
      setError(exception.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="vsn-font-control">
      <span className="vsn-ui-field-label">{label}</span>
      <button ref={triggerRef} type="button" className="vsn-font-trigger" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
        <span style={{ fontFamily: value }}>{primary(value) || "Choose font"}</span>
        <ChevronDown size={15} />
      </button>

      <AnchoredOverlay
        open={open}
        anchorRef={triggerRef}
        placement="bottom-start"
        width={320}
        maxWidth="calc(100vw - 20px)"
        className="vsn-font-popover"
        onRequestClose={() => setOpen(false)}
      >
        <div className="vsn-font-search">
          <Search size={14} />
          <input autoFocus value={query} placeholder="Search fonts…" onChange={(event) => setQuery(event.target.value)} />
          {query ? <button type="button" onClick={() => setQuery("")}><X size={13} /></button> : null}
        </div>
        <div className="vsn-font-list">
          {loading ? <div className="vsn-font-loading">Refreshing Google font catalog…</div> : null}
          {groups.map((group) => (
            <section key={group.name}>
              <div className="vsn-font-group-title">{group.name}</div>
              {group.items.slice(0, query ? 160 : 70).map((font) => (
                <div key={`${group.name}-${font.id || font.family}-${font.weight || ""}`} className={`vsn-font-row ${primary(value) === font.family ? "active" : ""}`}>
                  <button
                    type="button"
                    onMouseEnter={() => font.provider === "Google" && ensureFontLoaded(font.value, { weight: fontWeight, style: fontStyle })}
                    onFocus={() => font.provider === "Google" && ensureFontLoaded(font.value, { weight: fontWeight, style: fontStyle })}
                    onClick={() => choose(font)}
                    style={{ fontFamily: font.value }}
                  >
                    <span>{font.family}</span>
                    {font.provider === "Custom" ? <small>{font.weight} · {font.style}</small> : null}
                  </button>
                  {font.provider === "Custom" ? (
                    <VsnButton variant="icon" size="sm" tone="critical" title="Delete custom font" onClick={async () => { if (confirm(`Delete ${font.family}?`)) await deleteCustomFont(font.id); }}>
                      <Trash2 size={13} />
                    </VsnButton>
                  ) : null}
                </div>
              ))}
            </section>
          ))}
        </div>
        <button className="vsn-font-upload-link" type="button" onClick={() => setUploadOpen(true)}><Upload size={14} />Upload custom font</button>
      </AnchoredOverlay>

      {uploadOpen ? (
        <ModalPortal>
          <div className="vsn-editor-modal-backdrop vsn-font-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setUploadOpen(false); }}>
            <div className="vsn-font-modal">
              <div className="vsn-font-modal-head">
                <div><strong>Upload custom font</strong><span>WOFF2, WOFF, TTF or OTF · max 8 MB</span></div>
                <VsnButton variant="icon" disabled={busy} onClick={() => setUploadOpen(false)}><X size={15} /></VsnButton>
              </div>
              <VsnTextField label="Font family" value={family} onInput={(event) => setFamily(event.currentTarget.value)} />
              <div className="vsn-font-upload-grid">
                <VsnSelect label="Weight" value={weight} onChange={(event) => setWeight(event.currentTarget.value)}>{["100","200","300","400","500","600","700","800","900"].map((item) => <VsnOption key={item} value={item}>{item}</VsnOption>)}</VsnSelect>
                <VsnSelect label="Style" value={style} onChange={(event) => setStyle(event.currentTarget.value)}><VsnOption value="normal">Normal</VsnOption><VsnOption value="italic">Italic</VsnOption></VsnSelect>
              </div>
              <label className="vsn-font-file"><Upload size={18} /><span>{file?.name || "Choose font file"}</span><input type="file" accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
              {error ? <div className="vsn-font-error">{error}</div> : null}
              <div className="vsn-font-modal-actions">
                <VsnButton disabled={busy} onClick={() => setUploadOpen(false)}>Cancel</VsnButton>
                <VsnButton variant="primary" loading={busy} disabled={busy || !family.trim() || !file} onClick={submit}>Upload font</VsnButton>
              </div>
            </div>
          </div>
        </ModalPortal>
      ) : null}
    </div>
  );
}
