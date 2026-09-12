import { useRef, useState } from 'react';
export default function ProductImages({product}:{product:Record<string,unknown>}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [selected,setSelected]=useState<{url:string;label:string}|null>(null);
  const [hover,setHover]=useState<{url:string;label:string}|null>(null);
  return <><div className="imageIcons">{Array.from({length:6},(_,i)=>{
    const raw=product[`image_${i+1}_url`];
    const url=typeof raw==='string'?raw.replace(/^\/image\//,'/images/'):'';
    const valid=url.startsWith('/images/')||url.startsWith('https://');
    const item={url,label:`${product.name}, imagem ${i+1}`};
    return <button key={i} type="button" className="imageIcon" disabled={!valid} aria-label={valid?`Abrir ${item.label}`:`Imagem ${i+1} não cadastrada`} onMouseEnter={()=>valid&&setHover(item)} onMouseLeave={()=>setHover(null)} onFocus={()=>valid&&setHover(item)} onBlur={()=>setHover(null)} onKeyDown={e=>{if(e.key==='Escape')setHover(null);}} onClick={()=>{setHover(null);setSelected(item);dialog.current?.showModal();}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 4 4 3-3 5 5"/></svg></button>;
  })}</div>{hover&&<div className="imageHover" role="tooltip"><img src={hover.url} alt={hover.label}/></div>}
    <dialog ref={dialog} className="imageDialog" onClick={e=>{if(e.target===e.currentTarget)dialog.current?.close();}} onClose={()=>setSelected(null)}><button autoFocus type="button" onClick={()=>dialog.current?.close()}>Fechar ×</button>{selected&&<><p>{selected.label}</p><img src={selected.url} alt={selected.label}/></>}</dialog></>;
}
