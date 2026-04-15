import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { calculateWeightedScore } from './scoring'

const PRIMARY = [79, 70, 229]
const PRIMARY_DEEP = [55, 48, 163]
const PRIMARY_SOFT = [129, 140, 248]
const TEXT_DARK = [15, 23, 42]
const TEXT_MUTED = [71, 85, 105]
const HEADER_HEIGHT = 82
const SUBPAGE_TITLE_Y = 142
const SUBPAGE_TABLE_START_Y = 170
const PDF_FONT_FILE = 'noto-naskh-arabic-regular.ttf'
const PDF_FONT_FAMILY = 'NotoNaskhArabic'
const HEADER_VISUAL_BARS = [14, 20, 30, 20, 24, 16]

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ''

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }

  return window.btoa(binary)
}

async function fetchAssetAsDataUrl(assetPath) {
  try {
    const response = await fetch(assetPath)
    if (!response.ok) return null

    const blob = await response.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = () => reject(new Error(`Unable to load ${assetPath}`))
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

async function registerArabicFont(doc) {
  try {
    const response = await fetch('/branding/noto-naskh-arabic-regular.ttf')
    if (!response.ok) return null

    const fontBuffer = await response.arrayBuffer()
    const fontBase64 = arrayBufferToBase64(fontBuffer)
    doc.addFileToVFS(PDF_FONT_FILE, fontBase64)
    doc.addFont(PDF_FONT_FILE, PDF_FONT_FAMILY, 'normal')

    return PDF_FONT_FAMILY
  } catch {
    return null
  }
}

async function loadReportBrandingAssets(doc) {
  const [nhcLogo, chessLogo, fontFamily] = await Promise.all([
    fetchAssetAsDataUrl('/branding/nhc-logo.png'),
    fetchAssetAsDataUrl('/branding/chessboard-logo.jpeg'),
    registerArabicFont(doc),
  ])

  return {
    nhcLogo,
    chessLogo,
    fontFamily: fontFamily ?? 'helvetica',
  }
}

function safeText(value) {
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}

function rtlText(doc, value) {
  const text = safeText(value)
  if (typeof doc.processArabic === 'function') {
    return doc.processArabic(text)
  }

  return text
}

function setFont(doc, fontFamily, fontSize) {
  doc.setFont(fontFamily, 'normal')
  doc.setFontSize(fontSize)
}

function setTextColor(doc, color) {
  doc.setTextColor(color[0], color[1], color[2])
}

function drawImageContain(doc, imageData, imageType, boxX, boxY, boxWidth, boxHeight) {
  if (!imageData) return

  try {
    const imageProps = doc.getImageProperties(imageData)
    const imageWidth = Number(imageProps?.width ?? boxWidth)
    const imageHeight = Number(imageProps?.height ?? boxHeight)

    if (!imageWidth || !imageHeight) {
      doc.addImage(imageData, imageType, boxX, boxY, boxWidth, boxHeight)
      return
    }

    const scale = Math.min(1, Math.min(boxWidth / imageWidth, boxHeight / imageHeight))
    const drawWidth = imageWidth * scale
    const drawHeight = imageHeight * scale
    const drawX = boxX + (boxWidth - drawWidth) / 2
    const drawY = boxY + (boxHeight - drawHeight) / 2

    doc.addImage(imageData, imageType, drawX, drawY, drawWidth, drawHeight)
  } catch {
    // Ignore image decoding errors and continue generating the report.
  }
}

function drawLogoCard(doc, { x, y, width, height, imageData, imageType }) {
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(224, 231, 255)
  doc.setLineWidth(1)
  doc.roundedRect(x, y, width, height, 10, 10, 'FD')

  drawImageContain(doc, imageData, imageType, x + 10, y + 8, width - 20, height - 16)
}

function drawHeaderVisuals(doc, pageWidth, y) {
  doc.setFillColor(...PRIMARY)
  doc.rect(0, y, pageWidth, HEADER_HEIGHT, 'F')

  doc.setFillColor(...PRIMARY_DEEP)
  doc.rect(0, y + HEADER_HEIGHT - 10, pageWidth, 10, 'F')

  doc.setFillColor(99, 102, 241)
  doc.circle(52, y + 18, 16, 'F')
  doc.circle(pageWidth - 56, y + 18, 14, 'F')

  doc.setDrawColor(...PRIMARY_SOFT)
  doc.setLineWidth(0.8)
  for (let lineX = -20; lineX < pageWidth + 20; lineX += 38) {
    doc.line(lineX, y + HEADER_HEIGHT - 6, lineX + 18, y + HEADER_HEIGHT - 22)
  }

  let barsX = pageWidth / 2 - 41
  doc.setFillColor(199, 210, 254)
  HEADER_VISUAL_BARS.forEach((barHeight) => {
    doc.roundedRect(barsX, y + HEADER_HEIGHT - 8 - barHeight, 8, barHeight, 2, 2, 'F')
    barsX += 14
  })
}

function drawPdfReportHeader(doc, assets, { pageWidth, y = 0, withBackground = true }) {
  if (withBackground) {
    drawHeaderVisuals(doc, pageWidth, y)
  }

  const logoY = y + 8
  const logoHeight = HEADER_HEIGHT - 16

  drawLogoCard(doc, {
    x: 24,
    y: logoY,
    width: 182,
    height: logoHeight,
    imageData: assets.chessLogo,
    imageType: 'JPEG',
  })

  drawLogoCard(doc, {
    x: pageWidth - 24 - 172,
    y: logoY,
    width: 172,
    height: logoHeight,
    imageData: assets.nhcLogo,
    imageType: 'PNG',
  })
}

function formatArabicDate(value = new Date()) {
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(value)
}

function formatExportDate(value = new Date()) {
  const date = new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function qualityLabel(score) {
  if (score >= 4) return 'ممتاز'
  if (score >= 2.5) return 'متوسط'
  return 'ضعيف'
}

function qualityColor(score) {
  if (score >= 4) return [16, 185, 129]
  if (score >= 2.5) return [245, 158, 11]
  return [244, 63, 94]
}

function addPageHeaderFooter(doc, generatedAtText, assets) {
  const totalPages = doc.getNumberOfPages()
  const width = doc.internal.pageSize.getWidth()
  const height = doc.internal.pageSize.getHeight()

  for (let pageIndex = 1; pageIndex <= totalPages; pageIndex += 1) {
    doc.setPage(pageIndex)

    drawPdfReportHeader(doc, assets, { pageWidth: width, y: 0, withBackground: true })

    setTextColor(doc, [255, 255, 255])
    setFont(doc, assets.fontFamily, 10)
    doc.text(rtlText(doc, `صفحة ${pageIndex} من ${totalPages}`), width / 2, 26, {
      align: 'center',
    })

    setTextColor(doc, TEXT_MUTED)
    setFont(doc, assets.fontFamily, 10)
    doc.text(rtlText(doc, 'سري - Chessboard'), width - 24, height - 14, { align: 'right' })
    doc.text(generatedAtText, 24, height - 14, { align: 'left' })
  }
}

export async function generateMysteryShopperPdf({
  shoppers,
  visits,
  issues,
  evaluationCriteria,
  showPointsSection = true,
  generatedAt = new Date(),
}) {
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'pt',
    format: 'a4',
  })

  const width = doc.internal.pageSize.getWidth()
  const height = doc.internal.pageSize.getHeight()
  const generatedAtText = formatArabicDate(generatedAt)
  const brandAssets = await loadReportBrandingAssets(doc)
  setFont(doc, brandAssets.fontFamily, 12)

  const completedVisits = visits.filter((visit) => visit.status === 'مكتملة')
  const pendingVisits = visits.filter((visit) => visit.status === 'معلقة')
  const upcomingVisits = visits.filter((visit) => visit.status === 'قادمة')

  const averageRating = completedVisits.length
    ? completedVisits.reduce(
        (sum, visit) => sum + calculateWeightedScore(visit.scores ?? {}),
        0,
      ) / completedVisits.length
    : 0

  const issueSummary = {
    simple: issues.filter((issue) => issue.severity === 'بسيطة').length,
    medium: issues.filter((issue) => issue.severity === 'متوسطة').length,
    critical: issues.filter((issue) => issue.severity === 'خطيرة').length,
  }

  const totalDistributedPoints = shoppers.reduce(
    (sum, shopper) => sum + Number(shopper.points ?? 0),
    0,
  )

  const shopperRows = shoppers.map((shopper) => {
    const shopperVisits = visits.filter((visit) => visit.assignedShopperId === shopper.id)
    const shopperCompleted = shopperVisits.filter((visit) => visit.status === 'مكتملة')

    const avgScore = shopperCompleted.length
      ? shopperCompleted.reduce(
          (sum, visit) => sum + calculateWeightedScore(visit.scores ?? {}),
          0,
        ) / shopperCompleted.length
      : 0

    return {
      name: shopper.name,
      city: shopper.city,
      visitsCount: shopperVisits.length,
      avgScore,
      points: Number(shopper.points ?? 0),
      status: shopper.status,
    }
  })

  const criteriaRows = evaluationCriteria.map((criterion) => {
    const average = completedVisits.length
      ? completedVisits.reduce(
          (sum, visit) => sum + Number(visit.scores?.[criterion.key] ?? 0),
          0,
        ) / completedVisits.length
      : 0

    return {
      label: criterion.label,
      average,
      level: qualityLabel(average),
    }
  })

  const noDataRow = (columnsCount) => {
    if (columnsCount <= 0) return []
    return [
      rtlText(doc, 'لا توجد بيانات متاحة'),
      ...Array.from({ length: columnsCount - 1 }, () => '-'),
    ]
  }

  const tableStyles = {
    font: brandAssets.fontFamily,
    fontStyle: 'normal',
    halign: 'right',
    valign: 'middle',
    fontSize: 10,
    textColor: [30, 41, 59],
    cellPadding: 6,
    overflow: 'linebreak',
  }

  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, width, height, 'F')

  drawPdfReportHeader(doc, brandAssets, { pageWidth: width, y: 0, withBackground: true })

  setTextColor(doc, TEXT_DARK)
  setFont(doc, brandAssets.fontFamily, 28)
  doc.text(rtlText(doc, 'تقرير برنامج المتحري الخفي'), width - 40, 170, { align: 'right' })

  setFont(doc, brandAssets.fontFamily, 14)
  setTextColor(doc, TEXT_MUTED)
  doc.text(rtlText(doc, 'تقرير متابعة أداء الزيارات والمتسوقين'), width - 40, 205, {
    align: 'right',
  })

  setFont(doc, brandAssets.fontFamily, 12)
  doc.text(rtlText(doc, `تاريخ الإنشاء: ${generatedAtText}`), width - 40, 235, {
    align: 'right',
  })

  doc.setFillColor(254, 242, 242)
  doc.setDrawColor(244, 63, 94)
  doc.roundedRect(width - 300, 265, 260, 30, 15, 15, 'FD')
  doc.setTextColor(190, 24, 93)
  setFont(doc, brandAssets.fontFamily, 12)
  doc.text(rtlText(doc, 'سري - محمي باتفاقية عدم الإفصاح'), width - 170, 285, {
    align: 'center',
  })

  doc.addPage()

  setFont(doc, brandAssets.fontFamily, 22)
  setTextColor(doc, TEXT_DARK)
  doc.text(rtlText(doc, 'ملخص المؤشرات'), width - 40, SUBPAGE_TITLE_Y, { align: 'right' })

  const summaryRows = [
    [rtlText(doc, 'إجمالي الزيارات'), String(visits.length)],
    [rtlText(doc, 'الزيارات المكتملة'), String(completedVisits.length)],
    [rtlText(doc, 'الزيارات الجديدة'), String(pendingVisits.length)],
    [rtlText(doc, 'إعادة الزيارة'), String(upcomingVisits.length)],
    [rtlText(doc, 'متوسط التقييم'), `${averageRating.toFixed(2)} / 5`],
    [rtlText(doc, 'إجمالي التحديات'), String(issues.length)],
    [rtlText(doc, 'تحديات بسيطة'), String(issueSummary.simple)],
    [rtlText(doc, 'تحديات متوسطة'), String(issueSummary.medium)],
    [rtlText(doc, 'تحديات خطيرة'), String(issueSummary.critical)],
  ]

  if (showPointsSection) {
    summaryRows.push([rtlText(doc, 'إجمالي النقاط الموزعة'), String(totalDistributedPoints)])
  }

  autoTable(doc, {
    startY: SUBPAGE_TABLE_START_Y,
    head: [[rtlText(doc, 'المؤشر'), rtlText(doc, 'القيمة')]],
    body: summaryRows,
    theme: 'grid',
    styles: { ...tableStyles, fontSize: 11, cellPadding: 7 },
    headStyles: {
      fillColor: PRIMARY,
      textColor: [255, 255, 255],
      font: brandAssets.fontFamily,
      fontStyle: 'normal',
      halign: 'right',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 40, right: 40 },
  })

  doc.addPage()

  setFont(doc, brandAssets.fontFamily, 22)
  setTextColor(doc, TEXT_DARK)
  doc.text(rtlText(doc, 'جدول الزيارات'), width - 40, SUBPAGE_TITLE_Y, { align: 'right' })

  const visitsRows = visits.map((visit) => {
    const shopper = shoppers.find((item) => item.id === visit.assignedShopperId)
    const row = [
      rtlText(doc, visit.officeName),
      rtlText(doc, visit.city),
      rtlText(doc, visit.date),
      rtlText(doc, shopper?.name ?? '-'),
      calculateWeightedScore(visit.scores ?? {}).toFixed(2),
      rtlText(doc, visit.status),
    ]

    if (showPointsSection) {
      row.push(String(Number(visit.pointsEarned ?? 0)))
    }

    return row
  })

  const visitsHead = [
    rtlText(doc, 'الفرع'),
    rtlText(doc, 'المدينة'),
    rtlText(doc, 'التاريخ'),
    rtlText(doc, 'المتسوق'),
    rtlText(doc, 'التقييم'),
    rtlText(doc, 'الحالة'),
  ]

  if (showPointsSection) {
    visitsHead.push(rtlText(doc, 'النقاط'))
  }

  autoTable(doc, {
    startY: SUBPAGE_TABLE_START_Y,
    head: [visitsHead],
    body: visitsRows.length > 0 ? visitsRows : [noDataRow(visitsHead.length)],
    theme: 'grid',
    styles: { ...tableStyles, fontSize: 9, cellPadding: 5 },
    headStyles: {
      fillColor: PRIMARY,
      textColor: [255, 255, 255],
      font: brandAssets.fontFamily,
      fontStyle: 'normal',
      halign: 'right',
      fontSize: 9,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 30, right: 30 },
  })

  doc.addPage()

  setFont(doc, brandAssets.fontFamily, 22)
  setTextColor(doc, TEXT_DARK)
  doc.text(rtlText(doc, 'جدول المتسوقين'), width - 40, SUBPAGE_TITLE_Y, { align: 'right' })

  const shoppersRows = shopperRows.map((row) => {
    const shopperRow = [
      rtlText(doc, row.name),
      rtlText(doc, row.city),
      String(row.visitsCount),
      row.avgScore.toFixed(2),
    ]

    if (showPointsSection) {
      shopperRow.push(String(row.points))
    }

    shopperRow.push(rtlText(doc, row.status))

    return shopperRow
  })

  const shoppersHead = [
    rtlText(doc, 'المتسوق'),
    rtlText(doc, 'المدينة'),
    rtlText(doc, 'الزيارات'),
    rtlText(doc, 'متوسط التقييم'),
  ]

  if (showPointsSection) {
    shoppersHead.push(rtlText(doc, 'النقاط'))
  }

  shoppersHead.push(rtlText(doc, 'الحالة'))

  autoTable(doc, {
    startY: SUBPAGE_TABLE_START_Y,
    head: [shoppersHead],
    body: shoppersRows.length > 0 ? shoppersRows : [noDataRow(shoppersHead.length)],
    theme: 'grid',
    styles: { ...tableStyles, fontSize: 10, cellPadding: 6 },
    headStyles: {
      fillColor: PRIMARY,
      textColor: [255, 255, 255],
      font: brandAssets.fontFamily,
      fontStyle: 'normal',
      halign: 'right',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 40, right: 40 },
  })

  doc.addPage()

  setFont(doc, brandAssets.fontFamily, 22)
  setTextColor(doc, TEXT_DARK)
  doc.text(rtlText(doc, 'متوسط درجات المعايير'), width - 40, SUBPAGE_TITLE_Y, {
    align: 'right',
  })

  const criteriaTableRows = criteriaRows.map((row) => [
    rtlText(doc, row.label),
    `${row.average.toFixed(2)} / 5`,
    rtlText(doc, row.level),
  ])

  autoTable(doc, {
    startY: SUBPAGE_TABLE_START_Y,
    head: [[rtlText(doc, 'المعيار'), rtlText(doc, 'متوسط الدرجة'), rtlText(doc, 'مؤشر الجودة')]],
    body: criteriaTableRows.length > 0 ? criteriaTableRows : [noDataRow(3)],
    theme: 'grid',
    styles: { ...tableStyles, fontSize: 11, cellPadding: 7 },
    headStyles: {
      fillColor: PRIMARY,
      textColor: [255, 255, 255],
      font: brandAssets.fontFamily,
      fontStyle: 'normal',
      halign: 'right',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (hookData) => {
      if (hookData.section !== 'body' || hookData.column.index !== 2) return

      const score = criteriaRows[hookData.row.index]?.average ?? 0
      const color = qualityColor(score)
      hookData.cell.styles.fillColor = color
      hookData.cell.styles.textColor = [255, 255, 255]
      hookData.cell.styles.fontStyle = 'normal'
      hookData.cell.styles.halign = 'center'
      hookData.cell.text = [rtlText(doc, hookData.cell.text?.[0] ?? '')]
    },
    margin: { left: 40, right: 40 },
  })

  addPageHeaderFooter(doc, generatedAtText, brandAssets)

  const exportDate = formatExportDate(generatedAt)
  const fileName = `NHC-Mystery-Shopper-Report-${exportDate}.pdf`
  doc.save(fileName)
}
