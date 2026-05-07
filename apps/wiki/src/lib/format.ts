const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  dateStyle: "medium",
  timeStyle: "short",
};

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  dateStyle: "medium",
};

export function formatDateTime(value: string | number | Date): string {
  return new Date(value).toLocaleString(undefined, DATE_TIME_OPTIONS);
}

export function formatDate(value: string | number | Date): string {
  return new Date(value).toLocaleDateString(undefined, DATE_OPTIONS);
}
