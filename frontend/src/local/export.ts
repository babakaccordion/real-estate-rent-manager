/**
 * تصدير التقارير في النسخة المحلية:
 * CSV، وملف Excel (HTML)، وطباعة/حفظ PDF من المتصفح.
 */

export interface ReportBlock {
  title: string
  headers: string[]
  rows: Array<Array<string | number>>
}

export interface ReportDocument {
  file: string
  title: string
  subtitle: string
  blocks: ReportBlock[]
}

const money = (v: unknown): string => {
  const n = Number(v)
  if (!Number.isFinite(n)) return String(v ?? '')
  return n.toFixed(2)
}

const text = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

const shortDate = (v: unknown): string => text(v).slice(0, 10)

const statusLabel: Record<string, string> = {
  due: 'مستحق',
  partial: 'مدفوع جزئيًا',
  paid: 'مدفوع بالكامل',
  overdue: 'متأخر',
  cancelled: 'ملغى',
}

const methodLabel: Record<string, string> = {
  cash: 'نقدًا',
  bank: 'تحويل بنكي',
  other: 'أخرى',
}

const movementLabel: Record<string, string> = {
  opening_balance: 'رصيد افتتاحي',
  rent_receipt: 'قبض إيجار',
  expense: 'مصروف',
  adjustment: 'تسوية',
  other: 'حركة أخرى',
}

const expenseLabel: Record<string, string> = {
  maintenance: 'صيانة',
  repair: 'إصلاح أعطال',
  utilities: 'أجور خدمات',
  water_electric: 'فواتير المياه والكهرباء',
  taxes_fees: 'رسوم وضرائب',
  cleaning: 'تنظيف',
  other: 'أخرى',
}

export function buildReportDocument(kind: string, report: any, start: string, end: string): ReportDocument {
  const range = kind === 'arrears' ? `حتى ${end}` : `من ${start} إلى ${end}`
  const stub = (title: string): ReportDocument => ({
    file: `report_${kind}_${start}_${end}`,
    title,
    subtitle: range,
    blocks: [],
  })

  if (kind === 'overall') {
    const doc = stub('التقرير الشامل لجميع العقارات')
    const rows = (report?.properties || []).map((p: any) => [
      p.property.name,
      p.units_count,
      p.tenants_count,
      money(p.total_due),
      money(p.total_collected),
      money(p.total_remaining),
      money(p.expenses_paid),
      money(p.net_cash_flow),
    ])
    const t = report?.totals
    if (t) {
      rows.push([
        'الإجمالي',
        t.units_count,
        t.tenants_count,
        money(t.total_due),
        money(t.total_collected),
        money(t.total_remaining),
        money(t.expenses_paid),
        money(t.net_cash_flow),
      ])
    }
    doc.blocks.push({
      title: 'ملخص العقارات',
      headers: ['العقار', 'الوحدات', 'المستأجرون', 'المستحق', 'المحصل', 'المتبقي', 'المصاريف', 'صافي التدفق'],
      rows,
    })
    return doc
  }

  if (kind === 'property') {
    const doc = stub(`تقرير العقار: ${report?.property?.name ?? ''}`)
    doc.blocks.push({
      title: 'الاستحقاقات',
      headers: ['الفترة', 'تاريخ الاستحقاق', 'المستحق', 'المدفوع', 'الحالة'],
      rows: (report?.charges || []).map((c: any) => [
        c.period,
        shortDate(c.due_date),
        money(c.amount_due),
        money(c.amount_paid),
        statusLabel[c.status] || c.status,
      ]),
    })
    doc.blocks.push({
      title: 'المصاريف',
      headers: ['التاريخ', 'التصنيف', 'المبلغ', 'الحالة', 'الوصف'],
      rows: (report?.expenses || []).map((e: any) => [
        shortDate(e.expense_date),
        expenseLabel[e.category] || e.category,
        money(e.amount),
        e.is_paid ? 'مدفوع' : 'غير مدفوع',
        text(e.description),
      ]),
    })
    doc.blocks.push({
      title: 'الملخص',
      headers: ['البيان', 'القيمة'],
      rows: [
        ['الإجمالي المستحق', money(report?.total_due)],
        ['المحصل', money(report?.total_collected)],
        ['المتبقي', money(report?.total_remaining)],
        ['المتأخرات', money(report?.total_overdue)],
        ['المصاريف المدفوعة', money(report?.expenses_paid)],
        ['المصاريف غير المدفوعة', money(report?.expenses_unpaid)],
        ['صافي التدفق', money(report?.net_cash_flow)],
        ['الرصيد الافتتاحي', money(report?.opening_balance)],
        ['الرصيد الختامي', money(report?.closing_balance)],
      ],
    })
    return doc
  }

  if (kind === 'cash') {
    const doc = stub('تقرير حركة الصندوق')
    doc.blocks.push({
      title: 'الحركات',
      headers: ['التاريخ', 'النوع', 'المبلغ', 'التصنيف', 'الوصف'],
      rows: (report?.movements || []).map((m: any) => [
        shortDate(m.movement_date),
        movementLabel[m.movement_type] || m.movement_type,
        money(m.amount),
        text(m.category),
        text(m.description),
      ]),
    })
    doc.blocks.push({
      title: 'الملخص',
      headers: ['البيان', 'القيمة'],
      rows: [
        ['الرصيد الافتتاحي', money(report?.opening_balance)],
        ['المقبوضات', money(report?.receipts)],
        ['المصاريف المدفوعة', money(report?.expenses_paid)],
        ['التسويات', money(report?.adjustments)],
        ['الرصيد الختامي', money(report?.closing_balance)],
      ],
    })
    return doc
  }

  if (kind === 'arrears') {
    const doc = stub('تقرير المتأخرات')
    doc.blocks.push({
      title: 'المتأخرات',
      headers: ['المستأجر', 'العقار', 'الفترة', 'تاريخ الاستحقاق', 'المتبقي', 'أيام التأخير'],
      rows: (report || []).map((a: any) => [
        text(a.tenant_name),
        text(a.property_name),
        text(a.period),
        shortDate(a.due_date),
        money(a.remaining),
        a.days_overdue,
      ]),
    })
    return doc
  }

  if (kind === 'expenses') {
    const doc = stub('تقرير المصاريف')
    doc.blocks.push({
      title: 'المصاريف',
      headers: ['رقم المصروف', 'التاريخ', 'التصنيف', 'المبلغ', 'الحالة', 'الوصف'],
      rows: (report || []).map((e: any) => [
        text(e.expense_number),
        shortDate(e.expense_date),
        expenseLabel[e.category] || e.category,
        money(e.amount),
        e.is_paid ? 'مدفوع' : 'غير مدفوع',
        text(e.description),
      ]),
    })
    return doc
  }

  if (kind === 'receipts') {
    const doc = stub('تقرير المقبوضات')
    doc.blocks.push({
      title: 'المقبوضات',
      headers: ['الإيصال', 'المستأجر', 'العقار', 'التاريخ', 'المبلغ', 'الطريقة'],
      rows: (report || []).map((r: any) => [
        text(r.receipt_number),
        text(r.tenant_name),
        text(r.property_name),
        shortDate(r.payment_date),
        money(r.amount),
        methodLabel[r.method] || r.method,
      ]),
    })
    return doc
  }

  // تقرير مستأجر
  const doc = stub(`تقرير المستأجر: ${report?.tenant?.full_name ?? ''}`)
  doc.blocks.push({
    title: 'الملخص',
    headers: ['البيان', 'القيمة'],
    rows: [
      ['رقم المستأجر', text(report?.tenant?.tenant_number)],
      ['المستحق', money(report?.total_due)],
      ['المحصل', money(report?.total_collected)],
      ['المتبقي', money(report?.remaining)],
      ['الرصيد الدائن', money(report?.tenant?.credit_balance)],
    ],
  })
  doc.blocks.push({
    title: 'الاستحقاقات',
    headers: ['الفترة', 'تاريخ الاستحقاق', 'المستحق', 'المدفوع', 'الحالة'],
    rows: (report?.charges || []).map((c: any) => [
      c.period,
      shortDate(c.due_date),
      money(c.amount_due),
      money(c.amount_paid),
      statusLabel[c.status] || c.status,
    ]),
  })
  doc.blocks.push({
    title: 'الدفعات',
    headers: ['الإيصال', 'التاريخ', 'المبلغ', 'الطريقة'],
    rows: (report?.payments || []).map((p: any) => [
      text(p.receipt_number),
      shortDate(p.payment_date),
      money(p.amount),
      methodLabel[p.method] || p.method,
    ]),
  })
  return doc
}

const CSV_BOM = '\uFEFF'

function csvCell(v: string | number): string {
  const s = String(v ?? '')
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function reportCsv(doc: ReportDocument): string {
  const lines: string[] = []
  lines.push(csvCell(doc.title))
  lines.push(csvCell(doc.subtitle))
  for (const block of doc.blocks) {
    lines.push('')
    lines.push(csvCell(block.title))
    lines.push(block.headers.map(csvCell).join(','))
    for (const row of block.rows) lines.push(row.map(csvCell).join(','))
  }
  return CSV_BOM + lines.join('\r\n')
}

function escapeHtml(v: string | number): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function reportExcelHtml(doc: ReportDocument): string {
  const tables = doc.blocks
    .map(
      (b) => `<h3>${escapeHtml(b.title)}</h3>
<table border="1">
<thead><tr>${b.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
<tbody>${b.rows
        .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
        .join('')}</tbody>
</table>`,
    )
    .join('<br/>')
  return `<html dir="rtl"><head><meta charset="utf-8" /></head><body>
<h2>${escapeHtml(doc.title)}</h2>
<p>${escapeHtml(doc.subtitle)}</p>
${tables}
</body></html>`
}

export function downloadBlob(filename: string, mime: string, content: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function exportReportCsv(doc: ReportDocument): void {
  downloadBlob(`${doc.file}.csv`, 'text/csv', reportCsv(doc))
}

export function exportReportExcel(doc: ReportDocument): void {
  downloadBlob(`${doc.file}.xls`, 'application/vnd.ms-excel', reportExcelHtml(doc))
}

export function printReport(doc: ReportDocument): void {
  const win = window.open('', '_blank')
  if (!win) {
    alert('يرجى السماح بالنوافذ المنبثقة لطباعة التقرير أو حفظه PDF')
    return
  }
  const tables = doc.blocks
    .map(
      (b) => `<h3>${escapeHtml(b.title)}</h3>
<table><thead><tr>${b.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
<tbody>${b.rows
        .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
        .join('')}</tbody></table>`,
    )
    .join('')
  win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8" />
<title>${escapeHtml(doc.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet" />
<style>
  body { font-family: Cairo, Arial, sans-serif; padding: 24px; color: #111; }
  h1 { font-size: 20px; color: #1e3a5f; margin: 0 0 4px; }
  .sub { color: #555; font-size: 12px; margin-bottom: 18px; }
  h3 { font-size: 14px; margin: 18px 0 6px; color: #1e3a5f; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 8px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; }
  th { background: #eef2f7; }
  @media print { body { padding: 0; } }
</style></head><body>
<h1>${escapeHtml(doc.title)}</h1>
<div class="sub">${escapeHtml(doc.subtitle)}</div>
${tables}
<script>window.onload = function(){ window.focus(); window.print(); }</script>
</body></html>`)
  win.document.close()
}
