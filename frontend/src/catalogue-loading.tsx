import type {Language} from './seller-copy';
export const catalogueFeedback={
  fr:{loading:'Chargement des propriétés…',updating:'Mise à jour des résultats…'},
  en:{loading:'Loading properties…',updating:'Updating results…'},
  zh:{loading:'正在加载房源…',updating:'正在更新筛选结果…'},
};
export function CatalogueSkeleton({list=false}:{list?:boolean}) {
  return <div className={`property-grid catalogue-skeleton ${list?'property-list':''}`} aria-hidden="true">{[0,1,2,3,4,5].map(index=><div className="skeleton-card" key={index}><div className="skeleton-photo"/><div className="skeleton-body"><span/><span/><span/><span/></div></div>)}</div>;
}
