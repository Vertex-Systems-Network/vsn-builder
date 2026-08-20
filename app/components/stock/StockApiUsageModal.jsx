import { createPortal } from "react-dom";
import { Activity, Gauge, RefreshCw, X } from "lucide-react";
import { stockQuotaProgress } from "../../config/stock-api-usage.js";

const LABELS={unsplash:"Unsplash",pexels:"Pexels",pixabay:"Pixabay",freesound:"Freesound",shutterstock:"Shutterstock",getty:"Getty/iStock"};
function dateLabel(value){if(!value)return"Never";const date=new Date(value);return Number.isNaN(date.getTime())?"Never":date.toLocaleString();}
function rateLabel(rate){if(!rate||(!rate.limit&&!rate.remaining))return"Not reported";return `${rate.remaining ?? "?"} / ${rate.limit ?? "?"} remaining${rate.reset?` · reset ${rate.reset}`:""}`;}

export default function StockApiUsageModal({open,onClose,onRefresh,loading=false,summary=null,providers=[]}){
  if(!open||typeof document==="undefined")return null;
  const groups=providers.map((provider)=>summary?.providers?.[provider]||{provider,requestCount:0,successCount:0,errorCount:0,lastUsedAt:null,rateLimit:null,media:[]});
  return createPortal(<div className="vsn-stock-usage-backdrop" role="presentation" onMouseDown={(event)=>{if(event.currentTarget===event.target)onClose?.();}}>
    <section className="vsn-stock-usage-modal" role="dialog" aria-modal="true" aria-label="Stock API usage">
      <header><div><span className="vsn-stock-usage-icon"><Gauge size={17}/></span><div><strong>API usage</strong><small>VSN-observed API calls for this stock workspace. Provider quotas are shown when the API returns rate-limit headers.</small></div></div><button type="button" onClick={onClose} aria-label="Close API usage"><X size={18}/></button></header>
      <div className="vsn-stock-usage-summary"><div><span>Total requests</span><strong>{Number(summary?.totalRequests||0)}</strong></div><div><span>Providers</span><strong>{providers.length}</strong></div><button type="button" className="dashboard-secondary-action" disabled={loading} onClick={onRefresh}><RefreshCw size={13} className={loading?"vsn-spin":""}/>{loading?"Refreshing…":"Refresh usage"}</button></div>
      <div className="vsn-stock-usage-list">{groups.map((group)=>{const quota=stockQuotaProgress(group.rateLimit);return <article key={group.provider}><div className="vsn-stock-usage-provider-head"><div><Activity size={14}/><strong>{LABELS[group.provider]||group.provider}</strong></div><span>{dateLabel(group.lastUsedAt)}</span></div><div className="vsn-stock-usage-metrics"><div><span>Requests</span><strong>{group.requestCount||0}</strong></div><div><span>Success</span><strong>{group.successCount||0}</strong></div><div><span>Errors</span><strong>{group.errorCount||0}</strong></div></div><div className="vsn-stock-usage-rate"><span>Provider quota</span><strong>{rateLabel(group.rateLimit)}</strong>{quota?<div className={`vsn-stock-quota-progress tone-${quota.tone}`}><div className="vsn-stock-quota-progress-head"><span><b>{quota.usedPercentRounded}% used</b> · {quota.used}/{quota.limit} calls</span><span>{quota.remainingPercentRounded}% remaining</span></div><div className="vsn-stock-quota-track" role="progressbar" aria-label={`${LABELS[group.provider]||group.provider} API quota used`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={quota.usedPercentRounded}><span style={{width:`${quota.usedPercent}%`}}/></div></div>:null}</div>{group.media?.length?<div className="vsn-stock-usage-media">{group.media.map((row)=><span key={`${row.provider}:${row.mediaKind}`}><b>{row.mediaKind}</b> {row.requestCount} call{row.requestCount===1?"":"s"}{row.lastStatus?` · HTTP ${row.lastStatus}`:""}</span>)}</div>:<small className="vsn-stock-usage-none">No API requests recorded yet.</small>}</article>})}</div>
    </section>
  </div>,document.body);
}
