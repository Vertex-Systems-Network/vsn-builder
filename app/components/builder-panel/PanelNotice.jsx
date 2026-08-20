import { VsnNotice } from "../ui/VsnToolkit";

/** Render only the action feedback supplied by the active Builder panel. */
export default function PanelNotice({ data }) {
  return <>
    {data?.message ? <VsnNotice>{data.message}</VsnNotice> : null}
    {data?.error ? <VsnNotice tone="critical">{data.error}</VsnNotice> : null}
  </>;
}
