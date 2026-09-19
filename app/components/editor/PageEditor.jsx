import { VsnButton, VsnTextField, VsnNumberField, VsnTextArea, VsnSelect, VsnOption, VsnCheckbox, VsnColorField, VsnSearchField, VsnUrlField, VsnDateField, VsnSpinner } from "./EditorUi";
import useCollaborationHeartbeat from "./hooks/useCollaborationHeartbeat.js";
import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createEditorCommand, editorHistoryEntry } from "../../builder/editorCommand.js";
import { buildEditorBindingContext } from "./bindingInspectorContext.js";
import {
  useFetcher,
} from "react-router";

import { INITIAL_CANVAS_ELEMENTS, PRODUCT_TEMPLATE_ELEMENTS, SEARCH_TEMPLATE_ELEMENTS, BLOG_TEMPLATE_ELEMENTS, ARTICLE_TEMPLATE_ELEMENTS } from "../../data/elements";
import { acceptsChildren, createWidget } from "../../builder/widgetRegistry";
import { mergeElementInteractions } from "../../builder/interactionSchema.js";
import { createSectionPreset } from "../../data/sectionPresets";
import {
  findNode,
  findParentId,
  insertNode,
  removeNode,
  updateNode,
  duplicateNode,
  cloneNodeWithNewIds,
  moveNode,
  relocateNode,
} from "../../builder/tree";

import EditorToolbar from "./EditorToolbar";
import ElementsSidebar from "./ElementsSidebar";
import Canvas from "./Canvas";
import PropertiesPanel from "./PropertiesPanel";
import HistoryPanel from "./HistoryPanel";
import RevisionsPanel from "./RevisionsPanel";
import PanelResizeHandle from "./PanelResizeHandle";
import PolarisIcon from "../ui/PolarisIcon";
import TemplateQAPanel from "./TemplateQAPanel";
import PreviewRenderer from "./PreviewRenderer";
import PageSettingsPanel from "./PageSettingsPanel";
import EditorProductivityLayer from "./EditorProductivityLayer";
import { useFontRegistry } from "./fonts/FontRegistryContext";
import { collectFontUsages } from "../../utils/font-runtime";
import { ModalPortal } from "./OverlayManager";
import EditorTooltipLayer from "./EditorTooltipLayer";
import ClientErrorReporter from "./ClientErrorReporter";
import AiBuilderPanel from "./AiBuilderPanel";
import CollaborationPanel from "./CollaborationPanel";
import LocalizationPanel from "./LocalizationPanel";
import { addComponentVariant, createComponentDefinition, updateComponentMasterDefaults } from "../../builder/componentSystem.js";
import { breakpointById, breakpointForWidth } from "../../builder/responsiveEngine.js";
import { applyReplacementText } from "../../builder/aiBuilder.js";
import { compareBuilderContents } from "../../builder/revisionDiff.js";
import { applyLocalizationOverrides } from "../../builder/localizationEngine.js";
import useTemplateBrowser from "./hooks/useTemplateBrowser.js";
import useEditorAppearance from "./hooks/useEditorAppearance.js";


const DEFAULT_GLOBAL_STYLES = {
  primaryColor: "#008060",
  textColor: "#1a1a1a",
  backgroundColor: "#ffffff",
  fontFamily: "Inter, system-ui, sans-serif",
  headingFontFamily: "inherit",
  lightboxEnabled: true, lightboxBackdrop: "#000000", lightboxBackdropOpacity: 0.86, lightboxMaxWidth: 96, lightboxMaxHeight: 92, lightboxShowClose: true, lightboxCloseOnBackdrop: true, lightboxCloseOnEscape: true, lightboxAnimation: "fade",
  buttonBackground: "#1a1a1a",
  buttonTextColor: "#ffffff",
  secondaryColor: "#6d7175",
  accentColor: "#008060",
  surfaceColor: "#ffffff",
  mutedSurfaceColor: "#f6f6f7",
  borderColor: "#e3e3e3",
  formBackground: "#ffffff",
  formTextColor: "#202223",
  formBorderColor: "#c9cccf",
  formRadius: "8px",
  buttonRadius: "8px",
  radiusSm: "6px",
  radiusMd: "12px",
  radiusLg: "20px",
  spacingBase: 4,
  headingScale: 1.25,
  shadowSm: "0 1px 2px rgba(0,0,0,.08)",
  shadowMd: "0 8px 24px rgba(0,0,0,.12)",
  shadowLg: "0 20px 50px rgba(0,0,0,.16)",
  containerMaxWidth: "1200px",
  mobileBreakpoint: 749,
  tabletBreakpoint: 989,
};

function readGlobalStyles(elements = []) {
  const node = elements.find((item) => item?.type === "global-styles");
  return { ...DEFAULT_GLOBAL_STYLES, ...(node?.props || {}) };
}

const DEFAULT_PAGE_SETTINGS = {
  headerEnabled: true,
  footerEnabled: true,
  headerId: "",
  footerId: "",
  seoTitle: "",
  seoDescription: "",
  canonical: "",
  ogTitle: "",
  ogDescription: "",
  ogImage: "",
  schemaEnabled: true,
  sticky: false,
  transparent: false,
  mobileMenu: true,
  mobileBreakpoint: 749,
  fullWidth: true,
  assignmentPriority: 100,
  includePath: "",
  excludePath: "",
  customerState: "any",
  campaignEnabled: true,
  campaignStart: "",
  campaignEnd: "",
  campaignTimezone: "UTC",
  campaignFallbackPageId: "",
  campaignTrigger: "delay",
  campaignDelayMs: 1500,
  campaignScrollPercent: 50,
  campaignInactivityMs: 8000,
  campaignClickSelector: "",
  campaignCartState: "any",
  campaignPageCount: 2,
  campaignFrequency: "session",
  campaignFrequencyHours: 24,
  campaignIncludePath: "",
  campaignExcludePath: "",
  campaignCustomerState: "any",
  campaignTemplates: "",
  campaignResourceHandles: "",
  campaignLanguages: "",
  campaignCountries: "",
  campaignUtmSource: "",
  campaignUtmMedium: "",
  campaignUtmCampaign: "",
  campaignCloseOnBackdrop: true,
  campaignCloseOnEscape: true,
  campaignShowClose: true,
  campaignDrawerSide: "right",
  campaignMaxWidth: 640,
};

function readPageSettings(elements = []) {
  const node = elements.find((item) => item?.type === "template-settings");
  return { ...DEFAULT_PAGE_SETTINGS, ...(node?.props || {}) };
}

function syncLibraryNodes(nodes = [], libraryItems = []) {
  const byId = new Map((Array.isArray(libraryItems) ? libraryItems : []).map((item) => [String(item.id), item]));
  const walk = (items) => (Array.isArray(items) ? items : []).map((node) => {
    if (!node || typeof node !== "object") return node;
    const libraryId = String(node.meta?.libraryItemId || "");
    const item = libraryId ? byId.get(libraryId) : null;
    if (item?.syncMode === "global" && item.content && !Array.isArray(item.content) && typeof item.content === "object") {
      const fresh = structuredClone(item.content);
      return { ...fresh, id: node.id, label: node.label || fresh.label, meta: { ...(fresh.meta || {}), ...(node.meta || {}), libraryItemId: libraryId, librarySync: "global" }, children: walk(fresh.children || []) };
    }
    return { ...node, children: walk(node.children || []) };
  });
  return walk(nodes);
}

const storageKey = (pageId) =>
  `vsn-builder:${pageId}`;

class EditorPanelBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("VSN editor panel error:", error, info); }
  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) this.setState({ error: null });
  }
  render() {
    if (!this.state.error) return this.props.children;
    return <div className="h-full w-full overflow-auto bg-white p-4"><div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800"><strong className="block">This settings panel recovered from an invalid control state.</strong><span className="mt-1 block">Select another widget or undo the last settings change. Canvas data is still preserved.</span></div></div>;
  }
}

function editorNodeId(prefix = "node") {
  try {
    if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
  } catch {}
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createStructureSection(widths = [100]) {
  const safeWidths = Array.isArray(widths) && widths.length ? widths : [100];
  const sectionId = editorNodeId("section");
  const columnsId = editorNodeId("columns");
  return {
    id: sectionId,
    type: "section",
    label: "Section",
    props: {},
    styles: { spacing: { paddingTop: "32px", paddingRight: "24px", paddingBottom: "32px", paddingLeft: "24px" } },
    children: [{
      id: columnsId,
      type: "columns",
      label: `${safeWidths.length} Column${safeWidths.length === 1 ? "" : "s"}`,
      props: { columns: safeWidths.length, columnWidths: safeWidths },
      styles: { gap: "20px", gridTemplateColumns: safeWidths.map((value) => `${value}fr`).join(" ") },
      children: safeWidths.map((value, index) => ({
        id: editorNodeId("container"),
        type: "container",
        label: `Column ${index + 1}`,
        props: { widthPercent: value },
        styles: { minHeight: "90px", flexDirection: "column", gap: "12px", border: { style: "dashed", width: "1px", color: "#e3e3e3", radius: "8px" }, spacing: { paddingTop: "12px", paddingRight: "12px", paddingBottom: "12px", paddingLeft: "12px" } },
        children: [],
      })),
    }],
  };
}

function loadPage(pageId, fallback = []) {
  try {
    const saved = localStorage.getItem(
      storageKey(pageId),
    );

    if (saved) {
      const parsed = JSON.parse(saved);

      if (Array.isArray(parsed)) {
        return parsed;
      }
    }

    return Array.isArray(fallback)
      ? fallback
      : INITIAL_CANVAS_ELEMENTS;
  } catch {
    return Array.isArray(fallback)
      ? fallback
      : INITIAL_CANVAS_ELEMENTS;
  }
}

export default function PageEditor({
  page,
  pagePermissions = {},
  featureFlags = {},
  initialCollaboration = {},
  collaborationActor = null,
  initialLocalization = {},
  shop = "",
  designTokens = {},
  serverRevisions = [],
  collections = [],
  products = [],
  headers = [],
  footers = [],
  reusableSections = [],
  libraryItems = [],
  componentUsage = {},
  previewCollection: initialPreviewCollection = null,
  previewProduct: initialPreviewProduct = null,
  previewBlog = null,
  previewArticle = null,
  previewSearch = null,
  initialElements = [],
  saving = false,
  saveResult,
  previewMode: isPreview = false,
  openLibraryOnLoad = false,
  openLocalizationOnLoad = false,
  onSave,
  onPublish,
  onBack,
  enabledWidgetIds = null,
  widgetPlatform = {},
}) {
  const { darkMode:editorDarkMode, toggle:toggleEditorTheme } = useEditorAppearance();
  const previewCollectionFetcher = useFetcher();
  const previewProductFetcher = useFetcher();
  const libraryFetcher = useFetcher();
  const marketplaceFetcher = useFetcher();
  const editorActionFetcher = useFetcher();
  const collaborationFetcher = useFetcher();
  const localizationFetcher = useFetcher();
  const aiFetcher = useFetcher();
  const templateBrowser = useTemplateBrowser({ initialLibraryItems:libraryItems, editorActionFetcher, libraryFetcher, marketplaceFetcher });
  const { libraryItems:editorLibraryItems, setLibraryItems:setEditorLibraryItems, marketplace:editorMarketplace, load:loadEditorLibrary, toggleLibraryFavorite:handleToggleLibraryFavorite, toggleMarketplaceFavorite:handleToggleMarketplaceFavorite, installMarketplace:handleInstallMarketplace } = templateBrowser;
  /*
   * IMPORTANT: initial render must be identical on the server and client.
   * Reading localStorage during render causes React hydration mismatches.
   * Local drafts are restored after hydration in the effect below.
   */
  const initial = useMemo(() => {
    const systemNodes = (Array.isArray(initialElements) ? initialElements : []).filter((item) => ["global-styles", "template-settings"].includes(item?.type));
    const contentNodes = (Array.isArray(initialElements) ? initialElements : []).filter((item) => !["global-styles", "template-settings"].includes(item?.type));
    const starter = page?.template === "product"
      ? PRODUCT_TEMPLATE_ELEMENTS
      : page?.template === "search"
        ? SEARCH_TEMPLATE_ELEMENTS
        : page?.template === "blog"
          ? BLOG_TEMPLATE_ELEMENTS
          : page?.template === "article"
            ? ARTICLE_TEMPLATE_ELEMENTS
            : INITIAL_CANVAS_ELEMENTS;
    const base = contentNodes.length > 0 ? [...systemNodes, ...contentNodes] : [...systemNodes, ...starter];
    return syncLibraryNodes(base, libraryItems);
  }, [page?.template, initialElements, libraryItems]);

  const [elements, setElements] =
    useState(initial);

  const [globalStyles, setGlobalStyles] =
    useState(() => ({ ...readGlobalStyles(initial), ...designTokens }));

  const [pageSettings, setPageSettings] =
    useState(() => readPageSettings(initial));
  const { ensureFontLoaded } = useFontRegistry();

  useEffect(() => {
    const usages = collectFontUsages({ elements, globalStyles });
    usages.forEach((usage) => {
      ensureFontLoaded(usage.family, {
        weights: [...usage.weights],
        styles: [...usage.styles],
      });
    });
  }, [elements, globalStyles, ensureFontLoaded]);

  const [showPageSettings, setShowPageSettings] = useState(false);
  const [libraryOpenSignal, setLibraryOpenSignal] = useState(0);
  const autoLibraryOpenedRef = useRef(false);

  const [selectedId, setSelectedId] =
    useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [insertTarget, setInsertTarget] = useState(null);
  const styleClipboardRef = useRef(null);
  const componentDefinitions = useMemo(() => (editorLibraryItems || []).filter((item) => item?.kind === "component" && !item?.deletedAt), [editorLibraryItems]);
  const pendingComponentCreateRef = useRef(null);
  const [isOnline, setIsOnline] = useState(true);

  const [
    previewCollection,
    setPreviewCollection,
  ] = useState(initialPreviewCollection);

  const [
    previewProduct,
    setPreviewProduct,
  ] = useState(initialPreviewProduct);

  const bindingContext = useMemo(() => buildEditorBindingContext({product:previewProduct,collection:previewCollection,article:previewArticle,blog:previewBlog,search:previewSearch}), [previewProduct,previewCollection,previewArticle,previewBlog,previewSearch]);

  const [deviceMode, setDeviceMode] =
    useState("desktop");
  const [previewWidth, setPreviewWidth] = useState(() => breakpointById(globalStyles, "desktop")?.previewWidth || 1440);
  const [canvasZoom, setCanvasZoom] = useState(1);

  const [isSaved, setIsSaved] =
    useState(true);

  const [showHistory, setShowHistory] =
    useState(false);

  const [showRevisions, setShowRevisions] = useState(false);
  const [showCollaboration, setShowCollaboration] = useState(false);
  const [collaborationData, setCollaborationData] = useState(initialCollaboration || {});
  const [showLocalization, setShowLocalization] = useState(false);
  const [localizationData, setLocalizationData] = useState(initialLocalization || {});
  const [localizationPreview, setLocalizationPreview] = useState(() => initialLocalization?.preview || { enabled:false, locale:"", marketKey:"*", overrides:{}, seo:{}, direction:"ltr" });
  const [revisionRows, setRevisionRows] = useState(serverRevisions || []);
  const [revisionDiff, setRevisionDiff] = useState(null);
  const [stagedRevisionId, setStagedRevisionId] = useState("");
  const [leftPanelWidth, setLeftPanelWidth] = useState(384);
  const [rightPanelWidth, setRightPanelWidth] = useState(384);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState(page?.title || "Untitled page");

  const [showQA, setShowQA] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const clipboardRef = useRef(null);
  const autosaveTimerRef = useRef(null);
  const editorRootRef = useRef(null);
  const [autosaveAt, setAutosaveAt] = useState(null);
  const [saveStatus, setSaveStatus] = useState("Saved");

  const [leftTab, setLeftTab] =
    useState("elements");

  const [rightTab, setRightTab] =
    useState("content");

  const [history, setHistory] =
    useState([{ elements: initial, label: "Page loaded", time: Date.now(), icon: "✦" }]);

  const [historyIdx, setHistoryIdx] =
    useState(0);

  const [pageTitle, setPageTitle] =
    useState(
      page?.title || "Untitled page",
    );

  const [
    previewCollectionHandle,
    setPreviewCollectionHandle,
  ] = useState(
    initialPreviewCollection?.handle ||
    page?.resourceHandle ||
    collections?.[0]?.handle ||
    "",
  );

  const [
    previewProductHandle,
    setPreviewProductHandle,
  ] = useState(
    initialPreviewProduct?.handle ||
    page?.resourceHandle ||
    products?.[0]?.handle ||
    "",
  );

  useEffect(() => { setRevisionRows(serverRevisions || []); }, [serverRevisions]);

  useEffect(() => {
    const result = collaborationFetcher.data;
    if (!result) return;
    if (result.collaboration) setCollaborationData(result.collaboration);
    if (result.intent === "revision-label" && result.revisionId) {
      setRevisionRows((rows) => rows.map((row) => row.id === result.revisionId ? { ...row, label: result.label || null } : row));
    }
    if (result.reloadEditor && typeof window !== "undefined") window.location.reload();
  }, [collaborationFetcher.data]);

  useEffect(() => {
    const result = localizationFetcher.data;
    if (!result) return;
    if (result.localization) setLocalizationData(result.localization);
    if (result.translation) {
      setLocalizationData((current) => ({ ...current, translations: [result.translation, ...(current?.translations || []).filter((row) => row.id !== result.translation.id && !(row.locale === result.translation.locale && row.marketKey === result.translation.marketKey))] }));
      setSaveStatus(result.translation.status === "translated" ? "Translation saved" : "Localization draft saved");
    }
    if (result.nativeSyncedAt && result.translationId) {
      setLocalizationData((current) => ({ ...current, translations: (current?.translations || []).map((row) => row.id === result.translationId ? { ...row, nativeSyncedAt: result.nativeSyncedAt } : row) }));
      setSaveStatus("Shopify translation synced");
    }
  }, [localizationFetcher.data]);

  useEffect(() => { setLocalizationData(initialLocalization || {}); }, [initialLocalization]);

  useEffect(() => {
    if (!openLocalizationOnLoad || isPreview || !featureFlags?.localizationMarketsV1) return;
    setShowLocalization(true);
    setShowCollaboration(false);
    setShowRevisions(false);
    setShowHistory(false);
    setShowPageSettings(false);
  }, [openLocalizationOnLoad, isPreview, featureFlags?.localizationMarketsV1]);

  useCollaborationHeartbeat({
    enabled: featureFlags?.collaborationReviewV1 === true,
    isPreview,
    selectedId,
    fetcherState: collaborationFetcher.state,
    onCollaboration: setCollaborationData,
  });

  useEffect(() => {
    if (!featureFlags?.collaborationReviewV1 || !saveResult?.success) return;
    if (saveResult.intent === "publish") setCollaborationData((current) => ({ ...current, workflowStatus: "published" }));
    if (saveResult.intent === "save") setCollaborationData((current) => ({ ...current, workflowStatus: ["approved", "published"].includes(current?.workflowStatus) ? "draft" : (current?.workflowStatus || "draft") }));
  }, [featureFlags?.collaborationReviewV1, saveResult]);

  const handleCollaborationAction = useCallback((intent, values = {}) => {
    if (!featureFlags?.collaborationReviewV1 || collaborationFetcher.state !== "idle") return;
    collaborationFetcher.submit({ intent, ...values }, { method: "post" });
  }, [featureFlags?.collaborationReviewV1, collaborationFetcher]);

  const handleLocalizationAction = useCallback((intent, values = {}) => {
    if (!featureFlags?.localizationMarketsV1 || localizationFetcher.state !== "idle") return;
    localizationFetcher.submit({ intent, ...values }, { method: "post" });
  }, [featureFlags?.localizationMarketsV1, localizationFetcher]);

  useEffect(() => {
    /* Restore a local draft only after hydration has completed. */
    try {
      const saved = localStorage.getItem(storageKey(page.id));
      if (!saved) return;

      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return;

      const serverJson = JSON.stringify(initial);
      const localJson = JSON.stringify(parsed);
      if (serverJson === localJson) return;

      setElements(parsed);
      setGlobalStyles({ ...readGlobalStyles(parsed), ...designTokens });
      setPageSettings(readPageSettings(parsed));
      setHistory([{
        elements: parsed,
        label: "Recovered local draft",
        time: Date.now(),
        icon: "↺",
      }]);
      setHistoryIdx(0);
      setIsSaved(false);
      setSaveStatus("Recovered local draft");
    } catch (error) {
      console.warn("VSN local draft restore skipped:", error);
    }
  }, [page.id]);

  useEffect(() => {
    if (libraryFetcher.data?.ok && ["save", "update", "favorite"].includes(libraryFetcher.data?.intent) && libraryFetcher.data.item) {
      setEditorLibraryItems((current) => [libraryFetcher.data.item, ...current.filter((item) => item.id !== libraryFetcher.data.item.id)]);
      if (libraryFetcher.data.intent !== "favorite") setSaveStatus(libraryFetcher.data.intent === "update" ? "Synced library item updated" : "Saved to Library");
    }
  }, [libraryFetcher.data]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("vsn-builder:panel-widths") || "{}");
      if (Number(saved.left) >= 320 && Number(saved.left) <= 768) setLeftPanelWidth(Number(saved.left));
      if (Number(saved.right) >= 320 && Number(saved.right) <= 768) setRightPanelWidth(Number(saved.right));
    } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem("vsn-builder:panel-widths", JSON.stringify({ left:leftPanelWidth, right:rightPanelWidth })); } catch {} }, [leftPanelWidth, rightPanelWidth]);

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine !== false);
    update(); window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const target = event.target;
      if (target?.closest?.("input,textarea,select,[contenteditable='true']")) return;
      if (!["+","=","-","0"].includes(event.key)) return;
      event.preventDefault();
      if (event.key === "0") setCanvasZoom(1);
      else if (event.key === "-" ) setCanvasZoom((value)=>Math.max(.25,Number((value-.1).toFixed(2))));
      else setCanvasZoom((value)=>Math.min(2,Number((value+.1).toFixed(2))));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    setEditorReady(false);
    let cancelled = false;
    let fallbackTimer;
    const startedAt = performance.now();

    const nextPaint = () => new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );

    const waitForEditorAssets = async () => {
      try {
        // The editor DOM is rendered underneath the loader. Wait until React has
        // committed the toolbar, sidebars and canvas before hiding the overlay.
        await nextPaint();

        const root = editorRootRef.current;
        const canvas = root?.querySelector?.('[data-vsn-canvas-root], [data-vsn-canvas]');
        if (!root || !canvas) await new Promise((resolve) => window.setTimeout(resolve, 80));

        if (document.fonts?.ready) {
          await Promise.race([
            document.fonts.ready.catch(() => undefined),
            new Promise((resolve) => window.setTimeout(resolve, 700)),
          ]);
        }

        const images = Array.from(root?.querySelectorAll?.('img') || []).filter((img) => !img.complete);
        if (images.length) {
          await Promise.race([
            Promise.allSettled(images.map((img) => new Promise((resolve) => {
              const done = () => resolve();
              img.addEventListener('load', done, { once: true });
              img.addEventListener('error', done, { once: true });
            }))),
            new Promise((resolve) => window.setTimeout(resolve, 900)),
          ]);
        }

        await nextPaint();
        const elapsed = performance.now() - startedAt;
        if (elapsed < 650) await new Promise((resolve) => window.setTimeout(resolve, 650 - elapsed));
      } catch (error) {
        console.warn('VSN editor readiness check recovered:', error);
      } finally {
        if (!cancelled) setEditorReady(true);
      }
    };

    waitForEditorAssets();
    // Absolute fail-safe: a failed font/image/browser API must never trap the user.
    fallbackTimer = window.setTimeout(() => { if (!cancelled) setEditorReady(true); }, 5000);

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
    };
  }, [page.id]);


  useEffect(() => {
    if (
      page?.template !==
      "collection"
    ) {
      return;
    }

    if (!previewCollectionHandle) {
      setPreviewCollection(null);
      return;
    }

    previewCollectionFetcher.submit(
      {
        intent:
          "preview-collection",
        handle:
          previewCollectionHandle,
      },
      {
        method: "post",
      },
    );
  }, [
    previewCollectionHandle,
    page?.template,
  ]);

  useEffect(() => {
    const data =
      previewCollectionFetcher.data;

    if (
      data?.success &&
      data?.intent ===
      "preview-collection"
    ) {
      setPreviewCollection(
        data.collection,
      );
    }
  }, [
    previewCollectionFetcher.data,
  ]);


  useEffect(() => {
    if (page?.template !== "product") return;
    if (!previewProductHandle) {
      setPreviewProduct(null);
      return;
    }

    previewProductFetcher.submit(
      { intent: "preview-product", handle: previewProductHandle },
      { method: "post" },
    );
  }, [previewProductHandle, page?.template]);

  useEffect(() => {
    const data = previewProductFetcher.data;
    if (data?.success && data?.intent === "preview-product") {
      setPreviewProduct(data.product);
    }
  }, [previewProductFetcher.data]);

  useEffect(() => {
    const data = editorActionFetcher.data;
    if (!data?.success) return;
    if (data.intent === "save-template") {
      if (data.item) setEditorLibraryItems((current) => [data.item, ...current.filter((item) => item.id !== data.item.id)]);
      setShowSaveTemplate(false); setSaveStatus("Template saved to My Library");
    }
    if (data.intent === "delete-page") onBack?.();
  }, [editorActionFetcher.data, onBack]);

  useEffect(() => {
    if (!openLibraryOnLoad || !editorReady || autoLibraryOpenedRef.current) return;
    autoLibraryOpenedRef.current = true;
    setLibraryOpenSignal(Date.now());
    loadEditorLibrary();
  }, [openLibraryOnLoad, editorReady, loadEditorLibrary]);

  const saveAsTemplate = useCallback(() => {
    const title = templateName.trim(); if (!title) return;
    editorActionFetcher.submit({ intent: "save-template", title, content: JSON.stringify(elements) }, { method: "post" });
  }, [editorActionFetcher, templateName, elements]);

  const deleteCurrentPage = useCallback(() => {
    if (!window.confirm("Move this template to Trash? Its generated CSS/JS will be removed and rebuilt if you restore it.")) return;
    editorActionFetcher.submit({ intent: "delete-page" }, { method: "post" });
  }, [editorActionFetcher]);

  const commit = useCallback(
    (next, label = "Updated element", icon = "•") => {
      const command = createEditorCommand(next, { label, icon });
      setElements(command.elements);
      setHistory((current) => [
        ...current.slice(0, historyIdx + 1),
        editorHistoryEntry(command),
      ]);
      setHistoryIdx((current) => current + 1);
      setIsSaved(false);
      setSaveStatus("Unsaved changes");
    },
    [historyIdx],
  );

  const handleCreateComponent = useCallback((explicitId = null) => {
    const id = explicitId || selectedId;
    const node = id ? findNode(elements, id) : null;
    if (!node || ["global-styles", "template-settings", "component-instance"].includes(node.type)) return;
    const name = window.prompt("Component name", node.label || "Component");
    if (!name?.trim()) return;
    const definition = createComponentDefinition(node, { name: name.trim() });
    pendingComponentCreateRef.current = { sourceId: id, title: name.trim() };
    libraryFetcher.submit({ intent: "save", title: name.trim(), kind: "component", category: "Components", syncMode: "global", content: JSON.stringify(definition) }, { method: "post", action: "/app/library" });
  }, [elements, selectedId, libraryFetcher]);

  const handleSaveComponentVariant = useCallback((item, name, propValues, rootPatch) => {
    if (!item?.id || item.kind !== "component") return;
    const definition = addComponentVariant(item.content || {}, { name, propValues, rootPatch });
    libraryFetcher.submit({ intent: "update", id: item.id, title: item.title, category: item.category || "Components", syncMode: "global", content: JSON.stringify(definition) }, { method: "post", action: "/app/library" });
  }, [libraryFetcher]);

  const handleUpdateComponentMaster = useCallback((item, propValues) => {
    if (!item?.id || item.kind !== "component") return;
    const definition = updateComponentMasterDefaults(item.content || {}, propValues || {});
    libraryFetcher.submit({ intent: "update", id: item.id, title: item.title, category: item.category || "Components", syncMode: "global", content: JSON.stringify(definition) }, { method: "post", action: "/app/library" });
  }, [libraryFetcher]);

  useEffect(() => {
    const data = libraryFetcher.data;
    const pending = pendingComponentCreateRef.current;
    if (!pending || !data?.ok || data.intent !== "save" || data.item?.kind !== "component") return;
    pendingComponentCreateRef.current = null;
    const source = findNode(elements, pending.sourceId);
    if (!source) return;
    const instance = {
      id: source.id,
      type: "component-instance",
      label: data.item.title || pending.title || "Component",
      props: { componentId: data.item.id, variantId: "default", propValues: {}, overrides: {}, activeSlot: "content", masterVersion: Number(data.item.content?.version || 1) },
      styles: {},
      meta: { ...(source.meta || {}), componentInstance: true },
      children: [],
    };
    const next = updateNode(elements, source.id, () => instance);
    commit(next, `Created component: ${data.item.title || pending.title}`, "◇");
    setSelectedId(instance.id); setSelectedIds([instance.id]); setLeftTab("inspector");
  }, [libraryFetcher.data, elements, commit]);

  const handlePageSettingsChange = (nextSettings) => {
    setPageSettings(nextSettings);
    const existingIndex = elements.findIndex((item) => item?.type === "template-settings");
    const settingsNode = {
      id: "__vsn_template_settings__",
      type: "template-settings",
      label: "Template Settings",
      props: nextSettings,
      styles: {},
      children: [],
    };
    const next = [...elements];
    if (existingIndex >= 0) next[existingIndex] = settingsNode;
    else next.unshift(settingsNode);
    commit(next, "Updated page settings", "⚙");
  };

  const handleUnlinkGlobalSection = (id) => {
    const node = findNode(elements, id);
    const section = reusableSections.find((item) => item.id === node?.props?.sectionId);
    if (!node || !section) return;
    const source = Array.isArray(section.content) ? section.content.filter((item) => !["global-styles", "template-settings"].includes(item?.type)) : [];
    const replacement = {
      ...cloneNodeWithNewIds({ id: node.id, type: "section", label: `${section.title} (Local)`, props: {}, styles: node.styles || {}, children: source }),
      id: node.id,
    };
    const next = updateNode(elements, id, () => replacement);
    commit(next, `Unlinked ${section.title}`, "⛓");
    setSelectedId(id);
  };

  const handleGlobalStylesChange = (patch) => {
    const nextGlobals = { ...globalStyles, ...patch };
    setGlobalStyles(nextGlobals);

    const existingIndex = elements.findIndex(
      (item) => item?.type === "global-styles",
    );
    const globalNode = {
      id: "__vsn_global_styles__",
      type: "global-styles",
      label: "Global Styles",
      props: nextGlobals,
      styles: {},
      children: [],
    };
    const next = [...elements];
    if (existingIndex >= 0) next[existingIndex] = globalNode;
    else next.unshift(globalNode);
    commit(next, "Updated global styles", "🎨");
  };

  const handleInsertPreset = (presetId) => {
    try {
      const preset = createSectionPreset(presetId);
      const next = insertNode(elements, preset, null);
      commit(next, `Inserted ${preset.label || "section preset"}`, "▦");
      setSelectedId(preset.id);
    } catch (error) {
      console.error("VSN section preset insert error:", error);
    }
  };

  const handleApplyAiResult = useCallback(({ operation, data }) => {
    if (!data?.ok) return;
    if (operation === "rewrite") {
      const next = applyReplacementText(elements, selectedId, data.plan?.replacementText || "");
      if (next !== elements) commit(next, "AI rewrote selected copy", "✦");
      setShowAI(false);
      return;
    }
    const generated = Array.isArray(data.nodes) ? structuredClone(data.nodes) : [];
    if (!generated.length) { setShowAI(false); return; }
    const systemNodes = elements.filter((item) => ["global-styles", "template-settings"].includes(item?.type));
    const contentNodes = elements.filter((item) => !["global-styles", "template-settings"].includes(item?.type));
    const next = ["page", "responsive"].includes(operation) ? [...systemNodes, ...generated] : [...systemNodes, ...contentNodes, ...generated];
    commit(next, `AI ${operation === "page" ? "generated page" : operation === "responsive" ? "repaired responsive layout" : "generated layout"}`, "✦");
    const firstId = generated[0]?.id || null;
    setSelectedId(firstId); setSelectedIds(firstId ? [firstId] : []);
    setShowAI(false);
  }, [elements, selectedId, commit]);

  const handleAgentResult = useCallback((data) => {
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
    try { localStorage.setItem(storageKey(page.id), JSON.stringify(next)); } catch {}
  }, [historyIdx, designTokens, page.id]);

  const handleDrop = ({
    type,
    nodeId,
    parentId = null,
    beforeId = null,
    afterId = null,
    mode = "create",
  }) => {
    if (mode === "move" && nodeId) {
      const moving = findNode(elements, nodeId);
      if (!moving || moving.meta?.locked) return;
      const nextElements = relocateNode(elements, nodeId, { parentId, beforeId, afterId });
      if (nextElements === elements) return;
      commit(nextElements, `Moved ${moving.label || moving.type}`, "↕");
      setSelectedId(nodeId);
      return;
    }

    if (!type) return;
    const widget = createWidget(type);
    let nextElements;
    if (beforeId || afterId) {
      const targetParent = parentId ? findNode(elements, parentId) : null;
      const siblings = parentId ? (targetParent?.children ?? []) : elements;
      let index = siblings.length;
      if (beforeId) {
        const beforeIndex = siblings.findIndex((item) => item.id === beforeId);
        index = beforeIndex >= 0 ? beforeIndex : siblings.length;
      } else if (afterId) {
        const afterIndex = siblings.findIndex((item) => item.id === afterId);
        index = afterIndex >= 0 ? afterIndex + 1 : siblings.length;
      }
      nextElements = insertNode(elements, widget, parentId, index);
    } else {
      nextElements = insertNode(elements, widget, parentId);
    }
    commit(nextElements, `Added ${widget.label || widget.type}`, "+");
    setInsertTarget(null);
    setSelectedId(widget.id); setLeftTab("inspector");
  };

  const handleRequestAddChild = useCallback((destination = {}) => {
    const parentId = destination?.parentId || null;
    if (parentId) {
      const parent = findNode(elements, parentId);
      if (!parent || !acceptsChildren(parent.type)) return;
    }
    setInsertTarget({ parentId, beforeId: destination?.beforeId || null, afterId: destination?.afterId || null });
    setLeftTab("elements");
  }, [elements]);

  const handleWidgetClickAdd = useCallback((type) => {
    const target = insertTarget || { parentId: null, beforeId: null, afterId: null };
    handleDrop({ type, ...target, mode: "create" });
  }, [insertTarget, elements]);

  const handleMoveNode = useCallback((id, destination) => {
    const selected = findNode(elements, id);
    if (!selected || selected.meta?.locked) return;
    if (destination?.parentId) {
      const targetParent = findNode(elements, destination.parentId);
      if (!targetParent || !acceptsChildren(targetParent.type)) return;
    }
    const next = relocateNode(elements, id, destination || {});
    if (next === elements) return;
    commit(next, `Moved ${selected.label || selected.type || "element"}`, "↕");
    setSelectedId(id);
  }, [elements, commit]);

  const handleAddStructure = useCallback((widths) => {
    const section = createStructureSection(widths);
    const next = insertNode(elements, section, null);
    commit(next, `Added ${widths?.length || 1}-column section`, "▦");
    setSelectedId(section.id); setLeftTab("inspector");
  }, [elements, commit]);

  const handleInsertReusableSection = useCallback((sectionId) => {
    const section = reusableSections.find((item) => item.id === sectionId);
    if (!section) return;
    const node = {
      id: editorNodeId("global-section"),
      type: "global-section",
      label: section.title || "Reusable Section",
      props: { sectionId },
      styles: {},
      children: [],
    };
    const next = insertNode(elements, node, null);
    commit(next, `Inserted ${node.label}`, "∞");
    setSelectedId(node.id);
  }, [elements, reusableSections, commit]);

  const handleUpdate = (id, patch) => {
    if (findNode(elements, id)?.meta?.locked) return;
    const nextElements = updateNode(
      elements,
      id,
      (node) => ({
        ...node,
        ...patch,

        props: patch.props
          ? {
            ...node.props,
            ...patch.props,
          }
          : node.props,

        styles: patch.styles
          ? {
            ...node.styles,
            ...patch.styles,
          }
          : node.styles,

        settings: patch.settings
          ? {
            ...node.settings,
            ...patch.settings,
          }
          : node.settings,

        interactions: patch.interactions
          ? mergeElementInteractions(node.interactions, patch.interactions)
          : node.interactions,
      }),
    );

    commit(nextElements, "Updated element", "✎");
  };

  const handleDelete = (id) => {
    if (findNode(elements, id)?.meta?.locked) return;
    const nextElements = removeNode(
      elements,
      id,
    );

    commit(nextElements, "Deleted element", "−");
    setSelectedId(null);
  };

  const handleDuplicate = useCallback((id = selectedId) => {
    if (!id) return;
    const selected = findNode(elements, id);
    if (selected?.meta?.locked) return;
    const result = duplicateNode(elements, id);
    if (!result.newId) return;
    commit(result.nodes, `Duplicated ${selected?.label || selected?.type || "element"}`, "⧉");
    setSelectedId(result.newId);
  }, [selectedId, elements, commit]);

  const handleCopy = useCallback((id = selectedId) => {
    if (!id) return;
    const selected = findNode(elements, id);
    if (!selected) return;
    clipboardRef.current = structuredClone(selected);
  }, [selectedId, elements]);

  const handlePaste = useCallback((targetId = selectedId) => {
    if (!clipboardRef.current) return;
    const clone = cloneNodeWithNewIds(clipboardRef.current);
    const parentId = targetId ? findParentId(elements, targetId) : null;
    const next = targetId
      ? insertNode(elements, clone, parentId, (() => {
          const siblings = parentId ? (findNode(elements, parentId)?.children || []) : elements;
          const index = siblings.findIndex((item) => item.id === targetId);
          return index >= 0 ? index + 1 : siblings.length;
        })())
      : insertNode(elements, clone, null);
    commit(next, `Pasted ${clone.label || clone.type || "element"}`, "⎘");
    setSelectedId(clone.id); setSelectedIds([clone.id]);
  }, [elements, selectedId, commit]);

  const handleMove = useCallback((id, direction) => {
    const selected = findNode(elements, id);
    if (selected?.meta?.locked) return;
    const next = moveNode(elements, id, direction);
    if (next === elements) return;
    commit(next, `Moved ${selected?.label || selected?.type || "element"} ${direction}`, direction === "up" ? "↑" : "↓");
  }, [elements, commit]);

  const handleRename = useCallback((id, label) => {
    if (findNode(elements, id)?.meta?.locked) return;
    const next = updateNode(elements, id, (node) => ({ ...node, label }));
    commit(next, `Renamed element to ${label}`, "✎");
  }, [elements, commit]);

  const toggleMeta = useCallback((id, key) => {
    const next = updateNode(elements, id, (node) => ({
      ...node,
      meta: { ...(node.meta || {}), [key]: node.meta?.[key] !== true },
    }));
    commit(next, `${key === "hidden" ? "Toggled visibility" : "Toggled lock"}`, key === "hidden" ? "◉" : "🔒");
  }, [elements, commit]);

  const handleSelect = useCallback((id, event = null) => {
    if (!id) { setSelectedId(null); setSelectedIds([]); return; }
    setLeftTab("inspector");
    const additive = Boolean(event?.shiftKey || event?.metaKey || event?.ctrlKey);
    if (!additive) { setSelectedId(id); setSelectedIds([id]); return; }
    setSelectedIds((current) => {
      const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
      setSelectedId(next.includes(id) ? id : (next[next.length - 1] || null));
      return next;
    });
  }, []);

  const activeSelectionIds = (explicitId = null) => explicitId ? [explicitId] : (selectedIds.length > 1 ? selectedIds : (selectedId ? [selectedId] : []));

  const handleBulkDelete = useCallback((explicitId = null) => {
    const ids = activeSelectionIds(explicitId); if (!ids.length) return;
    let next = elements; ids.forEach((id) => { const node = findNode(next, id); if (!node?.meta?.locked) next = removeNode(next, id); });
    commit(next, ids.length > 1 ? `Deleted ${ids.length} elements` : "Deleted element", "delete");
    setSelectedId(null); setSelectedIds([]);
  }, [elements, selectedIds, selectedId, commit]);

  const handleBulkDuplicate = useCallback((explicitId = null) => {
    const ids = activeSelectionIds(explicitId); if (!ids.length) return;
    let next = elements; const newIds = [];
    ids.forEach((id) => { const result = duplicateNode(next, id); next = result.nodes; if (result.newId) newIds.push(result.newId); });
    commit(next, `Duplicated ${newIds.length || ids.length} element${ids.length === 1 ? "" : "s"}`, "duplicate");
    setSelectedIds(newIds); setSelectedId(newIds[newIds.length - 1] || null);
  }, [elements, selectedIds, selectedId, commit]);

  const handleCopyStyles = useCallback((explicitId = null) => {
    const id = explicitId || selectedId;
    const node = id ? findNode(elements, id) : null;
    if (!node) return; styleClipboardRef.current = structuredClone(node.styles || {}); setSaveStatus("Styles copied");
  }, [elements, selectedId]);

  const handlePasteStyles = useCallback((explicitId = null) => {
    if (!styleClipboardRef.current) return; const ids = activeSelectionIds(explicitId); if (!ids.length) return;
    let next = elements; ids.forEach((id) => { next = updateNode(next, id, (node) => ({ ...node, styles: structuredClone(styleClipboardRef.current) })); });
    commit(next, `Pasted styles to ${ids.length} element${ids.length === 1 ? "" : "s"}`, "paint");
  }, [elements, selectedIds, selectedId, commit]);

  const handleMoveSelection = useCallback((position) => {
    const ids = activeSelectionIds(); if (!ids.length) return; const selectedNodes = ids.map((id) => findNode(elements, id)).filter(Boolean);
    let next = elements; ids.forEach((id) => { next = removeNode(next, id); });
    const clones = selectedNodes; next = position === "top" ? [...clones, ...next] : [...next, ...clones];
    commit(next, `Moved ${ids.length} selected element${ids.length === 1 ? "" : "s"} to ${position}`, "move");
  }, [elements, selectedIds, selectedId, commit]);

  const handleSaveToLibrary = useCallback(() => {
    const ids = activeSelectionIds(); if (!ids.length) return;
    const nodes = ids.map((id) => findNode(elements, id)).filter(Boolean); if (!nodes.length) return;
    const defaultTitle = nodes.length === 1 ? (nodes[0].label || "Saved element") : `Saved selection (${nodes.length})`;
    const title = window.prompt("Library item name", defaultTitle); if (!title?.trim()) return;
    const globalSync = window.confirm("Keep this item globally synced when it is inserted? Cancel = local reusable copy.");
    let content; let kind;
    if (nodes.length === 1) { content = structuredClone(nodes[0]); kind = ["section","container"].includes(nodes[0].type) ? nodes[0].type : "widget"; }
    else { content = { id: editorNodeId("section"), type: "section", label: title.trim(), props: {}, styles: {}, children: nodes.map((node) => structuredClone(node)) }; kind = "section"; }
    libraryFetcher.submit({ intent: "save", title: title.trim(), kind, category: "Personal", syncMode: globalSync ? "global" : "local", content: JSON.stringify(content) }, { method: "post", action: "/app/library" });
  }, [elements, selectedIds, selectedId, libraryFetcher]);

  const handleUpdateSyncedLibraryItem = useCallback(() => {
    const node = selectedId ? findNode(elements, selectedId) : null;
    const libraryItemId = node?.meta?.libraryItemId;
    if (!node || !libraryItemId) {
      window.alert("Select a globally synced library element first.");
      return;
    }
    const item = editorLibraryItems.find((entry) => entry.id === libraryItemId);
    if (!item) { window.alert("The linked library item could not be found."); return; }
    if (!window.confirm(`Update the global library item “${item.title}”? Every storefront instance linked to it will use this version.`)) return;
    const content = structuredClone(node);
    content.meta = { ...(content.meta || {}), libraryItemId, librarySync: "global" };
    libraryFetcher.submit({ intent: "update", id: libraryItemId, title: item.title, category: item.category || "Personal", syncMode: "global", content: JSON.stringify(content) }, { method: "post", action: "/app/library" });
  }, [elements, selectedId, editorLibraryItems, libraryFetcher]);

  const handleSaveCurrentStyle = useCallback(() => {
    const node = selectedId ? findNode(elements, selectedId) : null; if (!node) return;
    const title = window.prompt("Style preset name", `${node.label || "Element"} style`); if (!title?.trim()) return;
    libraryFetcher.submit({ intent: "save", title: title.trim(), kind: "style", category: "Styles", syncMode: "local", content: JSON.stringify({ styles: structuredClone(node.styles || {}) }) }, { method: "post", action: "/app/library" });
  }, [elements, selectedId, libraryFetcher]);

  const handleApplyLibraryStyle = useCallback((item) => {
    if (!item?.content || !selectedId) return;
    const presetStyles = item.content.styles || item.content;
    const ids = activeSelectionIds(); let next = elements;
    ids.forEach((id) => { next = updateNode(next, id, (node) => ({ ...node, styles: structuredClone(presetStyles || {}) })); });
    commit(next, `Applied style: ${item.title || "Saved style"}`, "paint");
  }, [elements, selectedId, selectedIds, commit]);

  const handleInsertLibraryItem = useCallback((item) => {
    if (!item) return;
    if (item.kind === "component") {
      const node = { id: editorNodeId("component"), type: "component-instance", label: item.title || "Component", props: { componentId: item.id, variantId: "default", propValues: {}, overrides: {}, activeSlot: item.content?.slots?.[0]?.name || "content", masterVersion: Number(item.content?.version || 1) }, styles: {}, meta: { componentInstance: true }, children: [] };
      const next = insertNode(elements, node, null); commit(next, `Inserted component: ${item.title || "Component"}`, "◇"); setSelectedId(node.id); setSelectedIds([node.id]); setLeftTab("inspector"); return;
    }
    if (item.kind === "style") { if (!selectedId || !item.content) return; styleClipboardRef.current = structuredClone(item.content.styles || item.content); handlePasteStyles(); return; }
    if (item.kind === "page" && Array.isArray(item.content)) {
      const nodes = item.content.filter((node) => !["global-styles","template-settings"].includes(node?.type)).map((node) => cloneNodeWithNewIds(node));
      if (!nodes.length) return;
      const systemNodes = elements.filter((node) => ["global-styles","template-settings"].includes(node?.type));
      const next = [...systemNodes, ...nodes]; commit(next, `Applied template: ${item.title || "page"}`, "library"); setSelectedId(nodes[0].id); setSelectedIds([nodes[0].id]); setLeftTab("inspector"); return;
    }
    const source = Array.isArray(item.content) ? item.content[0] : item.content; if (!source || typeof source !== "object") return;
    const node = cloneNodeWithNewIds(source);
    if (item.syncMode === "global") node.meta = { ...(node.meta || {}), libraryItemId: item.id, librarySync: "global" };
    const next = insertNode(elements, node, null); commit(next, `Inserted ${item.title || "library item"}`, "library"); setSelectedId(node.id); setSelectedIds([node.id]); setLeftTab("inspector");
  }, [elements, selectedId, commit, handlePasteStyles]);

  const handleUndo = () => {
    if (historyIdx <= 0) {
      return;
    }

    const nextIndex = historyIdx - 1;

    setHistoryIdx(nextIndex);
    setElements(history[nextIndex].elements);
    setIsSaved(false);
  };

  const handleRedo = () => {
    if (
      historyIdx >=
      history.length - 1
    ) {
      return;
    }

    const nextIndex = historyIdx + 1;

    setHistoryIdx(nextIndex);
    setElements(history[nextIndex].elements);
    setIsSaved(false);
  };

  const handleSave = () => {
    localStorage.setItem(
      storageKey(page.id),
      JSON.stringify(elements),
    );

    onSave?.({
      title: pageTitle,
      elements,
      autosave: false,
    });

    setSaveStatus("Saving…");
  };

  const handlePublish = () => {
    const confirmed = window.confirm("Publish this version to the storefront? The current published version will remain available in Revisions for rollback.");
    if (!confirmed) return;
    localStorage.setItem(
      storageKey(page.id),
      JSON.stringify(elements),
    );

    localStorage.setItem(
      `${storageKey(page.id)}:published`,
      JSON.stringify({
        version: 1,
        pageId: page.id,
        elements,
      }),
    );

    onPublish?.({
      title: pageTitle,
      elements,
    });

    setSaveStatus("Publishing…");
  };

  useEffect(() => {
    // A selected server revision is a preview-only canvas state until the user
    // explicitly clicks Apply revision. Do not let autosave persist it early.
    if (isPreview || isSaved || stagedRevisionId) return undefined;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    setSaveStatus(isOnline ? "Autosaving…" : "Offline — changes saved locally");
    autosaveTimerRef.current = setTimeout(() => {
      // Crash recovery must continue even while Shopify/Admin API is offline.
      localStorage.setItem(storageKey(page.id), JSON.stringify(elements));
      setAutosaveAt(Date.now());
      if (!isOnline || saving) {
        setSaveStatus(!isOnline ? "Offline — changes saved locally" : "Waiting to autosave…");
        return;
      }
      onSave?.({ title: pageTitle, elements, autosave: true });
      setSaveStatus("Autosave sent…");
    }, 1200);
    return () => { if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current); };
  }, [elements, pageTitle, isSaved, isPreview, stagedRevisionId, onSave, page.id, isOnline, saving]);

  useEffect(() => {
    if (!saveResult) return;
    if (saveResult.success) {
      setIsSaved(true);
      setAutosaveAt(Date.now());
      setSaveStatus(saveResult.intent === "publish" ? "Published" : "Saved");
      if (Number.isFinite(Number(saveResult.version))) setLocalizationData((current) => ({ ...current, pageVersion: Number(saveResult.version) }));
      return;
    }
    if (saveResult.conflict) {
      setIsSaved(false);
      setSaveStatus("Save conflict — reload required");
      return;
    }
    if (saveResult.error) {
      setIsSaved(false);
      setSaveStatus("Save failed");
    }
  }, [saveResult]);

  useEffect(() => {
    const beforeUnload = (event) => {
      if (isSaved) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [isSaved]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? handleRedo() : handleUndo(); return; }
      if (mod && event.key.toLowerCase() === "c" && !typing) { event.preventDefault(); handleCopy(); return; }
      if (mod && event.key.toLowerCase() === "v" && !typing) { event.preventDefault(); handlePaste(); return; }
      if (mod && event.key.toLowerCase() === "d" && !typing) { event.preventDefault(); handleBulkDuplicate(); return; }
      if ((event.key === "Delete" || event.key === "Backspace") && !typing && selectedId) { event.preventDefault(); handleBulkDelete(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, selectedIds, elements, handleCopy, handlePaste, handleBulkDuplicate, handleBulkDelete, historyIdx, history]);

  const handleBackRequest = useCallback(() => {
    if (!isSaved) {
      const confirmed = window.confirm(
        "You have unsaved changes. Leave the editor and discard those changes?",
      );
      if (!confirmed) return;
    }
    onBack?.();
  }, [isSaved, onBack]);

  const handleStageRevision = useCallback((revision) => {
    if (!revision?.contentJson) return;
    try {
      const parsed = JSON.parse(revision.contentJson);
      if (!Array.isArray(parsed)) throw new Error("Revision content must be an array.");
      setRevisionDiff(compareBuilderContents(elements, parsed));
      setElements(parsed);
      setGlobalStyles({ ...readGlobalStyles(parsed), ...designTokens });
      setPageSettings(readPageSettings(parsed));
      setHistory((current) => [
        ...current.slice(0, historyIdx + 1),
        {
          elements: parsed,
          label: `Revision: ${revision.title || "Saved revision"}`,
          time: Date.now(),
          icon: "revision",
        },
      ]);
      setHistoryIdx((current) => current + 1);
      if (revision.title) setPageTitle(revision.title.replace(/^Before restore:\s*/, ""));
      setSelectedId(null);
      setStagedRevisionId(revision.id);
      setIsSaved(false);
      setSaveStatus("Revision preview loaded");
    } catch (error) {
      console.error("VSN revision preview error:", error);
      window.alert("This revision could not be loaded.");
    }
  }, [historyIdx, elements, designTokens]);

  const handleApplyRevision = useCallback(() => {
    if (!stagedRevisionId) return;
    localStorage.setItem(storageKey(page.id), JSON.stringify(elements));
    onSave?.({ title: pageTitle, elements });
    setIsSaved(true);
    setSaveStatus("Revision applied and saved");
    setStagedRevisionId("");
  }, [stagedRevisionId, page.id, elements, pageTitle, onSave]);



  const displayElements = localizationPreview?.enabled ? applyLocalizationOverrides(elements, localizationPreview.overrides || {}) : elements;
  const selectedElement = selectedId
    ? findNode(elements, selectedId)
    : null;

  const selectedHeader = pageSettings.headerEnabled !== false
    ? (pageSettings.headerId ? headers.find((item) => item.id === pageSettings.headerId) : headers.find((item) => item.isDefault) || headers[0])
    : null;
  const selectedFooter = pageSettings.footerEnabled !== false
    ? (pageSettings.footerId ? footers.find((item) => item.id === pageSettings.footerId) : footers.find((item) => item.isDefault) || footers[0])
    : null;

  /*
   * Dedicated preview route:
   * /app/builder/:id?preview=true
   */
  if (isPreview) {
    return (
      <div className="min-h-screen bg-white">
        <div className="fixed right-4 top-4 z-[9999] flex items-center gap-2">
          <VsnButton
            type="button"
            onClick={() => {
              if (
                window.opener &&
                !window.opener.closed
              ) {
                window.close();
                return;
              }

              window.history.back();
            }}
            className="rounded-lg border border-[#d9d9d9] bg-white px-4 py-2 text-sm font-medium text-[#1a1a1a] shadow-sm hover:bg-[#f6f6f7]"
          >
            Close preview
          </VsnButton>
        </div>

        {elements.length > 0 ? (
          <>
            {!["header", "footer"].includes(page?.template) && selectedHeader && (
              <div style={{ position: readPageSettings(selectedHeader.content).sticky ? "sticky" : "relative", top: 0, zIndex: 50 }}>
                <PreviewRenderer elements={(selectedHeader.content || []).filter((item) => !["global-styles", "template-settings"].includes(item?.type))} reusableSections={reusableSections} componentDefinitions={componentDefinitions} globalStyles={readGlobalStyles(selectedHeader.content || [])} widgetTemplates={widgetPlatform.templates} customWidgetCss={widgetPlatform.customCss} />
              </div>
            )}
            <PreviewRenderer
              elements={elements.filter((item) => !["global-styles", "template-settings"].includes(item?.type))}
              previewCollection={previewCollection}
              previewProduct={previewProduct}
              previewBlog={previewBlog}
              previewArticle={previewArticle}
              previewSearch={previewSearch}
              globalStyles={globalStyles}
              reusableSections={reusableSections}
              componentDefinitions={componentDefinitions}
              widgetTemplates={widgetPlatform.templates}
              widgetPlatform={widgetPlatform}
            />
            {!["header", "footer"].includes(page?.template) && selectedFooter && (
              <PreviewRenderer elements={(selectedFooter.content || []).filter((item) => !["global-styles", "template-settings"].includes(item?.type))} reusableSections={reusableSections} componentDefinitions={componentDefinitions} globalStyles={readGlobalStyles(selectedFooter.content || [])} widgetTemplates={widgetPlatform.templates} customWidgetCss={widgetPlatform.customCss} />
            )}
          </>
        ) : (
          <div className="flex min-h-screen items-center justify-center">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-[#1a1a1a]">
                Preview is empty
              </h2>

              <p className="mt-2 text-sm text-[#6d6d6d]">
                Add widgets and save the
                page before previewing.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={editorRootRef} data-vsn-editor-root="true" data-vsn-ui-profile="editor" data-vsn-baseline="milestone-a-phase-0" data-vsn-experimental={Object.values(featureFlags || {}).some(Boolean) ? "1" : "0"} className={`flex h-screen flex-col overflow-hidden ${editorDarkMode?"vsn-editor-dark":"vsn-editor-light"}`} style={{ "--vsn-left-panel": `${leftPanelWidth}px`, "--vsn-right-panel": `${rightPanelWidth}px` }} onMouseDown={() => setContextMenu(null)} onContextMenu={(event) => { const target = event.target?.closest?.("[data-vsn-id]"); const id = target?.getAttribute?.("data-vsn-id"); if (!id || !findNode(elements, id)) return; event.preventDefault(); event.stopPropagation(); handleSelect(id, null); setContextMenu({ x: event.clientX, y: event.clientY, id }); }}>
      <ClientErrorReporter pageId={page?.id || ""} widgetId={selectedId || ""} />
      <EditorTooltipLayer />
      {!editorReady ? <div className="vsn-editor-loading-overlay"><div className="vsn-editor-loading-card"><div className="vsn-boot-mark mx-auto flex items-center justify-center text-sm font-black tracking-tight text-white">VSN</div><h3>Loading editor</h3><div className="vsn-editor-loading-track"><div className="vsn-boot-progress" /></div><p>Preparing widgets, canvas and library…</p></div></div> : null}
      <EditorToolbar
        darkMode={editorDarkMode}
        onToggleTheme={toggleEditorTheme}
        pageName={pageTitle}
        pageTemplate={page?.template}
        collections={collections}
        products={products}
        previewCollectionHandle={
          previewCollectionHandle
        }
        onPreviewCollectionChange={
          setPreviewCollectionHandle
        }
        previewProductHandle={previewProductHandle}
        onPreviewProductChange={setPreviewProductHandle}
        previewMode={deviceMode}
        onPreviewChange={(mode) => { setDeviceMode(mode); setPreviewWidth(breakpointById(globalStyles, mode)?.previewWidth || previewWidth); }}
        saving={saving}
        saveResult={saveResult}
        onSave={handleSave}
        onPublish={handlePublish}
        onPreview={() => {
          const currentParams =
            new URLSearchParams(
              window.location.search,
            );

          currentParams.set(
            "preview",
            "true",
          );
          currentParams.delete("embedded");

          if (shop) {
            currentParams.set("shop", shop);
          }

          currentParams.set(
            "collection",
            previewCollectionHandle || "",
          );

          currentParams.set("product", previewProductHandle || "");
          if (page?.template === "blog") currentParams.set("blog", previewBlog?.handle || page?.resourceHandle || "");
          if (page?.template === "article") currentParams.set("article", previewArticle?.blogHandle && previewArticle?.handle ? `${previewArticle.blogHandle}/${previewArticle.handle}` : page?.resourceHandle || "");
          if (page?.template === "search") currentParams.set("query", previewSearch?.query || "shirt");
          if (localizationPreview?.enabled && localizationPreview.locale) currentParams.set("language", localizationPreview.locale);
          if (localizationPreview?.enabled && localizationPreview.marketKey && localizationPreview.marketKey !== "*") currentParams.set("market", localizationPreview.marketKey);

          window.open(
            `/app/builder/${page.id}?${currentParams.toString()}`,
            "_blank",
          );
        }}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onQA={() => { setShowQA((value) => !value); setShowRevisions(false); setShowHistory(false); }}
        onRevisions={() => { setShowRevisions((value) => !value); setShowHistory(false); setShowCollaboration(false); }}
        onCollaboration={() => { setShowCollaboration((value) => !value); setShowLocalization(false); setShowRevisions(false); setShowHistory(false); setShowPageSettings(false); }}
        onLocalization={() => { setShowLocalization((value) => !value); setShowCollaboration(false); setShowRevisions(false); setShowHistory(false); setShowPageSettings(false); }}
        collaborationEnabled={featureFlags?.collaborationReviewV1 === true}
        localizationEnabled={featureFlags?.localizationMarketsV1 === true}
        localizationLabel={`Localization · ${(localizationData?.config?.locales || []).filter((item) => item.locale !== localizationData?.config?.baseLocale).length} locale(s)`}
        activePresenceCount={collaborationData?.presence?.length || 0}
        unresolvedComments={(collaborationData?.comments || []).filter((item) => !item.resolvedAt).length}
        workflowStatus={collaborationData?.workflowStatus || page?.workflowStatus || "draft"}
        canPublish={pagePermissions.publish === true && (!featureFlags?.collaborationReviewV1 || (collaborationActor?.permissions?.publish === true && ["approved", "published"].includes(collaborationData?.workflowStatus || page?.workflowStatus || "draft")))}
        canSave={pagePermissions.edit === true && (!featureFlags?.collaborationReviewV1 || collaborationActor?.permissions?.save === true)}
        canSaveTemplate={pagePermissions.edit === true}
        canDelete={pagePermissions.delete === true}
        onPageSettings={() => { setShowPageSettings((value) => !value); setShowRevisions(false); setShowHistory(false); setShowCollaboration(false); setShowLocalization(false); }}
        onHistory={() => { setShowHistory((value) => !value); setShowRevisions(false); }}
        revisionsCount={revisionRows.length}
        responsiveBreakpoints={globalStyles}
        previewWidth={previewWidth}
        onPreviewWidthChange={(width) => { setPreviewWidth(width); setDeviceMode(breakpointForWidth(globalStyles, width)?.id || deviceMode); }}
        zoom={canvasZoom}
        onZoomChange={setCanvasZoom}
        onZoomFit={()=>{const available=Math.max(260,window.innerWidth-leftPanelWidth-rightPanelWidth-110);setCanvasZoom(Math.max(.25,Math.min(1,Number((available/Math.max(240,previewWidth)).toFixed(2)))));}}
        onSaveTemplate={() => { setTemplateName(pageTitle); setShowSaveTemplate(true); }}
        onDeletePage={deleteCurrentPage}
        onHelp={() => window.open("https://help.shopify.com/", "_blank", "noopener,noreferrer")}
        onBack={handleBackRequest}
        canUndo={historyIdx > 0}
        canRedo={
          historyIdx <
          history.length - 1
        }
        isSaved={isSaved}
      />
      {!isOnline ? <div className="vsn-editor-status-banner is-warning">Offline mode — edits remain in local recovery storage and will save when the connection returns.</div> : null}
      {saveResult?.conflict ? <div className="vsn-editor-status-banner is-error">A newer server version exists. Reload before publishing to avoid overwriting another editor.</div> : null}
      {saveResult?.error && !saveResult?.conflict ? <div className="vsn-editor-status-banner is-error">{saveResult.error}</div> : null}
      {collaborationFetcher.data?.error ? <div className="vsn-editor-status-banner is-error">{collaborationFetcher.data.error}</div> : null}
      {localizationFetcher.data?.error ? <div className="vsn-editor-status-banner is-error">{localizationFetcher.data.error}</div> : null}
      {localizationPreview?.enabled ? <div className="vsn-editor-status-banner is-info">Locale preview: {localizationPreview.locale}{localizationPreview.marketKey && localizationPreview.marketKey !== "*" ? ` · ${localizationPreview.marketKey}` : " · all markets"} · {String(localizationPreview.direction || "ltr").toUpperCase()}. Base content is not being modified.</div> : null}
      {featureFlags?.collaborationReviewV1 && collaborationData?.lock && collaborationData.lock.ownerKey !== collaborationActor?.key ? <div className="vsn-editor-status-banner is-warning">Page locked by {collaborationData.lock.ownerName}. Save and publish are blocked until the lock is released or expires.</div> : null}

      <div className="relative flex flex-1 overflow-hidden">
        <ElementsSidebar
          onDragStart={() => { }}
          onWidgetClick={handleWidgetClickAdd}
          insertTarget={insertTarget}
          onCancelInsertTarget={() => setInsertTarget(null)}
          activeTab={leftTab}
          onTabChange={setLeftTab}
          elements={elements}
          selectedId={selectedId}
          selectedElement={selectedElement}
          onSelect={handleSelect}
          onMove={handleMove}
          onMoveNode={handleMoveNode}
          onRename={handleRename}
          onToggleHidden={(id) => toggleMeta(id, "hidden")}
          onToggleLocked={(id) => toggleMeta(id, "locked")}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          width={leftPanelWidth}
          enabledWidgetIds={enabledWidgetIds}
          inspectorTab={rightTab}
          onInspectorTabChange={setRightTab}
          onUpdate={handleUpdate}
          globalStyles={globalStyles}
          onGlobalStylesChange={handleGlobalStylesChange}
          deviceMode={deviceMode}
          reusableSections={reusableSections}
          libraryItems={editorLibraryItems}
          componentDefinitions={componentDefinitions}
          componentUsage={componentUsage}
          bindingContext={bindingContext}
          onApplyLibraryStyle={handleApplyLibraryStyle}
          onSaveCurrentStyle={handleSaveCurrentStyle}
          onUnlinkGlobalSection={handleUnlinkGlobalSection}
          onSaveComponentVariant={handleSaveComponentVariant}
          onUpdateComponentMaster={handleUpdateComponentMaster}
        />

        <PanelResizeHandle side="left" value={leftPanelWidth} onChange={setLeftPanelWidth} />

        <Canvas
          elements={displayElements.filter((item) => !["global-styles", "template-settings"].includes(item?.type))}
          localizationDirection={localizationPreview?.enabled ? localizationPreview.direction : "ltr"}
          localizationLocale={localizationPreview?.enabled ? localizationPreview.locale : ""}
          selectedId={selectedId}
          selectedElement={selectedElement}
          onSelect={handleSelect}
          onDrop={handleDrop}
          onRequestAddChild={handleRequestAddChild}
          onMoveNode={handleMoveNode}
          onAddStructure={handleAddStructure}
          onInsertPreset={handleInsertPreset}
          onInsertReusableSection={handleInsertReusableSection}
          libraryItems={editorLibraryItems}
          marketplaceBrowser={{ marketplaceItems:editorMarketplace.items||[], marketplacePlan:editorMarketplace.plan, marketplaceLoading:(editorActionFetcher.state !== "idle" && editorActionFetcher.formData?.get?.("intent") === "library-browser") || marketplaceFetcher.state !== "idle", onToggleMarketplaceFavorite:handleToggleMarketplaceFavorite, onInstallMarketplace:handleInstallMarketplace }}
          onInsertLibraryItem={handleInsertLibraryItem}
          onLibraryOpen={loadEditorLibrary}
          onToggleLibraryFavorite={handleToggleLibraryFavorite}
          onOpenWidgets={() => { setLeftTab("elements"); setInsertTarget({ parentId: null, beforeId: null, afterId: null }); }}
          onOpenAI={() => setShowAI(true)}
          libraryOpenSignal={libraryOpenSignal}
          pageTemplate={page?.template || "page"}
          libraryLoading={editorActionFetcher.state !== "idle" && ["library-list","library-browser"].includes(String(editorActionFetcher.formData?.get?.("intent")||""))}
          previewMode={deviceMode}
          previewWidth={previewWidth}
          onPreviewWidthChange={(width) => { setPreviewWidth(width); setDeviceMode(breakpointForWidth(globalStyles, width)?.id || deviceMode); }}
          zoom={canvasZoom}
          previewCollection={previewCollection}
          previewProduct={previewProduct}
          previewBlog={previewBlog}
          previewArticle={previewArticle}
          previewSearch={previewSearch}
          reusableSections={reusableSections}
          componentDefinitions={componentDefinitions}
          globalStyles={globalStyles}
          widgetPlatform={widgetPlatform}
        />

        {showShortcutHelp ? <ModalPortal><div className="vsn-editor-modal-backdrop grid place-items-center bg-black/35 p-4" onMouseDown={()=>setShowShortcutHelp(false)}><div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl" onMouseDown={(e)=>e.stopPropagation()}><div className="flex items-center justify-between"><h2 className="font-semibold">Editor shortcuts</h2><VsnButton onClick={()=>setShowShortcutHelp(false)} className="rounded border px-2 py-1 text-xs">Close</VsnButton></div><div className="mt-4 grid grid-cols-2 gap-2 text-sm">{[["Ctrl/Cmd + Z","Undo"],["Ctrl/Cmd + Shift + Z","Redo"],["Ctrl/Cmd + C / V","Copy / paste"],["Delete","Delete selection"],["Ctrl/Cmd + K","Command palette"],["?","Toggle this help"]].map(([key,label])=><div key={key} className="contents"><kbd className="rounded bg-[#f6f6f7] px-2 py-1 text-xs">{key}</kbd><span>{label}</span></div>)}</div></div></div></ModalPortal> : null}

      <EditorProductivityLayer
          contextMenu={contextMenu}
          onCloseContext={() => setContextMenu(null)}
          selectedCount={activeSelectionIds().length}
          onCopy={() => handleCopy(contextMenu?.id || selectedId)}
          onPaste={() => handlePaste(contextMenu?.id || selectedId)}
          onDuplicate={() => handleBulkDuplicate(contextMenu?.id || null)}
          onDelete={() => handleBulkDelete(contextMenu?.id || null)}
          onCopyStyles={() => handleCopyStyles(contextMenu?.id || null)}
          onPasteStyles={() => handlePasteStyles(contextMenu?.id || null)}
          onSaveLibrary={handleSaveToLibrary}
          onCreateComponent={() => handleCreateComponent(contextMenu?.id || selectedId)}
          onUpdateSyncedLibrary={handleUpdateSyncedLibraryItem}
          onMoveSelection={handleMoveSelection}
          onSelectAll={() => { const ids = elements.filter((item) => !["global-styles","template-settings"].includes(item?.type)).map((item) => item.id); setSelectedIds(ids); setSelectedId(ids[ids.length-1] || null); }}
          onClearSelection={() => { setSelectedIds([]); setSelectedId(null); }}
          onOpenNavigator={() => setLeftTab("navigator")}
          onOpenPageSettings={() => setShowPageSettings(true)}
          onOpenRevisions={() => setShowRevisions(true)}
          onOpenQA={() => setShowQA(true)}
          onUndo={handleUndo}
          onRedo={handleRedo}
        />

        {showSaveTemplate ? <ModalPortal><div className="vsn-editor-modal-backdrop grid place-items-center bg-black/40 p-4" onMouseDown={(e)=>{if(e.currentTarget===e.target&&editorActionFetcher.state==="idle")setShowSaveTemplate(false)}}><div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between"><div><h2 className="text-base font-semibold text-[#202223]">Save as Template</h2><p className="mt-1 text-xs text-[#6d7175]">Save the current page to your Library for reuse.</p></div><VsnButton variant="tertiary" accessibilityLabel="Close" disabled={editorActionFetcher.state!=="idle"} onClick={()=>setShowSaveTemplate(false)}><PolarisIcon type="x"/></VsnButton></div><div className="mt-4"><VsnTextField label="Template name" value={templateName} onInput={(e)=>setTemplateName(e.currentTarget.value)} /></div>{editorActionFetcher.data?.success===false&&editorActionFetcher.data?.intent==="save-template"?<div className="mt-3 text-xs text-red-600">{editorActionFetcher.data.error}</div>:null}<div className="mt-5 flex justify-end gap-2"><VsnButton disabled={editorActionFetcher.state!=="idle"} onClick={()=>setShowSaveTemplate(false)}>Cancel</VsnButton><VsnButton variant="primary" loading={editorActionFetcher.state!=="idle"||undefined} disabled={!templateName.trim()||editorActionFetcher.state!=="idle"} onClick={saveAsTemplate}><PolarisIcon type="save"/>Save Template</VsnButton></div></div></div></ModalPortal>:null}

        <HistoryPanel
          isOpen={showHistory}
          onClose={() => setShowHistory(false)}
          entries={history}
          currentIndex={historyIdx}
          onRestore={(index) => {
            const entry = history[index];
            if (!entry) return;
            setHistoryIdx(index);
            setElements(entry.elements);
            setGlobalStyles({ ...readGlobalStyles(entry.elements), ...designTokens });
            setPageSettings(readPageSettings(entry.elements));
            setIsSaved(false);
            setSaveStatus("Restored history state");
          }}
          autosaveLabel={autosaveAt ? `${saveStatus} ${new Date(autosaveAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : saveStatus}
        />

        <RevisionsPanel
          open={showRevisions}
          revisions={revisionRows}
          selectedRevisionId={stagedRevisionId}
          onSelect={handleStageRevision}
          onApply={handleApplyRevision}
          onClose={() => setShowRevisions(false)}
          applying={saving}
          diff={revisionDiff}
          canLabel={!featureFlags?.collaborationReviewV1 || collaborationActor?.permissions?.labelRevision === true}
          onLabel={(revisionId, label) => handleCollaborationAction("revision-label", { revisionId, label })}
        />

        <CollaborationPanel
          open={showCollaboration && featureFlags?.collaborationReviewV1 === true}
          onClose={() => setShowCollaboration(false)}
          data={collaborationData}
          currentActor={collaborationActor}
          selectedElementId={selectedId}
          busy={collaborationFetcher.state !== "idle"}
          onAction={handleCollaborationAction}
        />

        <LocalizationPanel
          open={showLocalization && featureFlags?.localizationMarketsV1 === true}
          onClose={() => { setShowLocalization(false); setLocalizationPreview({ enabled:false, locale:"", marketKey:"*", overrides:{}, seo:{}, direction:"ltr" }); }}
          data={localizationData}
          elements={elements}
          pageSettings={pageSettings}
          selectedElementId={selectedId}
          busy={localizationFetcher.state !== "idle"}
          onAction={handleLocalizationAction}
          onPreviewChange={setLocalizationPreview}
        />

        <PageSettingsPanel
          open={showPageSettings}
          onClose={() => setShowPageSettings(false)}
          page={page}
          settings={pageSettings}
          onChange={handlePageSettingsChange}
          headers={headers}
          footers={footers}
          resourceFeaturedImage={previewProduct?.featuredImage?.url || previewCollection?.image?.url || previewArticle?.image?.url || ""}
        />
        {showQA && <TemplateQAPanel elements={elements} page={page} componentDefinitions={componentDefinitions} onSelect={(id)=>{handleSelect(id,null);setShowQA(false);}} />}

        <AiBuilderPanel open={showAI} onClose={()=>setShowAI(false)} fetcher={aiFetcher} page={page} elements={elements} globalStyles={globalStyles} selectedElement={selectedElement} selectedIds={selectedIds.length?selectedIds:(selectedId?[selectedId]:[])} breakpoint={deviceMode} hasUnsavedChanges={!isSaved} commerceContext={{product:previewProduct?{title:previewProduct.title,handle:previewProduct.handle,vendor:previewProduct.vendor,productType:previewProduct.productType,description:previewProduct.description}:null,collection:previewCollection?{title:previewCollection.title,handle:previewCollection.handle,description:previewCollection.description}:null,search:previewSearch?{query:previewSearch.query}:null}} onApply={handleApplyAiResult} onAgentResult={handleAgentResult} />

        <PanelResizeHandle side="right" value={rightPanelWidth} onChange={setRightPanelWidth} />
        <EditorPanelBoundary resetKey={`global:${deviceMode}`}>
          <PropertiesPanel selectedElement={null} onUpdate={handleUpdate} onDelete={handleDelete} activeTab="style" onTabChange={() => {}} globalStyles={globalStyles} onGlobalStylesChange={handleGlobalStylesChange} deviceMode={deviceMode} reusableSections={reusableSections} libraryItems={editorLibraryItems} componentDefinitions={componentDefinitions} componentUsage={componentUsage} onApplyLibraryStyle={handleApplyLibraryStyle} onSaveCurrentStyle={handleSaveCurrentStyle} onUnlinkGlobalSection={handleUnlinkGlobalSection} onSaveComponentVariant={handleSaveComponentVariant} onUpdateComponentMaster={handleUpdateComponentMaster} width={rightPanelWidth} hideTabs />
        </EditorPanelBoundary>
      </div>
    </div>
  );
}
