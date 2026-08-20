export const GRID_SORT_OPTIONS = Object.freeze([
  {value:'featured',label:'Featured / Default'},
  {value:'title-asc',label:'Title A → Z'},
  {value:'title-desc',label:'Title Z → A'},
  {value:'price-asc',label:'Price Low → High'},
  {value:'price-desc',label:'Price High → Low'},
  {value:'newest',label:'Newest First'},
]);
export const PRODUCT_GRID_SOURCE_OPTIONS = Object.freeze([
  {value:'all-products',label:'All Products'},
  {value:'current-collection',label:'Current Collection'},
  {value:'search-context',label:'Current Search Results'},
]);
export function normalizeGridProps(type='',value={}){
  const p=value||{};
  const defaultColumns = ['collection-grid'].includes(type)?3:['blog-article-grid'].includes(type)?3:4;
  return {
    ...p,
    source:p.source|| (type==='product-grid'?'all-products':'context'),
    query:String(p.query||''),
    sortBy:p.sortBy||'featured',
    limit:Math.max(1,Math.min(50,Number(p.limit|| (type==='product-recommendations'?4:type==='upsell-products'?3:12)))),
    columnsDesktop:Math.max(1,Math.min(6,Number(p.columnsDesktop||p.columns||defaultColumns))),
    columnsTablet:Math.max(1,Math.min(4,Number(p.columnsTablet||2))),
    columnsMobile:Math.max(1,Math.min(2,Number(p.columnsMobile||1))),
    gap:Math.max(0,Math.min(120,Number(p.gap||18))),
    showImage:p.showImage!==false,
    showTitle:p.showTitle!==false,
    showPrice:p.showPrice!==false,
    showVendor:p.showVendor===true,
    showExcerpt:p.showExcerpt!==false,
    showAuthor:p.showAuthor===true,
    showDate:p.showDate!==false,
    showType:p.showType!==false,
    showCount:p.showCount!==false,
    imageRatio:p.imageRatio||'square',
    emptyText:p.emptyText||'No items found.',
  };
}
export function gridImageRatio(value='square'){ return value==='portrait'?'4 / 5':value==='landscape'?'4 / 3':value==='original'?'auto':'1 / 1'; }
