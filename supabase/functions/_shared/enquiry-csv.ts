export function enquiriesCsv(rows: Record<string, unknown>[], options: {includeListing?: boolean} = {}): string {
  const columns = ['created_at','kind','name','email','phone','city','address','propertyType','daycareSubsidy','budgetMin','budgetMax','expectedPrice','requirements','timeline','service','assistance','contactLanguage','contactMethod','contactTime','listingReference','language'];
  if (options.includeListing !== false) columns.push('listingStatus','listingId','listingNumber','listingTitle','listingAddress','listingAddressStatus','listingCity','listingPrice','listingTransaction','listingUrl','listingResolvedAt','listingSnapshotSource');
  const cell = (v: unknown) => {
    let text = String(v ?? '');
    if (/^[\s\uFEFF]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"','""') + '"';
  };
  return '\uFEFF' + [columns, ...rows.map(row => columns.map(key => row[key]))].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
