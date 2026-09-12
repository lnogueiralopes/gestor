import { useEffect, useState } from 'react';
export default function ImageField({url,index,onChange}:{url:string;index:number;onChange:(url:string)=>void}) {
  const [failed,setFailed]=useState(false);
  const [edit,setEdit]=useState(false);
  useEffect(()=>setFailed(false),[url]);
  const valid=url.startsWith('/images/')||url.startsWith('https://');
  return <div className="imageField"><button className="imageTile" type="button" aria-label={`Editar imagem ${index+1}`} onClick={()=>setEdit(!edit)} aria-expanded={edit}>
    {valid&&!failed?<img src={url} alt={`Imagem ${index+1} do produto`} onError={()=>setFailed(true)}/>:<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 4 4 3-3 5 5"/></svg>}
  </button>{edit&&<div className="imageTileEditor"><input aria-label={`Endereço da imagem ${index+1}`} value={url} placeholder="/images/EAN_1.jpg" onChange={e=>onChange(e.target.value)}/><button type="button" onClick={()=>setEdit(false)}>OK</button></div>}</div>;
}
