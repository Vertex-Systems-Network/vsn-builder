import { Target, Heart, Users, Zap, ExternalLink, Mail, Phone, Globe } from 'lucide-react';
const team = [
    { name: 'Sarah Chen', role: 'CEO & Co-founder', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&auto=format' },
    { name: 'Marcus Rodriguez', role: 'CTO & Co-founder', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&auto=format' },
    { name: 'Priya Patel', role: 'Head of Design', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&auto=format' },
];
const whyUs = [
    { icon: <Zap size={20}/>, title: 'Lightning Fast', desc: 'Components built for speed — lazy-loaded, minified, and optimized for Core Web Vitals.' },
    { icon: <Target size={20}/>, title: 'Shopify Native', desc: 'Designed from the ground up for Shopify themes. No conflicts, no workarounds.' },
    { icon: <Heart size={20}/>, title: 'Developer Loved', desc: 'Clean APIs, well-documented, and updated with every major Shopify release.' },
    { icon: <Users size={20}/>, title: '12,000+ Stores', desc: 'Trusted by merchants across 40+ countries to power their storefronts.' },
];
export default function About({ darkMode }) {
    const text = darkMode ? '#F9FAFB' : '#1A1F36';
    const muted = darkMode ? '#9CA3AF' : '#6B7280';
    const card = { background: darkMode ? '#1A1F2E' : '#FFFFFF', borderRadius: 12, border: `1px solid ${darkMode ? '#2D3748' : '#E5E7EB'}` };
    return (<div className="page-fade" style={{ padding: '28px 32px', maxWidth: 1000, margin: '0 auto' }}>
      {/* Hero */}
      <div style={{
            background: 'linear-gradient(135deg, rgba(var(--vsn-accent-rgb),0.08) 0%, rgba(92,106,196,0.08) 100%)',
            border: `1px solid ${darkMode ? '#2D3748' : '#E5E7EB'}`,
            borderRadius: 16, padding: '40px', marginBottom: 32,
            textAlign: 'center',
        }}>
        <div style={{
            width: 64, height: 64, borderRadius: 16, margin: '0 auto 20px',
            background: 'linear-gradient(135deg, var(--vsn-green), var(--vsn-green-dark))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Zap size={28} color="white"/>
        </div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: text }}>VSN Builder</h1>
        <p style={{ margin: '10px auto 0', fontSize: 16, color: muted, maxWidth: 520, lineHeight: 1.6 }}>
          The most complete Elementor-style component library for Shopify store builders. 32 professionally crafted components, zero compromises.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24 }}>
          <a href="#" style={{ color: muted, display: 'flex', alignItems: 'center' }}><ExternalLink size={18}/></a>
          <a href="#" style={{ color: muted, display: 'flex', alignItems: 'center' }}><ExternalLink size={18}/></a>
          <a href="#" style={{ color: muted, display: 'flex', alignItems: 'center' }}><ExternalLink size={18}/></a>
        </div>
      </div>

      {/* Mission & Vision */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 32 }}>
        <div style={{ ...card, padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(var(--vsn-accent-rgb),0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--vsn-green)' }}>
              <Target size={18}/>
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: text }}>Our Mission</span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: muted, lineHeight: 1.7 }}>
            To democratize professional Shopify store design. Every merchant, regardless of technical skill, should be able to build a beautiful, conversion-optimized store — without writing a single line of code.
          </p>
        </div>
        <div style={{ ...card, padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(92,106,196,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5C6AC4' }}>
              <Heart size={18}/>
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: text }}>Our Vision</span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: muted, lineHeight: 1.7 }}>
            To become the #1 component library on the Shopify App Store — powering 1 million stores by 2027. We believe the best tools should feel effortless, look remarkable, and perform flawlessly.
          </p>
        </div>
      </div>

      {/* Why us */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: text }}>Why Choose VSN Builder?</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          {whyUs.map(item => (<div key={item.title} style={{ ...card, padding: '20px 22px', display: 'flex', gap: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 8, background: 'rgba(var(--vsn-accent-rgb),0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--vsn-green)', flexShrink: 0 }}>
                {item.icon}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: text, marginBottom: 4 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: muted, lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            </div>))}
        </div>
      </div>

      {/* Team */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: text }}>Meet the Team</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {team.map(member => (<div key={member.name} style={{ ...card, padding: '24px', textAlign: 'center' }}>
              <img src={member.avatar} alt={member.name} style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', display: 'block', margin: '0 auto 12px', border: '3px solid rgba(var(--vsn-accent-rgb),0.3)' }}/>
              <div style={{ fontSize: 14, fontWeight: 700, color: text }}>{member.name}</div>
              <div style={{ fontSize: 12, color: muted, marginTop: 3 }}>{member.role}</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 12 }}>
                <ExternalLink size={15} color={muted} style={{ cursor: 'pointer' }}/>
                <ExternalLink size={15} color={muted} style={{ cursor: 'pointer' }}/>
              </div>
            </div>))}
        </div>
      </div>

      {/* Contact + footer */}
      <div style={{ ...card, padding: '24px' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: text }}>Contact Information</h2>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {[
            { icon: <Mail size={15}/>, label: 'hello@componentkit.app' },
            { icon: <Globe size={15}/>, label: 'www.componentkit.app' },
            { icon: <Phone size={15}/>, label: '+1 (555) 012-3456' },
        ].map(c => (<div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--vsn-green)' }}>{c.icon}</span>
              <span style={{ fontSize: 13, color: muted }}>{c.label}</span>
            </div>))}
        </div>
        <div style={{ borderTop: `1px solid ${darkMode ? '#2D3748' : '#E5E7EB'}`, marginTop: 16, paddingTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 12, color: darkMode ? '#4B5563' : '#C4C9D4' }}>© 2026 VSN Builder Inc. All rights reserved.</span>
          <span style={{
            fontSize: 11, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600,
            color: '#5C6AC4', background: 'rgba(92,106,196,0.1)', padding: '2px 8px', borderRadius: 6,
        }}>v2.4.1</span>
        </div>
      </div>
    </div>);
}
