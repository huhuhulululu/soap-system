export interface BillRow {
  patientName: string
  patientId: string
  dos: string
  icd: string[]
  cpt: string[]
  charge: number
}

export interface BillList {
  patient: string
  insurance: string
  totalCharge: number
  rows: BillRow[]
}

export type BillFormat = 'html' | 'xlsx-binary' | 'unknown'

// Detect bill file format from raw bytes or string.
// - xlsx-binary: starts with PK\x03\x04 (ZIP/XLSX/docx)
// - html: contains <table> / <html> / <!doctype html> markers
// - unknown: neither
export function detectBillFormat(raw: string | Uint8Array): BillFormat {
  const bytes = typeof raw === 'string'
    ? new TextEncoder().encode(raw.slice(0, 500))
    : raw.subarray(0, 500)
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return 'xlsx-binary'
  }
  const head = (typeof raw === 'string' ? raw.slice(0, 500) : new TextDecoder('utf-8').decode(bytes)).toLowerCase()
  if (head.includes('<table') || head.includes('<!doctype html') || head.includes('<html')) {
    return 'html'
  }
  return 'unknown'
}

function splitByBr(el: Element): string[] {
  const segments: string[] = []
  let current = ''
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === 1 && (node as Element).tagName === 'BR') {
      segments.push(current)
      current = ''
    } else {
      current += node.textContent || ''
    }
  }
  segments.push(current)
  return segments
}

function isOuterRow(tr: HTMLTableRowElement, table: HTMLTableElement): boolean {
  const p = tr.parentElement
  return p === table || (p?.tagName === 'TBODY' && p.parentElement === table)
}

export function parseBillListHtml(html: string): BillList {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const table = doc.getElementById('listTable') as HTMLTableElement | null
  if (!table) throw new Error('listTable not found')

  const rows: BillRow[] = []
  let insurance = ''

  for (const tr of Array.from(table.rows).filter(r => isOuterRow(r, table))) {
    const tds = Array.from(tr.children).filter(n => n.tagName === 'TD') as HTMLTableCellElement[]
    if (tds.length !== 11) continue

    const patientName = (tds[0].textContent || '').trim()
    if (!patientName) continue

    const dosRaw = (tds[2].textContent || '').trim()
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dosRaw)) continue

    if (!insurance) insurance = (tds[7].textContent || '').trim()

    const icd = splitByBr(tds[8]).map(s => s.trim()).filter(Boolean)

    const nested = tds[9].querySelector('table') as HTMLTableElement | null
    const cpt: string[] = []
    let charge = 0

    if (nested) {
      for (const nr of Array.from(nested.rows)) {
        if ((nr.className || '').includes('tableAcctSum')) continue
        const ntds = Array.from(nr.children).filter(n => n.tagName === 'TD') as HTMLTableCellElement[]
        if (ntds.length < 3) continue
        const code = (ntds[0].textContent || '').trim()
        if (/^\d{5,7}$/.test(code)) {
          cpt.push(code)
          const c = parseFloat((ntds[2].textContent || '').trim())
          if (!Number.isNaN(c)) charge += c
        }
      }
    }

    rows.push({
      patientName,
      patientId: (tds[1].textContent || '').trim(),
      dos: dosRaw,
      icd,
      cpt,
      charge,
    })
  }

  return {
    patient: rows[0]?.patientName || '',
    insurance,
    totalCharge: rows.reduce((s, r) => s + r.charge, 0),
    rows,
  }
}
