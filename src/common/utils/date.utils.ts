/**
 * 日期工具函数
 */

/**
 * 获取今天的开始时间 (00:00:00)
 */
export function getStartOfDay(date: Date = new Date()): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * 获取今天的结束时间 (23:59:59)
 */
export function getEndOfDay(date: Date = new Date()): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * 获取本周的开始时间 (周一 00:00:00)
 */
export function getStartOfWeek(date: Date = new Date()): Date {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1); // 调整为周一开始
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * 获取本月的开始时间 (1号 00:00:00)
 */
export function getStartOfMonth(date: Date = new Date()): Date {
  const start = new Date(date);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * 获取本月的结束时间 (最后一天 23:59:59)
 */
export function getEndOfMonth(date: Date = new Date()): Date {
  const end = new Date(date);
  end.setMonth(end.getMonth() + 1);
  end.setDate(0);
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * 计算两个日期之间的工作日数量 (排除周末)
 */
export function getWorkingDaysBetween(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 不是周日(0)和周六(6)
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

/**
 * 检查日期是否逾期
 */
export function isOverdue(date: Date): boolean {
  return date < new Date();
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * 格式化日期时间为 YYYY-MM-DD HH:mm:ss
 */
export function formatDateTime(date: Date): string {
  return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
}

/**
 * 解析日期字符串
 */
export function parseDate(dateString: string): Date {
  return new Date(dateString);
}

/**
 * 添加天数
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * 添加工作日 (跳过周末)
 */
export function addWorkingDays(date: Date, days: number): Date {
  let result = new Date(date);
  let addedDays = 0;
  
  while (addedDays < days) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 不是周末
      addedDays++;
    }
  }
  
  return result;
}
