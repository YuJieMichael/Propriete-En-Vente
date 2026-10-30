// A buyer's what-if model, not the business's figures: every input is an
// assumption the visitor adjusts. Net income here is before financing and tax.
export type PaybackInput = {price: number; revenue: number; expenseRatio: number};
export function payback({price, revenue, expenseRatio}: PaybackInput) {
  const expenses = revenue * expenseRatio;
  const net = revenue - expenses;
  return {
    revenue, expenses, net,
    capRate: price > 0 && net > 0 ? net / price : null,
    years: price > 0 && net > 0 ? price / net : null,
  };
}
export const hotelRevenue = (rooms: number, nightlyRate: number, occupancy: number) => rooms * nightlyRate * occupancy * 365;
// Québec daycares open on weekdays; about 260 days a year after statutory holidays.
export const daycareDays = 260;
export const daycareRevenue = (places: number, dailyRate: number, occupancy: number) => places * dailyRate * occupancy * daycareDays;

/** The first whole number in a published fact such as "Approximately 17" or "80 subsidized places". */
export function publishedCount(value?: string) {
  const match = value?.replace(/[\s,]/g, '').match(/\d+/);
  const count = match ? Number(match[0]) : NaN;
  return count > 0 && count < 10_000 ? count : null;
}
