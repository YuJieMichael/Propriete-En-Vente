import type { PropertyType } from '../../supabase/functions/_shared/listing-input';

// Keep the legacy commercial value readable without offering it for new listings.
export const selectablePropertyTypes: PropertyType[] = ['house','condo','plex','land','hotel-motel','daycare','business'];
export const daycareLabels = {
  en: { title: 'Daycare subsidy status', all: 'All daycares', subsidized: 'Subsidized', 'non-subsidized': 'Non-subsidized' },
  fr: { title: 'Statut de subvention de la garderie', all: 'Toutes les garderies', subsidized: 'Subventionnée', 'non-subsidized': 'Non subventionnée' },
  zh: { title: '托儿机构补贴情况', all: '全部托儿机构', subsidized: '有政府补贴', 'non-subsidized': '无政府补贴' },
};
