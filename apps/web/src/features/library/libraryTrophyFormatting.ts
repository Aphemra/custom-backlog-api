export function formatElapsed(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);
  const hours = totalHours % 24;
  const totalDays = Math.floor(totalHours / 24);

  if (totalMinutes < 1) {
    return `${totalSeconds} ${totalSeconds === 1 ? "second" : "seconds"}`;
  }

  if (totalHours < 1) {
    return `${totalMinutes} ${
      totalMinutes === 1 ? "minute" : "minutes"
    }, ${seconds} ${seconds === 1 ? "second" : "seconds"}`;
  }

  if (totalDays < 1) {
    return `${totalHours} ${totalHours === 1 ? "hour" : "hours"}, ${
      minutes
    } ${minutes === 1 ? "minute" : "minutes"}`;
  }

  if (totalDays < 31) {
    return `${totalDays} ${totalDays === 1 ? "day" : "days"}, ${hours} ${
      hours === 1 ? "hour" : "hours"
    }`;
  }

  const years = Math.floor(totalDays / 365);
  const daysAfterYears = totalDays % 365;
  const months = Math.floor(daysAfterYears / 30);
  const days = daysAfterYears % 30;

  const parts: string[] = [];

  if (years > 0) {
    parts.push(`${years} ${years === 1 ? "year" : "years"}`);
  }

  if (months > 0) {
    parts.push(`${months} ${months === 1 ? "month" : "months"}`);
  }

  if (days > 0 || parts.length === 0) {
    parts.push(`${days} ${days === 1 ? "day" : "days"}`);
  }

  return parts.join(", ");
}

export function formatCompactElapsed(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);
  const hours = totalHours % 24;
  const totalDays = Math.floor(totalHours / 24);

  if (totalMinutes < 1) {
    return `${totalSeconds}s`;
  }

  if (totalHours < 1) {
    return `${totalMinutes}m ${seconds}s`;
  }

  if (totalDays < 1) {
    return `${totalHours}h ${minutes}m`;
  }

  if (totalDays < 31) {
    return `${totalDays}d ${hours}h`;
  }

  const years = Math.floor(totalDays / 365);
  const daysAfterYears = totalDays % 365;
  const months = Math.floor(daysAfterYears / 30);
  const days = daysAfterYears % 30;

  if (years > 0) {
    return months > 0 ? `${years}y ${months}mo` : `${years}y`;
  }

  return days > 0 ? `${months}mo ${days}d` : `${months}mo`;
}
