export function installGoogleAdsMeasurement(config: {
  origin: string;
  tagId?: string;
  buyer?: string;
  seller?: string;
  mount: string;
}): void;
export function trackGoogleAdsLead(kind: 'buyer' | 'seller', requestId: string): void;
