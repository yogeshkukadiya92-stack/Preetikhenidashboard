function minutes(time) {
  const match = /^(\d{1,2}):(\d{2})\s*(am|pm)?$/i.exec(String(time ?? '').trim());
  if (!match) return Infinity;
  const hour = Number(match[1]);
  return (match[3] ? hour % 12 + (match[3].toLowerCase() === 'pm' ? 12 : 0) : hour) * 60 + Number(match[2]);
}

export function sortMeals(meals = []) {
  return [...(meals ?? [])].sort((a, b) => minutes(a.time) - minutes(b.time));
}
