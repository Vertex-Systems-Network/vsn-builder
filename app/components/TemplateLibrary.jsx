import { useState } from 'react';
import PolarisIcon from './ui/PolarisIcon';
import { TEMPLATES, TEMPLATE_CATEGORIES } from '../data/templates';
export default function TemplateLibrary({ onSelect }) {
    const [activeCategory, setActiveCategory] = useState('all');
    const [search, setSearch] = useState('');
    const [hoveredId, setHoveredId] = useState(null);
    const filtered = TEMPLATES.filter(t => {
        const matchCat = activeCategory === 'all' || t.category === activeCategory;
        const matchSearch = t.title.toLowerCase().includes(search.toLowerCase());
        return matchCat && matchSearch;
    });
    return (<div className="flex-1 overflow-auto">
      {/* Header */}
      <div className="bg-white border-b border-[#e3e3e3] px-8 py-5">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-xl font-semibold text-[#1a1a1a]">Template Library</h1>
          <p className="text-sm text-[#6d6d6d] mt-0.5">Start from a professionally designed template</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-6">
        {/* Toolbar */}
        <div className="flex items-center gap-4 mb-6">
          <s-search-field label="Search templates" labelAccessibilityVisibility="exclusive" placeholder="Search templates..." value={search} onInput={(e) => setSearch(e.currentTarget.value)} />
          <div className="flex items-center gap-1">
            {TEMPLATE_CATEGORIES.map(cat => (<s-button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`px-3.5 py-1.5 text-sm font-medium rounded-lg transition-colors ${activeCategory === cat.id
                ? 'bg-[#008060] text-white'
                : 'text-[#4a4a4a] hover:bg-[#f6f6f7]'}`}>
                {cat.label}
              </s-button>))}
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-3 gap-5">
          {/* Blank template */}
          <s-button onClick={() => onSelect('blank')} className="bg-white rounded-xl border-2 border-dashed border-[#d1d1d1] hover:border-[#008060] hover:bg-emerald-50/30 transition-all group overflow-hidden">
            <div className="h-44 flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-xl border-2 border-dashed border-[#d1d1d1] group-hover:border-[#008060] flex items-center justify-center transition-colors">
                <PolarisIcon type="plus" size="base" />
              </div>
              <span className="text-sm font-medium text-[#6d6d6d] group-hover:text-[#008060] transition-colors">Blank Page</span>
            </div>
          </s-button>

          {filtered.map(template => (<div key={template.id} className="bg-white rounded-xl border border-[#e3e3e3] overflow-hidden shadow-sm hover:shadow-md hover:border-[#008060]/30 transition-all group cursor-pointer" onMouseEnter={() => setHoveredId(template.id)} onMouseLeave={() => setHoveredId(null)} onClick={() => onSelect(template.id)}>
              <div className="relative h-44 overflow-hidden bg-[#f6f6f7]">
                <img src={template.thumbnail} alt={template.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>
                {template.isPro && (<div className="absolute top-3 right-3">
                    <span className="bg-[#1a1a1a] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">Pro</span>
                  </div>)}
                {hoveredId === template.id && (<div className="absolute inset-0 bg-[#008060]/20 backdrop-blur-[1px] flex items-center justify-center animate-fade-in">
                    <s-button className="bg-white text-[#008060] font-semibold text-sm px-5 py-2.5 rounded-lg shadow-lg hover:bg-[#008060] hover:text-white transition-colors">
                      Use Template
                    </s-button>
                  </div>)}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[#1a1a1a]">{template.title}</h3>
                  <span className="text-[10px] font-medium text-[#008060] bg-emerald-50 px-2 py-0.5 rounded-full capitalize whitespace-nowrap flex-shrink-0">
                    {TEMPLATE_CATEGORIES.find(c => c.id === template.category)?.label.replace(' Pages', '') ?? template.category}
                  </span>
                </div>
                <p className="text-xs text-[#6d6d6d] mt-1 leading-relaxed">{template.description}</p>
              </div>
            </div>))}
        </div>

        {filtered.length === 0 && (<div className="text-center py-16">
            <p className="text-[#6d6d6d] text-sm">No templates match your search.</p>
          </div>)}
      </div>
    </div>);
}
