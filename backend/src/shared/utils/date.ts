export function sqlLocalToIso(dateLike: Date | string | null | undefined): string {
  if (dateLike == null || dateLike === '') return new Date().toISOString()
  let d: Date
  if (dateLike instanceof Date) {
    d = new Date(
      dateLike.getFullYear(),
      dateLike.getMonth(),
      dateLike.getDate(),
      dateLike.getHours(),
      dateLike.getMinutes(),
      dateLike.getSeconds(),
      dateLike.getMilliseconds()
    )
  } else {
    const s = String(dateLike).replace('Z', '')
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?/)
    if (m) {
      const [, y, mo, da, h, mi, se, ms] = m
      d = new Date(
        Number(y),
        Number(mo) - 1,
        Number(da),
        Number(h),
        Number(mi),
        se ? Number(se) : 0,
        ms ? Number(String(ms).padEnd(3, '0').slice(0, 3)) : 0
      )
    } else {
      d = new Date(s)
    }
  }
  return d.toISOString()
}

export function sqlLocalToIsoOrNull(dateLike: Date | string | null | undefined): string | null {
  if (dateLike == null || dateLike === '') return null
  return sqlLocalToIso(dateLike)
}
