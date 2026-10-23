import {useEffect,useId,useState} from 'react';
import {Check,ClipboardCheck} from 'lucide-react';
import type {PublicProperty} from '../../supabase/functions/_shared/listing-input';
import type {Language} from './seller-copy';
import {checkListing,inspectSelectedPhoto,type SelectedPhotoReview} from './listing-checkup-data';
import './listing-checkup.css';

export function ListingCheckup({lang,property,photos,onEdit}:{lang:Language;property:PublicProperty;photos:string[];onEdit?:()=>void}){
  const id=useId();
  const [review,setReview]=useState<{photos:string[];items:SelectedPhotoReview[]}|null>(null);
  const [confirmed,setConfirmed]=useState<string[]>([]);
  useEffect(()=>{
    let cancelled=false;
    void Promise.all(photos.map(inspectSelectedPhoto)).then(items=>{if(!cancelled)setReview({photos,items});});
    return ()=>{cancelled=true;};
  },[photos]);
  const reviews=review?.photos===photos?review.items:[];
  const pending=photos.length>0&&review?.photos!==photos;
  const result=checkListing(property,photos,reviews,lang);
  const c={
    en:{title:'Your listing checkup',intro:'A quick review before you send your listing for moderation.',ready:'Present in the preview',attention:'Suggestions before sending',none:'No further formatting suggestions from these checks.',confirm:'Your final review',confirmHint:'Tick each item after reviewing your description. You can return to editing at any time.',checking:'Checking selected photo dimensions and identical files…',edit:'Return to editing',note:'These checks use only the fields and photos selected in this browser. They check completeness, image dimensions and identical files; they do not assess photo sharpness, verify the property or approve publication.'},
    fr:{title:'Le bilan de votre annonce',intro:'Une vérification rapide avant l’envoi à la modération.',ready:'Présent dans l’aperçu',attention:'Suggestions avant l’envoi',none:'Aucune autre suggestion de présentation issue de ces vérifications.',confirm:'Votre dernière vérification',confirmHint:'Cochez chaque point après avoir relu votre description. Vous pouvez revenir à la modification à tout moment.',checking:'Vérification des dimensions et des fichiers photo identiques…',edit:'Revenir à la modification',note:'Ces vérifications utilisent uniquement les champs et photos choisis dans ce navigateur. Elles portent sur la présence des renseignements, les dimensions et les fichiers identiques; elles n’évaluent pas la netteté, ne vérifient pas la propriété et n’approuvent pas sa publication.'},
    zh:{title:'发布前的房源体检',intro:'提交审核前，快速检查本次预览的资料。',ready:'预览中已具备',attention:'提交前的完善建议',none:'本次检查暂无其他排版与资料完善建议。',confirm:'请您最后核对',confirmHint:'核对描述后可勾选对应项目，也可以随时返回修改。',checking:'正在本机检查照片尺寸和相同文件…',edit:'返回修改',note:'仅使用当前浏览器中已填写的字段和所选照片，检查资料完整度、照片尺寸及相同文件；不评估照片清晰程度、不核实物业事实，也不代表已通过发布审核。'},
  }[lang];
  return <section className="listing-checkup" aria-labelledby={`${id}-title`}>
    <header><ClipboardCheck aria-hidden="true"/><div><h3 id={`${id}-title`}>{c.title}</h3><p>{c.intro}</p></div></header>
    <div className="checkup-grid"><section><h4>{c.ready}</h4><ul className="checkup-ready">{result.ready.map(finding=><li key={finding.key}><Check aria-hidden="true"/><span>{finding.text}</span></li>)}</ul></section><section><h4>{c.attention}</h4>{result.attention.length?<ul className="checkup-attention">{result.attention.map(finding=><li key={finding.key}>{finding.text}</li>)}</ul>:<p>{c.none}</p>}{pending&&<p role="status" className="checkup-pending">{c.checking}</p>}</section></div>
    <fieldset><legend>{c.confirm}</legend><p>{c.confirmHint}</p>{result.confirm.map(finding=><label key={finding.key}><input type="checkbox" checked={confirmed.includes(finding.key)} onChange={event=>setConfirmed(current=>event.target.checked?[...current,finding.key]:current.filter(key=>key!==finding.key))}/><span>{finding.text}</span></label>)}</fieldset>
    {onEdit&&<button className="checkup-edit" type="button" onClick={onEdit}>{c.edit}</button>}
    <p className="checkup-note">{c.note}</p>
  </section>;
}
