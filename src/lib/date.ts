export function toDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * "이번 주"는 referenceDate가 속한 월요일~일요일 구간으로 판별한다.
 * referenceDate를 주입받게 해서 시스템 시계에 의존하지 않고 테스트할 수 있게 한다.
 */
export function getCurrentWeekRange(referenceDate: Date = new Date()): { start: string; end: string } {
  const dayOfWeek = referenceDate.getDay() // 0=일, 1=월, ..., 6=토
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek

  const monday = new Date(referenceDate)
  monday.setDate(referenceDate.getDate() + diffToMonday)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  return { start: toDateString(monday), end: toDateString(sunday) }
}

export function yearOf(serviceDate: string): number {
  return Number(serviceDate.slice(0, 4))
}
