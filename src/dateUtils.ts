export function parseGaDate(dateStr: string): Date {
  if (dateStr === 'today') return new Date();
  if (dateStr === 'yesterday') {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d;
  }
  const ndaysMatch = dateStr.match(/^(\d+)daysAgo$/);
  if (ndaysMatch) {
    const d = new Date();
    d.setDate(d.getDate() - parseInt(ndaysMatch[1], 10));
    return d;
  }
  const t = new Date(dateStr);
  if (!isNaN(t.getTime())) return t;
  return new Date();
}

export function formatDateGa(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function chunkDateRange(startDateStr: string, endDateStr: string, chunkSize: number = 10): {startDate: string, endDate: string}[] {
  const startDate = parseGaDate(startDateStr);
  let endDate = parseGaDate(endDateStr);

  if (startDate > endDate) {
    return [{ startDate: startDateStr, endDate: endDateStr }];
  }

  startDate.setHours(0,0,0,0);
  endDate.setHours(0,0,0,0);

  const chunks = [];
  let currentStart = new Date(startDate);

  while (currentStart <= endDate) {
    let currentEnd = new Date(currentStart);
    currentEnd.setDate(currentStart.getDate() + chunkSize - 1);

    if (currentEnd > endDate) {
      currentEnd = new Date(endDate);
    }

    chunks.push({
      startDate: formatDateGa(currentStart),
      endDate: formatDateGa(currentEnd)
    });

    currentStart = new Date(currentEnd);
    currentStart.setDate(currentStart.getDate() + 1);
  }

  return chunks;
}
