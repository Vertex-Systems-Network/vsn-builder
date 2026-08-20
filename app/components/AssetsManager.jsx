import { useState } from 'react';
import PolarisIcon from './ui/PolarisIcon';
const ASSET_CATEGORIES = [
    { id: 'images', label: 'Images', count: 24 },
    { id: 'videos', label: 'Videos', count: 3 },
    { id: 'icons', label: 'Icons', count: 150 },
    { id: 'files', label: 'Files', count: 7 },
];
const SAMPLE_IMAGES = [
    { id: '1', src: '/vsn-stock/fashion.svg', name: 'summer-collection.jpg', size: '2.4 MB' },
    { id: '2', src: '/vsn-stock/watch.svg', name: 'product-watch.jpg', size: '1.8 MB' },
    { id: '3', src: '/vsn-stock/interior.svg', name: 'store-interior.jpg', size: '3.1 MB' },
    { id: '4', src: '/vsn-stock/office.svg', name: 'laptop-desk.jpg', size: '2.0 MB' },
    { id: '5', src: '/vsn-stock/skincare.svg', name: 'skincare-flat.jpg', size: '1.5 MB' },
    { id: '6', src: '/vsn-stock/sale.svg', name: 'sale-promo.jpg', size: '2.7 MB' },
    { id: '7', src: '/vsn-stock/arrivals.svg', name: 'new-arrivals.jpg', size: '1.9 MB' },
    { id: '8', src: '/vsn-stock/contact.svg', name: 'contact-team.jpg', size: '2.2 MB' },
];
export default function AssetsManager() {
    const [activeCategory, setActiveCategory] = useState('images');
    const [viewMode, setViewMode] = useState('grid');
    const [selectedIds, setSelectedIds] = useState([]);
    const toggleSelect = (id) => {
        setSelectedIds(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
    };
    return (<div className="flex-1 overflow-auto">
      {/* Header */}
      <div className="bg-white border-b border-[#e3e3e3] px-8 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[#1a1a1a]">Assets</h1>
            <p className="text-sm text-[#6d6d6d] mt-0.5">Manage your media files and assets</p>
          </div>
          <div className="w-44"><s-drop-zone label="Upload Files" accessibilityLabel="Upload asset files" labelAccessibilityVisibility="exclusive" multiple /></div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-6 flex gap-6">
        {/* Left: Categories */}
        <div className="w-44 flex-shrink-0">
          <p className="text-xs font-semibold text-[#6d6d6d] uppercase tracking-wide mb-2 px-2">Categories</p>
          <div className="space-y-0.5">
            {ASSET_CATEGORIES.map(cat => (<s-button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${activeCategory === cat.id
                ? 'bg-emerald-50 text-[#95BF47] font-medium'
                : 'text-[#4a4a4a] hover:bg-[#f6f6f7]'}`}>
                <span>{cat.label}</span>
                <span className={`text-xs rounded-full px-1.5 py-0.5 ${activeCategory === cat.id ? 'bg-[#95BF47]/10 text-[#95BF47]' : 'bg-[#f1f1f1] text-[#6d6d6d]'}`}>
                  {cat.count}
                </span>
              </s-button>))}
          </div>

          {/* Storage */}
          <div className="mt-6 bg-white rounded-xl border border-[#e3e3e3] p-4 shadow-sm">
            <p className="text-xs font-semibold text-[#4a4a4a] mb-2">Storage</p>
            <div className="w-full h-1.5 bg-[#f1f1f1] rounded-full overflow-hidden">
              <div className="h-full w-[38%] bg-gradient-to-r from-[#95BF47] to-[#6AAB1F] rounded-full"/>
            </div>
            <p className="text-[10px] text-[#6d6d6d] mt-1.5">3.8 GB of 10 GB used</p>
          </div>
        </div>

        {/* Right: Content */}
        <div className="flex-1 min-w-0">
          {/* Toolbar */}
          <div className="flex items-center gap-3 mb-4">
            {selectedIds.length > 0 && (<span className="text-xs font-medium text-[#95BF47] bg-emerald-50 px-2.5 py-1 rounded-full">
                {selectedIds.length} selected
              </span>)}
            <div className="ml-auto flex items-center gap-1 bg-white border border-[#e3e3e3] rounded-lg p-1">
              <s-button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-[#f6f6f7] text-[#95BF47]' : 'text-[#6d6d6d]'}`}>
                <PolarisIcon type="grid" size="small" />
              </s-button>
              <s-button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-[#f6f6f7] text-[#95BF47]' : 'text-[#6d6d6d]'}`}>
                <PolarisIcon type="list-bulleted" size="small" />
              </s-button>
            </div>
          </div>

          {activeCategory === 'images' && viewMode === 'grid' && (<div className="grid grid-cols-4 gap-3 animate-fade-in">
              {/* Upload drop zone */}
              <div className="aspect-square"><s-drop-zone label="Upload" accessibilityLabel="Upload images" labelAccessibilityVisibility="exclusive" multiple accept="image/*" /></div>

              {SAMPLE_IMAGES.map(asset => (<div key={asset.id} className={`relative rounded-xl overflow-hidden border-2 transition-all cursor-pointer group ${selectedIds.includes(asset.id) ? 'border-[#95BF47]' : 'border-transparent hover:border-[#95BF47]/40'}`} onClick={() => toggleSelect(asset.id)}>
                  <div className="aspect-square bg-[#f6f6f7]">
                    <img src={asset.src} alt={asset.name} className="w-full h-full object-cover"/>
                  </div>
                  {selectedIds.includes(asset.id) && (<div className="absolute top-2 right-2 w-5 h-5 bg-[#95BF47] rounded-full flex items-center justify-center">
                      <PolarisIcon type="check" size="small" />
                    </div>)}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-white text-[10px] font-medium truncate">{asset.name}</p>
                  </div>
                </div>))}
            </div>)}

          {activeCategory === 'images' && viewMode === 'list' && (<div className="bg-white rounded-xl border border-[#e3e3e3] overflow-hidden shadow-sm animate-fade-in">
              {SAMPLE_IMAGES.map((asset, i) => (<div key={asset.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#fafafa] transition-colors border-b border-[#f1f1f1] last:border-0 cursor-pointer" onClick={() => toggleSelect(asset.id)}>
                  <s-checkbox checked={selectedIds.includes(asset.id)} onChange={() => toggleSelect(asset.id)} accessibilityLabel={`Select ${asset.name}`} />
                  <img src={asset.src} alt={asset.name} className="w-10 h-10 rounded-lg object-cover border border-[#e3e3e3] flex-shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1a1a1a] truncate">{asset.name}</p>
                    <p className="text-xs text-[#6d6d6d]">{asset.size}</p>
                  </div>
                  <span className="text-xs text-[#a8a8a8]">Jul {i + 10}, 2026</span>
                </div>))}
            </div>)}

          {activeCategory !== 'images' && (<div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 bg-[#f6f6f7] rounded-2xl flex items-center justify-center mb-4">
                <span className="text-2xl">
                  <PolarisIcon type={activeCategory === 'videos' ? 'image' : activeCategory === 'icons' ? 'star' : 'note'} size="large" />
                </span>
              </div>
              <p className="text-sm font-medium text-[#4a4a4a]">No {activeCategory} yet</p>
              <p className="text-xs text-[#a8a8a8] mt-1">Upload files to get started</p>
            </div>)}
        </div>
      </div>
    </div>);
}
