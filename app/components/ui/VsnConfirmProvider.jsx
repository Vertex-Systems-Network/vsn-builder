import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { VsnButton, VsnInput, VsnModal } from "./VsnToolkit";

const ConfirmContext = createContext(null);

export function VsnConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const [typed, setTyped] = useState("");

  const confirm = useCallback((options = {}) => new Promise((resolve) => {
    setTyped("");
    setRequest({
      title: options.title || "Confirm action",
      message: options.message || "Are you sure you want to continue?",
      confirmLabel: options.confirmLabel || "Confirm",
      cancelLabel: options.cancelLabel || "Cancel",
      tone: options.tone || "danger",
      requireText: options.requireText || "",
      resolve,
    });
  }), []);

  const close = useCallback((result) => {
    setRequest((current) => {
      current?.resolve?.(Boolean(result));
      return null;
    });
    setTyped("");
  }, []);

  const value = useMemo(() => ({ confirm }), [confirm]);
  const valid = !request?.requireText || typed.trim() === request.requireText;

  return <ConfirmContext.Provider value={value}>
    {children}
    <VsnModal
      open={Boolean(request)}
      title={request?.title || "Confirm action"}
      subtitle={request?.tone === "danger" ? "Please review this action before continuing." : ""}
      danger={request?.tone === "danger"}
      onClose={() => close(false)}
      size="sm"
      footer={<><VsnButton onClick={() => close(false)}>{request?.cancelLabel || "Cancel"}</VsnButton><VsnButton variant={request?.tone === "danger" ? "danger" : "primary"} disabled={!valid} onClick={() => close(true)}>{request?.confirmLabel || "Confirm"}</VsnButton></>}
    >
      <p className="vsn-confirm-message">{request?.message}</p>
      {request?.requireText ? <div className="vsn-confirm-type"><VsnInput label={`Type ${request.requireText} to confirm`} value={typed} onChange={(event)=>setTyped(event.target.value)} autoComplete="off"/></div> : null}
    </VsnModal>
  </ConfirmContext.Provider>;
}

export function useVsnConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) return async (options = {}) => window.confirm(options.message || options.title || "Confirm action?");
  return context.confirm;
}
