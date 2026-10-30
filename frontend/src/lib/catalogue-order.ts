// The catalogue's default order (newest publication day, then id), also applied
// to the live load so listings with equal publication times keep a fixed order.
export const compareNewest=(a:{id:string;published_at:string},b:{id:string;published_at:string})=>
  String(b.published_at).slice(0,10).localeCompare(String(a.published_at).slice(0,10))||String(a.id).localeCompare(String(b.id));
