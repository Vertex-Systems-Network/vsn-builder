import { Activity, ArrowRightLeft, BookOpen, Boxes, Code2, Database, FileCode2, FileText, FlaskConical, Globe2, Heart, Image, KeyRound, Library, Mail, Megaphone, Network, PackageOpen, Palette, Puzzle, Repeat2, SearchCheck, Settings2, ShieldCheck, Sparkles, Wrench } from 'lucide-react';

export const DOC_SECTIONS = Object.freeze([
  {id:'getting-started',label:'Getting Started',group:'Basics',icon:BookOpen,tags:'setup first workflow publish'},
  {id:'pages',label:'Pages & Templates',group:'Builder',icon:FileText,tags:'page template responsive publish'},
  {id:'native-shopify',label:'Canvas → Native Section',group:'Builder',icon:Boxes,tags:'shopify native section theme bridge'},
  {id:'media',label:'Shopify Media',group:'Builder',icon:Image,tags:'files image media svg'},
  {id:'library',label:'Saved Library & Marketplace',group:'Builder',icon:Library,tags:'saved marketplace package import'},
  {id:'motion',label:'Motion Library',group:'Builder',icon:Sparkles,tags:'animation animate css timeline reduced motion'},
  {id:'widgets',label:'Widget Studio',group:'Builder',icon:Puzzle,tags:'custom widget fields template lab'},
  {id:'queries',label:'Loop & Query Builder',group:'Builder',icon:Repeat2,tags:'graphql products loop data'},
  {id:'ai-builder',label:'AI Editable Output',group:'Builder',icon:Sparkles,tags:'ai structured schema screenshot responsive repair'},
  {id:'campaigns',label:'Campaigns & Floating',group:'Growth',icon:Megaphone,tags:'popup drawer flyout floating targeting'},
  {id:'cro',label:'CRO Experiments',group:'Growth',icon:FlaskConical,tags:'ab test variants winner attribution'},
  {id:'forms',label:'Forms & Automation',group:'Growth',icon:Settings2,tags:'forms submissions automation integration'},
  {id:'wishlist',label:'Wishlist Commerce',group:'Commerce',icon:Heart,tags:'wishlist customer local merge grid'},
  {id:'email',label:'Email Builder',group:'Commerce',icon:Mail,tags:'email mjml outlook gmail dark preview'},
  {id:'assets',label:'Fonts & SVG Library',group:'Assets',icon:Palette,tags:'font svg asset code editor'},
  {id:'localization',label:'Localization & Markets',group:'Data',icon:Globe2,tags:'locale translation markets'},
  {id:'global-code',label:'Global CSS & JavaScript',group:'Developer',icon:FileCode2,tags:'developer studio css js safe mode'},
  {id:'graphql',label:'GraphQL Studio',group:'Developer',icon:Database,tags:'graphql queries mutation cost scopes'},
  {id:'platform-intelligence',label:'Platform Intelligence',group:'Developer',icon:Network,tags:'dependency usage graph design tokens command palette binding inspector conditions state cart inventory visual regression performance budget extension sandbox migration simulator command architecture'},
  {id:'permissions',label:'Roles & Permissions',group:'System',icon:KeyRound,tags:'role action owner security'},
  {id:'health',label:'System Health',group:'System',icon:Activity,tags:'diagnostics session migration files'},
  {id:'backups',label:'Backups & Packages',group:'System',icon:PackageOpen,tags:'backup restore import export package'},
  {id:'migration',label:'Migration Guide',group:'Guides',icon:ArrowRightLeft,tags:'pagefly gempages replo migration'},
  {id:'sdk',label:'Developer SDK',group:'Developers',icon:Code2,tags:'plugin sdk widget provider manifest'},
  {id:'engineering',label:'Engineering & Testing',group:'Developers',icon:Wrench,tags:'architecture testing migrations security'},
  {id:'production-shopify',label:'Shopify Production',group:'Release',icon:Globe2,tags:'production deploy shopify config oauth webhooks app proxy api version theme extension'},
  {id:'ecosystem',label:'Ecosystem & QA',group:'Release',icon:SearchCheck,tags:'manifest coverage inventory release qa'},
  {id:'faq',label:'FAQs',group:'Help',icon:ShieldCheck,tags:'faq theme active errors troubleshooting'},
]);

export const MIGRATION_ROWS = Object.freeze([
  {from:'PageFly',map:'Page / section → VSN Page or Saved Library section',notes:'Recreate layout with VSN containers and columns. Move repeated sections into Components. Replace product loops with Loop / Query.'},
  {from:'GemPages',map:'Element tree → VSN widget tree',notes:'Rebuild dynamic product/collection data with VSN dynamic sources. Move global blocks into Components/Variants and use Brand Kits for tokens.'},
  {from:'Replo',map:'Component / page → VSN Component or Page',notes:'Map reusable components to VSN Components, Slots and Variants. Replace data lists with Query AST + Loop Item templates and recreate experiments in CRO.'},
]);
