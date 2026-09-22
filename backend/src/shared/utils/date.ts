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

type WallClockParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  millisecond: number
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function extractWallClockParts(dateLike: Date | string | null | undefined): WallClockParts | null {
  if (dateLike == null || dateLike === '') return null
  let y = 0, mo = 0, da = 0, h = 0, mi = 0, se = 0, ms = 0
  if (dateLike instanceof Date) {
    y = dateLike.getFullYear()
    mo = dateLike.getMonth() + 1
    da = dateLike.getDate()
    h = dateLike.getHours()
    mi = dateLike.getMinutes()
    se = dateLike.getSeconds()
    ms = dateLike.getMilliseconds()
  } else {
    const s = String(dateLike).replace('Z', '')
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?/)
    if (m) {
      const [, gy, gmo, gda, gh, gmi, gse, gms] = m
      y = Number(gy); mo = Number(gmo); da = Number(gda)
      h = Number(gh); mi = Number(gmi); se = gse ? Number(gse) : 0
      ms = gms ? Number(String(gms).padEnd(3, '0').slice(0, 3)) : 0
    } else {
      const d = new Date(s)
      if (!Number.isNaN(d.getTime())) {
        y = d.getFullYear(); mo = d.getMonth() + 1; da = d.getDate()
        h = d.getHours(); mi = d.getMinutes(); se = d.getSeconds(); ms = d.getMilliseconds()
      }
    }
  }
  if (y < 1970 || mo < 1 || mo > 12 || da < 1 || da > 31) return null
  return { year: y, month: mo, day: da, hour: h, minute: mi, second: se, millisecond: ms }
}

export function sqlWallClockToLocalIso(dateLike: Date | string | null | undefined): string | null {
  const p = extractWallClockParts(dateLike)
  if (!p) return null
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}:${pad2(p.second)}`
}

export function sqlWallClockToMssqlDatetime2(dateLike: unknown): Date | null {
  if (dateLike == null || dateLike === '') return null
  const p = extractWallClockParts(dateLike as Date | string)
  if (!p) return null
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, p.millisecond)
}
