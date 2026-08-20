const COUNTRY_POINTS = {
  US:[94,57],CA:[83,42],MX:[86,71],BR:[111,105],AR:[104,126],CL:[98,122],CO:[99,91],PE:[96,101],GB:[150,49],IE:[145,50],FR:[153,59],DE:[158,54],ES:[149,65],IT:[159,66],NL:[155,51],SE:[162,39],NO:[157,38],PL:[165,53],TR:[174,67],AE:[190,79],SA:[185,81],EG:[170,77],ZA:[169,122],NG:[157,94],KE:[180,99],MA:[148,75],IN:[211,84],PK:[203,78],BD:[219,82],LK:[214,96],CN:[230,70],JP:[259,69],KR:[252,70],ID:[238,103],MY:[229,99],SG:[231,103],PH:[249,94],TH:[228,91],VN:[235,91],AU:[253,125],NZ:[282,134],RU:[205,43]
};
const COUNTRY_NAMES = {US:'United States',CA:'Canada',MX:'Mexico',BR:'Brazil',AR:'Argentina',CL:'Chile',CO:'Colombia',PE:'Peru',GB:'United Kingdom',IE:'Ireland',FR:'France',DE:'Germany',ES:'Spain',IT:'Italy',NL:'Netherlands',SE:'Sweden',NO:'Norway',PL:'Poland',TR:'Türkiye',AE:'United Arab Emirates',SA:'Saudi Arabia',EG:'Egypt',ZA:'South Africa',NG:'Nigeria',KE:'Kenya',MA:'Morocco',IN:'India',PK:'Pakistan',BD:'Bangladesh',LK:'Sri Lanka',CN:'China',JP:'Japan',KR:'South Korea',ID:'Indonesia',MY:'Malaysia',SG:'Singapore',PH:'Philippines',TH:'Thailand',VN:'Vietnam',AU:'Australia',NZ:'New Zealand',RU:'Russia'};

export default function VisitorMapWidget({ visitors = {}, darkMode }) {
  const text = darkMode ? '#F9FAFB' : '#1A1F36';
  const muted = darkMode ? '#9CA3AF' : '#6B7280';
  const countries = Array.isArray(visitors.countries) ? visitors.countries : [];
  const max = Math.max(1, ...countries.map((row)=>Number(row.sessions||0)));
  const mapped = countries.filter((row)=>COUNTRY_POINTS[row.code]).slice(0,30);
  return <div className="vsn-visitor-layout">
    <div className="vsn-visitor-map-wrap">
      <svg viewBox="0 0 320 160" role="img" aria-label="Recent visitors by country">
        <g className="vsn-world-shape"><path d="M18 47l19-22 35-8 29 12 12 17-20 8-9 17-20-2-13 13-18-8-5-17z"/><path d="M91 82l18 4 17 18-5 22-13 25-12-20 2-19-10-15z"/><path d="M137 42l20-16 52-9 48 13 39 22-8 23-30 6-18 18-26-2-17-22-22 1-10-13-24-3z"/><path d="M150 77l27 3 19 24-8 32-23 15-16-22-10-31z"/><path d="M238 111l32-2 29 18-10 20-31 3-20-17z"/></g>
        {mapped.map((row)=>{const [x,y]=COUNTRY_POINTS[row.code];const ratio=Number(row.sessions||0)/max;return <g key={row.code}><circle cx={x} cy={y} r={3+ratio*6} fill="var(--vsn-green)" fillOpacity={.35+ratio*.45}/><circle cx={x} cy={y} r={2+ratio*2.5} fill="var(--vsn-green-dark)"><title>{COUNTRY_NAMES[row.code]||row.code}: {row.sessions} sessions</title></circle></g>})}
      </svg>
      <div className="vsn-visitor-map-stats"><span><strong style={{ color:text }}>{Number(visitors.active5m||0)}</strong><small style={{ color:muted }}>active now</small></span><span><strong style={{ color:text }}>{Number(visitors.sessions24h||0)}</strong><small style={{ color:muted }}>sessions / 24h</small></span><span><strong style={{ color:text }}>{Number(visitors.pageViews24h||0)}</strong><small style={{ color:muted }}>page views / 24h</small></span></div>
    </div>
    <div className="vsn-visitor-country-list">{countries.length ? countries.slice(0,5).map((row)=><div key={row.code}><span style={{ color:muted }}>{COUNTRY_NAMES[row.code] || (row.code === 'UNKNOWN' ? 'Unknown location' : row.code)}</span><strong style={{ color:text }}>{row.sessions}</strong></div>) : <div className="vsn-visitor-empty" style={{ color:muted }}>No recent VSN storefront sessions yet. Visitor locations appear after VSN-rendered pages receive traffic.</div>}</div>
  </div>;
}
