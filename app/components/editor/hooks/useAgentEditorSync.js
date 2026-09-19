import { useCallback } from "react";

export default function useAgentEditorSync({
  pageId,
  historyIdx,
  designTokens,
  readGlobalStyles,
  readPageSettings,
  storageKey,
  setElements,
  setGlobalStyles,
  setPageSettings,
  setHistory,
  setHistoryIdx,
  setSelectedId,
  setSelectedIds,
  setStagedRevisionId,
  setRevisionDiff,
  setIsSaved,
  setAutosaveAt,
  setSaveStatus,
  setLocalizationData,
}) {
  return useCallback((data) => {
    const next = Array.isArray(data?.page?.content) ? structuredClone(data.page.content) : null;
    if (!next) return;
    setElements(next);
    setGlobalStyles({ ...readGlobalStyles(next), ...designTokens });
    setPageSettings(readPageSettings(next));
    setHistory((current) => [
      ...current.slice(0, historyIdx + 1),
      {
        elements: next,
        label: data?.status === "reverted" ? "Agent turn reverted" : "Agent draft edits applied",
        time: Date.now(),
        icon: "✦",
      },
    ]);
    setHistoryIdx((current) => current + 1);
    setSelectedId(null);
    setSelectedIds([]);
    setStagedRevisionId("");
    setRevisionDiff(null);
    setIsSaved(true);
    setAutosaveAt(Date.now());
    setSaveStatus(data?.status === "reverted" ? "Agent turn reverted" : "Agent changes saved");
    if (Number.isFinite(Number(data?.page?.version))) {
      setLocalizationData((current) => ({ ...current, pageVersion: Number(data.page.version) }));
    }
    try { localStorage.setItem(storageKey(pageId), JSON.stringify(next)); } catch {}
  }, [
    pageId, historyIdx, designTokens, readGlobalStyles, readPageSettings, storageKey,
    setElements, setGlobalStyles, setPageSettings, setHistory, setHistoryIdx,
    setSelectedId, setSelectedIds, setStagedRevisionId, setRevisionDiff, setIsSaved,
    setAutosaveAt, setSaveStatus, setLocalizationData,
  ]);
}
