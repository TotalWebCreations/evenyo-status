export function dayKey(date, timeZone) {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function lastDays(now, count, timeZone) {
    return Array.from({ length: count }, (_, index) => dayKey(new Date(now.getTime() - (count - 1 - index) * 86_400_000), timeZone));
}
