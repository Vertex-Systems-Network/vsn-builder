import { useEffect, useMemo, useRef, useState } from 'react';
import { useFetcher } from 'react-router';
import { useFocusTrap } from '../../../hooks/useFocusTrap.js';
import { formatDate } from '../../../utils/format-date.js';
import { MessageCircle, Headphones, Ticket, HelpCircle, PlayCircle, Users, Bug, Lightbulb, X, CreditCard, Wrench, LifeBuoy } from 'lucide-react';
import SearchableSelect from "../../ui/SearchableSelect.jsx";

const categories = { general: { label: 'General', icon: LifeBuoy }, technical: { label: 'Technical', icon: Wrench }, bug: { label: 'Bug', icon: Bug }, billing: { label: 'Billing', icon: CreditCard }, feature: { label: 'Feature request', icon: Lightbulb } };
const supportCards = [
  { key:'chat', icon: MessageCircle, title:'Live Chat', desc:'Chat with our support team when live assistance is available.', action:'Start Chat', color:'var(--vsn-green)', bg:'rgba(var(--vsn-accent-rgb),0.1)' },
  { key:'ticket', icon: Ticket, title:'Create Ticket', desc:'Submit a tracked support ticket and keep every reply in one thread.', action:'Open Ticket', color:'#5C6AC4', bg:'rgba(92,106,196,0.1)' },
  { key:'contact', icon: Headphones, title:'Contact Support', desc:'Get help with account, billing, builder or publishing questions.', action:'Contact Team', color:'#8B5CF6', bg:'rgba(139,92,246,0.1)' },
  { key:'faq', icon: HelpCircle, title:'FAQ', desc:'Browse common setup, publishing and troubleshooting questions.', action:'View FAQs', color:'#F59E0B', bg:'rgba(245,158,11,0.1)' },
  { key:'videos', icon: PlayCircle, title:'Video Tutorials', desc:'Step-by-step walkthroughs for builder workflows and features.', action:'View Tutorials', color:'#EF4444', bg:'rgba(239,68,68,0.1)' },
  { key:'community', icon: Users, title:'Community', desc:'Connect with other merchants and page-builder users.', action:'Community', color:'#06B6D4', bg:'rgba(6,182,212,0.1)' },
  { key:'bug', icon: Bug, title:'Report a Bug', desc:'Create a technical ticket with reproduction steps and error details.', action:'Report Bug', color:'#DC2626', bg:'rgba(220,38,38,0.1)' },
  { key:'feature', icon: Lightbulb, title:'Feature Request', desc:'Submit an improvement idea and keep it tracked as a support request.', action:'Request Feature', color:'#D97706', bg:'rgba(217,119,6,0.1)' },
];

function dateTime(value) { return formatDate(value, 'datetime', ''); }

export default function Support({ darkMode, onToast, onNavigate, tickets = [], onTicketsChange, onNotificationCreated, userName, initialTicketId = null }) {
  const fetcher = useFetcher();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState(initialTicketId || tickets[0]?.id || null);
  const [subject, setSubject] = useState(''); const [body, setBody] = useState(''); const [category, setCategory] = useState('general'); const [priority, setPriority] = useState('normal'); const [reply, setReply] = useState(''); const [pendingIntent, setPendingIntent] = useState('');
  const card = { background: darkMode ? '#1A1F2E' : '#FFFFFF', borderRadius: 12, border: `1px solid ${darkMode ? '#2D3748' : '#E5E7EB'}` };
  const selected = useMemo(() => tickets.find((ticket) => ticket.id === selectedId) || null, [tickets, selectedId]); const busy = fetcher.state !== 'idle';
  const createDialogRef = useRef(null); useFocusTrap(createDialogRef, showCreate, { onEscape: () => { if (!busy) setShowCreate(false); } });
  const submit = (payload) => { setPendingIntent(payload.intent); fetcher.submit(payload, { method:'post' }); };

  useEffect(() => { if (!selectedId && tickets[0]?.id) setSelectedId(tickets[0].id); }, [tickets, selectedId]);
  useEffect(() => { if (initialTicketId && tickets.some((item) => item.id === initialTicketId)) setSelectedId(initialTicketId); }, [initialTicketId, tickets]);
  useEffect(() => {
    if (!pendingIntent || fetcher.state !== 'idle' || !fetcher.data) return;
    if (fetcher.data.success && fetcher.data.ticket) {
      const nextTicket = fetcher.data.ticket; const exists = tickets.some((ticket) => ticket.id === nextTicket.id); const nextTickets = exists ? tickets.map((ticket) => ticket.id === nextTicket.id ? nextTicket : ticket) : [nextTicket, ...tickets];
      onTicketsChange?.(nextTickets); setSelectedId(nextTicket.id);
      if (pendingIntent === 'support-create') { setShowCreate(false); setSubject(''); setBody(''); setCategory('general'); setPriority('normal'); if (fetcher.data.notification) onNotificationCreated?.(fetcher.data.notification); onToast?.({ type:'success', title:'Ticket created', message:`${nextTicket.ticketCode} has been submitted.` }); }
      if (pendingIntent === 'support-reply') { setReply(''); onToast?.({ type:'success', title:'Reply added', message:'Your reply has been added to the ticket.' }); }
    } else if (fetcher.data?.error) onToast?.({ type:'error', title:'Support request failed', message:fetcher.data.error });
    setPendingIntent('');
  }, [fetcher.state, fetcher.data, pendingIntent, tickets, onTicketsChange, onNotificationCreated, onToast]);

  const openCreate = (nextCategory='general', nextSubject='') => { setCategory(nextCategory); setSubject(nextSubject); setShowCreate(true); };
  const cardAction = (key) => {
    if (key === 'ticket') return openCreate(); if (key === 'bug') return openCreate('bug', 'Bug report: '); if (key === 'feature') return openCreate('feature', 'Feature request: '); if (key === 'faq') return onNavigate?.('documentation', { doc:'faq' });
    onToast?.({ type:'info', title:supportCards.find((item) => item.key === key)?.title || 'Support', message:'This support channel is available from the Support Center configuration when connected.' });
  };
  const createTicket = () => submit({ intent:'support-create', subject, body, category, priority });
  const sendReply = () => selected && submit({ intent:'support-reply', id:selected.id, body:reply });
  const setStatus = (status) => selected && submit({ intent:'support-status', id:selected.id, status });

  return (<s-page heading="Support Center">
    <s-button slot="primary-action" variant="primary" icon="plus" onClick={() => openCreate()}>Create Ticket</s-button>
    <s-stack direction="block" gap="base">
    <s-paragraph color="subdued">Get help, report issues, access resources, and manage tracked support tickets.</s-paragraph>
    <s-banner tone="success" heading="Support Center active">Tickets and replies are tracked per Shopify store. {tickets.filter((item) => item.status === 'open').length} open ticket(s).</s-banner>

    <s-grid gridTemplateColumns="@container (inline-size > 1000px) repeat(4, 1fr), @container (inline-size > 500px) 1fr 1fr, 1fr" gap="base">
      {supportCards.map((item) => <s-section key={item.key}><s-stack direction="block" gap="small-200"><s-heading>{item.title}</s-heading><s-paragraph color="subdued">{item.desc}</s-paragraph><s-stack direction="inline"><s-button icon="arrow-right" onClick={() => cardAction(item.key)}>{item.action}</s-button></s-stack></s-stack></s-section>)}
    </s-grid>

    <s-grid gridTemplateColumns="@container (inline-size > 900px) 340px 1fr, 1fr" gap="base">
      <s-section heading={`Recent Tickets (${tickets.length})`} padding="none">{tickets.length ? <s-stack direction="block">{tickets.map((ticket) => <s-clickable key={ticket.id} onClick={() => setSelectedId(ticket.id)} padding="base" background={ticket.id===selectedId?'subdued':'transparent'} borderWidth="none none base none" accessibilityLabel={`${ticket.ticketCode} ${ticket.subject}`}><s-stack direction="block" gap="small-100"><s-stack direction="inline" justifyContent="space-between" gap="small-200"><s-text type="strong">{ticket.ticketCode}</s-text><s-badge tone={ticket.status==='open'?'warning':'success'}>{ticket.status==='open'?'Open':'Closed'}</s-badge></s-stack><s-text>{ticket.subject}</s-text><s-text color="subdued">{formatDate(ticket.updatedAt, 'date', '')}</s-text></s-stack></s-clickable>)}</s-stack> : <s-box padding="large"><s-stack direction="block" alignItems="center" gap="small-200"><s-heading>No tickets yet</s-heading><s-text color="subdued">Create a ticket when you need help.</s-text></s-stack></s-box>}</s-section>

      <s-section>{selected ? <s-stack direction="block" gap="base">
        <s-stack direction="inline" justifyContent="space-between" alignItems="start" gap="base"><s-stack direction="block" gap="small-100"><s-stack direction="inline" gap="small-200" alignItems="center"><s-text type="strong">{selected.ticketCode}</s-text><s-badge tone={selected.status==='open'?'warning':'success'}>{selected.status}</s-badge></s-stack><s-heading>{selected.subject}</s-heading><s-text color="subdued">Opened {dateTime(selected.createdAt)} · {selected.priority} priority</s-text></s-stack><s-button disabled={busy} onClick={() => setStatus(selected.status === 'open' ? 'closed' : 'open')}>{selected.status === 'open' ? 'Close ticket' : 'Reopen'}</s-button></s-stack>
        <s-stack direction="block" gap="small-200">{(selected.messages || []).map((message) => <s-box key={message.id} padding="small-200 base" borderRadius="base" borderWidth="base" background={message.authorType==='merchant'?'subdued':'base'}><s-stack direction="block" gap="small-100"><s-text color="subdued"><s-text type="strong">{message.authorName || (message.authorType === 'merchant' ? userName : 'VSN Support')}</s-text> · {dateTime(message.createdAt)}</s-text><div style={{ whiteSpace:'pre-wrap' }}><s-text>{message.body}</s-text></div></s-stack></s-box>)}</s-stack>
        <s-stack direction="inline" gap="small-200" alignItems="end"><textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply…" rows={3} className="dashboard-textarea" aria-label="Reply"/><s-button variant="primary" icon="send" disabled={busy || !reply.trim()} onClick={sendReply}>{busy && pendingIntent==='support-reply'?'Sending…':'Reply'}</s-button></s-stack>
      </s-stack> : <s-box padding="large"><s-stack direction="block" alignItems="center" gap="small-200"><s-heading>Select a ticket</s-heading><s-text color="subdued">Ticket details and replies will appear here.</s-text></s-stack></s-box>}</s-section>
    </s-grid>
    </s-stack>

    {showCreate ? <div /* eslint-disable-line jsx-a11y/no-static-element-interactions -- modal backdrop dismiss / propagation guard, not a focusable control */ className="dashboard-modal-backdrop" onMouseDown={(e) => { if (e.currentTarget === e.target && !busy) setShowCreate(false); }}><div ref={createDialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="vsn-support-create-title" className="dashboard-modal" style={{ ...card }}><div className="dashboard-modal-header"><div><strong id="vsn-support-create-title">Create support ticket</strong><span>Describe the issue clearly so it can be tracked and answered.</span></div><button type="button" aria-label="Close" disabled={busy} onClick={() => setShowCreate(false)} className="dashboard-icon-button"><X size={16}/></button></div><div className="dashboard-modal-body"><label className="dashboard-field"><span>Subject</span><input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What do you need help with?"/></label><div className="dashboard-field-grid"><label className="dashboard-field"><span>Category</span><SearchableSelect value={category} onChange={(e) => setCategory(e.target.value)}>{Object.entries(categories).map(([key,value]) => <option key={key} value={key}>{value.label}</option>)}</SearchableSelect></label><label className="dashboard-field"><span>Priority</span><SearchableSelect value={priority} onChange={(e) => setPriority(e.target.value)}>{['low','normal','high','urgent'].map((value) => <option key={value} value={value}>{value[0].toUpperCase()+value.slice(1)}</option>)}</SearchableSelect></label></div><label className="dashboard-field"><span>{category==='feature'?'Problem / desired outcome':category==='bug'?'Reproduction details':'Message'}</span><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} placeholder={category==='bug'?'Include steps to reproduce, expected behavior, actual behavior, screen/feature and any visible error.':category==='feature'?'Describe the problem, who it affects, the desired workflow and what a successful result should look like.':'Include enough context for the support team to understand the request.'}/></label></div><div className="dashboard-modal-footer"><s-button disabled={busy} onClick={() => setShowCreate(false)}>Cancel</s-button><s-button variant="primary" disabled={busy || subject.trim().length < 3 || body.trim().length < 5} onClick={createTicket}>{busy && pendingIntent==='support-create'?'Submitting…':'Submit ticket'}</s-button></div></div></div> : null}
  </s-page>);
}
