import { useCallback, useEffect, useState } from "react";

export default function useTemplateBrowser({ initialLibraryItems = [], editorActionFetcher, libraryFetcher, marketplaceFetcher }) {
  const [libraryItems, setLibraryItems] = useState(initialLibraryItems);
  const [marketplace, setMarketplace] = useState({ items:[], counts:{}, filters:{}, remote:{}, plan:null });

  useEffect(() => { setLibraryItems(initialLibraryItems || []); }, [initialLibraryItems]);
  useEffect(() => {
    const data = editorActionFetcher.data;
    if (!data?.success) return;
    if (["library-list", "library-browser"].includes(data.intent) && Array.isArray(data.items)) setLibraryItems(data.items);
    if (data.intent === "library-browser" && data.marketplace) setMarketplace(data.marketplace);
  }, [editorActionFetcher.data]);

  const load = useCallback(() => {
    editorActionFetcher.submit({ intent:"library-browser" }, { method:"post" });
  }, [editorActionFetcher]);

  const toggleLibraryFavorite = useCallback((item) => {
    if (!item?.id) return;
    const favorite = !item.isFavorite;
    setLibraryItems((current)=>current.map((entry)=>entry.id===item.id?{...entry,isFavorite:favorite}:entry));
    libraryFetcher.submit({ intent:"favorite", id:item.id, favorite:String(favorite) }, { method:"post", action:"/app/library" });
  }, [libraryFetcher]);

  const toggleMarketplaceFavorite = useCallback((item) => {
    if (!item?.catalogId) return;
    const favorite = !item.isFavorite;
    setMarketplace((current)=>({...current,items:(current.items||[]).map((entry)=>entry.catalogId===item.catalogId?{...entry,isFavorite:favorite}:entry)}));
    marketplaceFetcher.submit({ intent:"favorite", catalogId:item.catalogId, favorite:String(favorite) }, { method:"post", action:"/app/marketplace" });
  }, [marketplaceFetcher]);

  const installMarketplace = useCallback((item) => {
    if (!item?.catalogId) return;
    marketplaceFetcher.submit({ intent:"install", catalogId:item.catalogId }, { method:"post", action:"/app/marketplace" });
  }, [marketplaceFetcher]);

  useEffect(() => {
    const data = marketplaceFetcher.data;
    if (!data?.ok) return;
    if (["install", "rollback"].includes(data.intent)) load();
    if (data.intent === "favorite" && data.catalogId) {
      setMarketplace((current)=>({...current,items:(current.items||[]).map((entry)=>entry.catalogId===data.catalogId?{...entry,isFavorite:data.favorite===true}:entry)}));
    }
  }, [marketplaceFetcher.data, load]);

  return { libraryItems, setLibraryItems, marketplace, load, toggleLibraryFavorite, toggleMarketplaceFavorite, installMarketplace };
}
