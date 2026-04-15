import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { buildVisitAnalytics } from './visitAnalytics'

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
    // Keep PDF generation running even if branding image decode fails.
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

function parseHexColor(hex, fallback = [15, 23, 42]) {
  if (typeof hex !== 'string' || !hex.startsWith('#')) return fallback

  const normalized = hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex

  if (!/^#[0-9a-f]{6}$/i.test(normalized)) return fallback

  return [
    Number.parseInt(normalized.slice(1, 3), 16),
    Number.parseInt(normalized.slice(3, 5), 16),
    Number.parseInt(normalized.slice(5, 7), 16),
  ]
}

function clampRatio(value) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function shortLabel(value, maxLength = 9) {
  const text = String(value ?? '').trim()
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}…`
}

function drawNoData(doc, { x, y, width, height, fontFamily, message = 'لا توجد بيانات كافية لعرض الرسم.' }) {
  setFont(doc, fontFamily, 10)
  setTextColor(doc, TEXT_MUTED)
  doc.text(rtlText(doc, message), x + width / 2, y + height / 2, { align: 'center' })
}

function drawKpiCard(doc, { x, y, width, height, fontFamily, title, value, subtitle, tone }) {
  const cardTone = tone ?? {
    bg: [248, 250, 252],
    border: [203, 213, 225],
    accent: [15, 23, 42],
  }

  doc.setFillColor(...cardTone.bg)
  doc.setDrawColor(...cardTone.border)
  doc.setLineWidth(1)
  doc.roundedRect(x, y, width, height, 12, 12, 'FD')

  setFont(doc, fontFamily, 10)
  setTextColor(doc, TEXT_MUTED)
  doc.text(rtlText(doc, title), x + width - 12, y + 18, { align: 'right' })

  setFont(doc, fontFamily, 21)
  setTextColor(doc, cardTone.accent)
  doc.text(rtlText(doc, value), x + width - 12, y + 42, { align: 'right' })

  setFont(doc, fontFamily, 9)
  setTextColor(doc, TEXT_MUTED)
  doc.text(rtlText(doc, subtitle), x + width - 12, y + 61, { align: 'right' })
}

function drawPanelContainer(doc, { x, y, width, height, fontFamily, title, subtitle }) {
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(1)
  doc.roundedRect(x, y, width, height, 12, 12, 'FD')

  setFont(doc, fontFamily, 12)
  setTextColor(doc, TEXT_DARK)
  doc.text(rtlText(doc, title), x + width - 12, y + 18, { align: 'right' })

  if (subtitle) {
    setFont(doc, fontFamily, 9)
    setTextColor(doc, TEXT_MUTED)
    doc.text(rtlText(doc, subtitle), x + width - 12, y + 32, { align: 'right' })
  }

  return {
    x: x + 12,
    y: y + 42,
    width: width - 24,
    height: height - 54,
  }
}

function drawLineChart(doc, { x, y, width, height, fontFamily, data, labelKey, valueKey, color, maxValue = 5 }) {
  if (!Array.isArray(data) || data.length === 0) {
    drawNoData(doc, { x, y, width, height, fontFamily })
    return
  }

  const leftPadding = 30
  const rightPadding = 10
  const topPadding = 10
  const bottomPadding = 24

  const plotX = x + leftPadding
  const plotY = y + topPadding
  const plotWidth = width - leftPadding - rightPadding
  const plotHeight = height - topPadding - bottomPadding
  const plotBottom = plotY + plotHeight

  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.6)
  for (let row = 0; row <= 4; row += 1) {
    const lineY = plotY + (row / 4) * plotHeight
    doc.line(plotX, lineY, plotX + plotWidth, lineY)
  }

  const safeMax = Math.max(1, Number(maxValue) || 1)
  const stepX = data.length > 1 ? plotWidth / (data.length - 1) : 0
  const rgb = parseHexColor(color, [15, 118, 110])

  const points = data.map((item, index) => {
    const rawValue = Number(item[valueKey] ?? 0)
    const ratio = clampRatio(rawValue / safeMax)
    return {
      x: plotX + stepX * index,
      y: plotBottom - ratio * plotHeight,
      label: String(item[labelKey] ?? ''),
      value: rawValue,
    }
  })

  doc.setDrawColor(...rgb)
  doc.setLineWidth(2)
  for (let index = 1; index < points.length; index += 1) {
    doc.line(points[index - 1].x, points[index - 1].y, points[index].x, points[index].y)
  }

  doc.setFillColor(...rgb)
  points.forEach((point) => {
    doc.circle(point.x, point.y, 2.5, 'F')
  })

  setFont(doc, fontFamily, 8)
  setTextColor(doc, TEXT_MUTED)
  points.forEach((point) => {
    doc.text(rtlText(doc, shortLabel(point.label, 6)), point.x, plotBottom + 14, { align: 'center' })
  })
}

function drawVerticalBarChart(doc, { x, y, width, height, fontFamily, data, labelKey, valueKey, color }) {
  if (!Array.isArray(data) || data.length === 0) {
    drawNoData(doc, { x, y, width, height, fontFamily })
    return
  }

  const leftPadding = 26
  const rightPadding = 8
  const topPadding = 8
  const bottomPadding = 28

  const plotX = x + leftPadding
  const plotY = y + topPadding
  const plotWidth = width - leftPadding - rightPadding
  const plotHeight = height - topPadding - bottomPadding
  const plotBottom = plotY + plotHeight

  const maxValue = Math.max(1, ...data.map((item) => Number(item[valueKey] ?? 0)))

  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.6)
  for (let row = 0; row <= 4; row += 1) {
    const lineY = plotY + (row / 4) * plotHeight
    doc.line(plotX, lineY, plotX + plotWidth, lineY)
  }

  const barGap = 7
  const baseBarWidth = (plotWidth - barGap * (data.length - 1)) / data.length
  const barWidth = Math.max(8, Math.min(28, baseBarWidth))
  const totalBarsWidth = barWidth * data.length + barGap * (data.length - 1)
  const startX = plotX + (plotWidth - totalBarsWidth) / 2
  const rgb = parseHexColor(color, [15, 118, 110])

  data.forEach((item, index) => {
    const rawValue = Number(item[valueKey] ?? 0)
    const ratio = clampRatio(rawValue / maxValue)
    const barHeight = ratio * plotHeight
    const barX = startX + index * (barWidth + barGap)
    const barY = plotBottom - barHeight

    doc.setFillColor(...rgb)
    doc.roundedRect(barX, barY, barWidth, barHeight, 3, 3, 'F')

    setFont(doc, fontFamily, 8)
    setTextColor(doc, TEXT_MUTED)
    doc.text(rtlText(doc, shortLabel(item[labelKey], 6)), barX + barWidth / 2, plotBottom + 14, {
      align: 'center',
    })
  })
}

function drawHorizontalBarChart(doc, { x, y, width, height, fontFamily, data, labelKey, valueKey, maxValue, color }) {
  if (!Array.isArray(data) || data.length === 0) {
    drawNoData(doc, { x, y, width, height, fontFamily })
    return
  }

  const leftLabelWidth = 86
  const rightValueWidth = 42
  const barX = x + leftLabelWidth
  const barWidth = width - leftLabelWidth - rightValueWidth - 4
  const rowHeight = height / data.length
  const safeMax = Math.max(1, Number(maxValue) || 1)
  const rgb = parseHexColor(color, [15, 118, 110])

  data.forEach((item, index) => {
    const centerY = y + rowHeight * index + rowHeight / 2
    const trackY = centerY - 5
    const rawValue = Number(item[valueKey] ?? 0)
    const ratio = clampRatio(rawValue / safeMax)

    doc.setFillColor(241, 245, 249)
    doc.roundedRect(barX, trackY, barWidth, 10, 5, 5, 'F')

    doc.setFillColor(...rgb)
    doc.roundedRect(barX, trackY, barWidth * ratio, 10, 5, 5, 'F')

    setFont(doc, fontFamily, 8)
    setTextColor(doc, TEXT_DARK)
    doc.text(rtlText(doc, shortLabel(item[labelKey], 10)), barX - 4, centerY + 3, { align: 'right' })

    setTextColor(doc, TEXT_MUTED)
    doc.text(String(rawValue.toFixed(2)), barX + barWidth + 4, centerY + 3, { align: 'left' })
  })
}

function drawShareBars(doc, { x, y, width, height, fontFamily, data }) {
  if (!Array.isArray(data) || data.length === 0) {
    drawNoData(doc, { x, y, width, height, fontFamily })
    return
  }

  const total = data.reduce((sum, item) => sum + Number(item.value ?? 0), 0)
  const leftLabelWidth = 94
  const rightValueWidth = 54
  const rowHeight = height / data.length
  const barX = x + leftLabelWidth
  const barWidth = width - leftLabelWidth - rightValueWidth - 6

  data.forEach((item, index) => {
    const value = Number(item.value ?? 0)
    const percent = total ? Math.round((value / total) * 100) : 0
    const centerY = y + rowHeight * index + rowHeight / 2
    const trackY = centerY - 5
    const rgb = parseHexColor(item.color, [15, 118, 110])

    doc.setFillColor(241, 245, 249)
    doc.roundedRect(barX, trackY, barWidth, 10, 5, 5, 'F')

    doc.setFillColor(...rgb)
    doc.roundedRect(barX, trackY, barWidth * clampRatio(percent / 100), 10, 5, 5, 'F')

    setFont(doc, fontFamily, 8)
    setTextColor(doc, TEXT_DARK)
    doc.text(rtlText(doc, shortLabel(item.name, 10)), barX - 4, centerY + 3, { align: 'right' })

    setTextColor(doc, TEXT_MUTED)
    doc.text(`${percent}%`, barX + barWidth + 4, centerY + 3, { align: 'left' })
  })
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

function noDataRow(doc, columnsCount) {
  if (columnsCount <= 0) return []

  return [
    rtlText(doc, 'لا توجد بيانات متاحة'),
    ...Array.from({ length: columnsCount - 1 }, () => '-'),
  ]
}

function addPageHeaderFooter(doc, generatedAtText, assets) {
  const totalPages = doc.getNumberOfPages()

  for (let pageIndex = 1; pageIndex <= totalPages; pageIndex += 1) {
    doc.setPage(pageIndex)

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    drawPdfReportHeader(doc, assets, { pageWidth, y: 0, withBackground: true })

    setTextColor(doc, [255, 255, 255])
    setFont(doc, assets.fontFamily, 10)
    doc.text(rtlText(doc, `صفحة ${pageIndex} من ${totalPages}`), pageWidth / 2, 26, {
      align: 'center',
    })

    setTextColor(doc, TEXT_MUTED)
    setFont(doc, assets.fontFamily, 10)
    doc.text(rtlText(doc, 'سري - Chessboard'), pageWidth - 24, pageHeight - 14, {
      align: 'right',
    })
    doc.text(generatedAtText, 24, pageHeight - 14, { align: 'left' })
  }
}

function addDashboardPage(doc, { assets, fontFamily, analytics, showPointsSection, totalVisitPoints }) {
  doc.addPage('a4', 'l')

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, pageWidth, pageHeight, 'F')

  drawPdfReportHeader(doc, assets, { pageWidth, y: 0, withBackground: true })

  setFont(doc, fontFamily, 20)
  setTextColor(doc, TEXT_DARK)
  doc.text(rtlText(doc, 'لوحة ذكاء الأعمال للزيارات'), pageWidth - 24, 108, { align: 'right' })

  setFont(doc, fontFamily, 10)
  setTextColor(doc, TEXT_MUTED)
  doc.text(rtlText(doc, 'نفس مؤشرات النظام مع عرض بصري مشابه Power BI'), pageWidth - 24, 124, {
    align: 'right',
  })

  if (showPointsSection) {
    doc.setFillColor(254, 249, 195)
    doc.setDrawColor(253, 224, 71)
    doc.roundedRect(24, 92, 180, 24, 12, 12, 'FD')

    setFont(doc, fontFamily, 9)
    setTextColor(doc, [146, 64, 14])
    doc.text(rtlText(doc, `إجمالي نقاط الزيارات: ${totalVisitPoints}`), 114, 108, {
      align: 'center',
    })
  }

  const contentX = 20
  const contentWidth = pageWidth - 40
  const cardsY = 134
  const cardHeight = 74
  const cardGap = 10
  const cardWidth = (contentWidth - cardGap * 3) / 4

  const kpiCards = [
    {
      title: 'إجمالي الزيارات',
      value: String(analytics.statusCounts.total),
      subtitle: `زيارات قادمة: ${analytics.statusCounts.upcoming}`,
      tone: {
        bg: [238, 242, 255],
        border: [199, 210, 254],
        accent: [67, 56, 202],
      },
    },
    {
      title: 'الزيارات المكتملة',
      value: String(analytics.statusCounts.completed),
      subtitle: `طلبات المسح: ${analytics.statusCounts.deleting}`,
      tone: {
        bg: [236, 253, 245],
        border: [167, 243, 208],
        accent: [5, 150, 105],
      },
    },
    {
      title: 'معدل الإنجاز',
      value: `${analytics.completionRate}%`,
      subtitle: `تحديات موثقة: ${analytics.issueSummary.total}`,
      tone: {
        bg: [239, 246, 255],
        border: [186, 230, 253],
        accent: [2, 132, 199],
      },
    },
    {
      title: 'متوسط الأداء',
      value: `${analytics.averageScore.toFixed(2)} / 5`,
      subtitle: `خطيرة: ${analytics.issueSummary.critical}`,
      tone: {
        bg: [254, 242, 242],
        border: [254, 205, 211],
        accent: [225, 29, 72],
      },
    },
  ]

  kpiCards.forEach((card, index) => {
    drawKpiCard(doc, {
      x: contentX + index * (cardWidth + cardGap),
      y: cardsY,
      width: cardWidth,
      height: cardHeight,
      fontFamily,
      title: card.title,
      value: card.value,
      subtitle: card.subtitle,
      tone: card.tone,
    })
  })

  const chartsY = cardsY + cardHeight + 12
  const chartGap = 10
  const chartWidth = (contentWidth - chartGap) / 2
  const chartHeight = 160

  const panelShare = drawPanelContainer(doc, {
    x: contentX,
    y: chartsY,
    width: chartWidth,
    height: chartHeight,
    fontFamily,
    title: 'الأداء حسب المنطقة',
    subtitle: 'نسبة الزيارات بين المدن',
  })

  drawShareBars(doc, {
    ...panelShare,
    fontFamily,
    data: analytics.cityShare.slice(0, 6),
  })

  const panelLine = drawPanelContainer(doc, {
    x: contentX + chartWidth + chartGap,
    y: chartsY,
    width: chartWidth,
    height: chartHeight,
    fontFamily,
    title: 'الأداء الشهري',
    subtitle: 'متوسط التقييم خلال آخر 6 أشهر',
  })

  drawLineChart(doc, {
    ...panelLine,
    fontFamily,
    data: analytics.performanceTrend,
    labelKey: 'month',
    valueKey: 'averageScore',
    color: '#0f766e',
    maxValue: 5,
  })

  const secondRowY = chartsY + chartHeight + 10

  const panelRegionScore = drawPanelContainer(doc, {
    x: contentX,
    y: secondRowY,
    width: chartWidth,
    height: chartHeight,
    fontFamily,
    title: 'التقييم حسب المنطقة',
    subtitle: 'أفضل المدن بناءً على متوسط التقييم',
  })

  drawHorizontalBarChart(doc, {
    ...panelRegionScore,
    fontFamily,
    data: analytics.cityRatingBars.slice(0, 6),
    labelKey: 'city',
    valueKey: 'average',
    maxValue: 5,
    color: '#0f766e',
  })

  const panelVolume = drawPanelContainer(doc, {
    x: contentX + chartWidth + chartGap,
    y: secondRowY,
    width: chartWidth,
    height: chartHeight,
    fontFamily,
    title: 'عدد الزيارات',
    subtitle: 'حجم الزيارات خلال آخر 6 أشهر',
  })

  drawVerticalBarChart(doc, {
    ...panelVolume,
    fontFamily,
    data: analytics.volumeTrend,
    labelKey: 'month',
    valueKey: 'visits',
    color: '#0f766e',
  })
}

export async function generateMysteryShopperPdf({
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

  const generatedAtText = formatArabicDate(generatedAt)
  const assets = await loadReportBrandingAssets(doc)
  const fontFamily = assets.fontFamily
  setFont(doc, fontFamily, 12)

  const analytics = buildVisitAnalytics({ visits, issues, evaluationCriteria })
  const totalVisitPoints = analytics.visitRows.reduce((sum, row) => {
    return sum + Number(row.pointsEarned ?? 0)
  }, 0)

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, pageWidth, pageHeight, 'F')

  drawPdfReportHeader(doc, assets, { pageWidth, y: 0, withBackground: true })

  setFont(doc, fontFamily, 28)
  setTextColor(doc, TEXT_DARK)
  doc.text(rtlText(doc, 'تقرير برنامج المتسوق السري'), pageWidth - 40, 170, { align: 'right' })

  setFont(doc, fontFamily, 14)
  setTextColor(doc, TEXT_MUTED)
  doc.text(rtlText(doc, 'تقرير تحليلي بصري للزيارات الميدانية'), pageWidth - 40, 205, {
    align: 'right',
  })

  setFont(doc, fontFamily, 12)
  doc.text(rtlText(doc, `تاريخ الإنشاء: ${generatedAtText}`), pageWidth - 40, 235, {
    align: 'right',
  })

  doc.setFillColor(254, 242, 242)
  doc.setDrawColor(244, 63, 94)
  doc.roundedRect(pageWidth - 310, 265, 270, 30, 15, 15, 'FD')
  doc.setTextColor(190, 24, 93)
  setFont(doc, fontFamily, 12)
  doc.text(rtlText(doc, 'سري - محمي باتفاقية عدم الإفصاح'), pageWidth - 175, 285, {
    align: 'center',
  })

  addDashboardPage(doc, {
    assets,
    fontFamily,
    analytics,
    showPointsSection,
    totalVisitPoints,
  })

  doc.addPage('a4', 'p')

  setFont(doc, fontFamily, 22)
  setTextColor(doc, TEXT_DARK)
  doc.text(rtlText(doc, 'ملخص رقمي للزيارات'), pageWidth - 40, SUBPAGE_TITLE_Y, { align: 'right' })

  const bestVolumeCity = analytics.cityPerformance[0]?.city ?? '-'
  const bestScoreCity = [...analytics.cityPerformance]
    .filter((row) => row.completed > 0)
    .sort((first, second) => second.average - first.average)[0]?.city ?? '-'

  const summaryRows = [
    [rtlText(doc, 'إجمالي الزيارات'), String(analytics.statusCounts.total)],
    [rtlText(doc, 'الزيارات المكتملة'), String(analytics.statusCounts.completed)],
    [rtlText(doc, 'الزيارات الجديدة'), String(analytics.statusCounts.pending)],
    [rtlText(doc, 'إعادة الزيارة'), String(analytics.statusCounts.upcoming)],
    [rtlText(doc, 'طلبات المسح'), String(analytics.statusCounts.deleting)],
    [rtlText(doc, 'معدل الإنجاز'), `${analytics.completionRate}%`],
    [rtlText(doc, 'متوسط الأداء'), `${analytics.averageScore.toFixed(2)} / 5`],
    [rtlText(doc, 'إجمالي التحديات'), String(analytics.issueSummary.total)],
    [rtlText(doc, 'بسيطة / متوسطة / خطيرة'), `${analytics.issueSummary.simple} / ${analytics.issueSummary.medium} / ${analytics.issueSummary.critical}`],
    [rtlText(doc, 'الأكثر نشاطاً'), rtlText(doc, bestVolumeCity)],
    [rtlText(doc, 'الأعلى تقييماً'), rtlText(doc, bestScoreCity)],
  ]

  if (showPointsSection) {
    summaryRows.push([rtlText(doc, 'إجمالي نقاط الزيارات'), String(totalVisitPoints)])
  }

  const tableStyles = {
    font: fontFamily,
    fontStyle: 'normal',
    halign: 'right',
    valign: 'middle',
    fontSize: 10,
    textColor: [30, 41, 59],
    cellPadding: 6,
    overflow: 'linebreak',
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
      font: fontFamily,
      fontStyle: 'normal',
      halign: 'right',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 40, right: 40 },
  })

  doc.addPage('a4', 'p')

  setFont(doc, fontFamily, 22)
  setTextColor(doc, TEXT_DARK)
  doc.text(rtlText(doc, 'سجل الزيارات التفصيلي'), pageWidth - 40, SUBPAGE_TITLE_Y, {
    align: 'right',
  })

  const visitsRows = analytics.visitRows.map((visit) => {
    const row = [
      rtlText(doc, visit.officeName),
      rtlText(doc, visit.city),
      rtlText(doc, visit.date),
      rtlText(doc, visit.status),
      `${Number(visit.score ?? 0).toFixed(2)} / 5`,
      String(visit.issuesCount ?? 0),
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
    rtlText(doc, 'الحالة'),
    rtlText(doc, 'التقييم'),
    rtlText(doc, 'التحديات'),
  ]

  if (showPointsSection) {
    visitsHead.push(rtlText(doc, 'النقاط'))
  }

  autoTable(doc, {
    startY: SUBPAGE_TABLE_START_Y,
    head: [visitsHead],
    body: visitsRows.length > 0 ? visitsRows : [noDataRow(doc, visitsHead.length)],
    theme: 'grid',
    styles: { ...tableStyles, fontSize: 9, cellPadding: 5 },
    headStyles: {
      fillColor: PRIMARY,
      textColor: [255, 255, 255],
      font: fontFamily,
      fontStyle: 'normal',
      halign: 'right',
      fontSize: 9,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 30, right: 30 },
  })

  doc.addPage('a4', 'p')

  setFont(doc, fontFamily, 22)
  setTextColor(doc, TEXT_DARK)
  doc.text(rtlText(doc, 'تحليل المناطق'), pageWidth - 40, SUBPAGE_TITLE_Y, { align: 'right' })

  const cityRows = analytics.cityPerformance.map((row) => [
    rtlText(doc, row.city),
    String(row.total),
    String(row.completed),
    `${row.completionRate}%`,
    `${row.average.toFixed(2)} / 5`,
    String(row.issues),
  ])

  autoTable(doc, {
    startY: SUBPAGE_TABLE_START_Y,
    head: [
      [
        rtlText(doc, 'المدينة'),
        rtlText(doc, 'إجمالي الزيارات'),
        rtlText(doc, 'المكتملة'),
        rtlText(doc, 'معدل الإنجاز'),
        rtlText(doc, 'متوسط التقييم'),
        rtlText(doc, 'التحديات'),
      ],
    ],
    body: cityRows.length > 0 ? cityRows : [noDataRow(doc, 6)],
    theme: 'grid',
    styles: { ...tableStyles, fontSize: 10, cellPadding: 6 },
    headStyles: {
      fillColor: PRIMARY,
      textColor: [255, 255, 255],
      font: fontFamily,
      fontStyle: 'normal',
      halign: 'right',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 28, right: 28 },
  })

  doc.addPage('a4', 'p')

  setFont(doc, fontFamily, 22)
  setTextColor(doc, TEXT_DARK)
  doc.text(rtlText(doc, 'سجل التحديات'), pageWidth - 40, SUBPAGE_TITLE_Y, { align: 'right' })

  const issuesRows = analytics.issueRecords.map((issue) => [
    rtlText(doc, issue.severity),
    rtlText(doc, issue.description),
    rtlText(doc, issue.officeName),
    rtlText(doc, issue.city),
    rtlText(doc, issue.date),
  ])

  autoTable(doc, {
    startY: SUBPAGE_TABLE_START_Y,
    head: [
      [
        rtlText(doc, 'الحدة'),
        rtlText(doc, 'الوصف'),
        rtlText(doc, 'الفرع'),
        rtlText(doc, 'المدينة'),
        rtlText(doc, 'التاريخ'),
      ],
    ],
    body: issuesRows.length > 0 ? issuesRows : [noDataRow(doc, 5)],
    theme: 'grid',
    styles: { ...tableStyles, fontSize: 9, cellPadding: 5 },
    headStyles: {
      fillColor: PRIMARY,
      textColor: [255, 255, 255],
      font: fontFamily,
      fontStyle: 'normal',
      halign: 'right',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 28, right: 28 },
    columnStyles: {
      0: { cellWidth: 58 },
      1: { cellWidth: 180 },
      2: { cellWidth: 108 },
      3: { cellWidth: 72 },
      4: { cellWidth: 72 },
    },
  })

  doc.addPage('a4', 'p')

  setFont(doc, fontFamily, 22)
  setTextColor(doc, TEXT_DARK)
  doc.text(rtlText(doc, 'متوسط درجات المعايير'), pageWidth - 40, SUBPAGE_TITLE_Y, {
    align: 'right',
  })

  const criteriaRows = analytics.criteriaPerformance.map((row) => {
    const score = Number(row.average ?? 0)

    return [
      rtlText(doc, row.label),
      `${score.toFixed(2)} / 5`,
      rtlText(doc, qualityLabel(score)),
    ]
  })

  autoTable(doc, {
    startY: SUBPAGE_TABLE_START_Y,
    head: [[rtlText(doc, 'المعيار'), rtlText(doc, 'متوسط الدرجة'), rtlText(doc, 'مؤشر الجودة')]],
    body: criteriaRows.length > 0 ? criteriaRows : [noDataRow(doc, 3)],
    theme: 'grid',
    styles: { ...tableStyles, fontSize: 11, cellPadding: 7 },
    headStyles: {
      fillColor: PRIMARY,
      textColor: [255, 255, 255],
      font: fontFamily,
      fontStyle: 'normal',
      halign: 'right',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (hookData) => {
      if (hookData.section !== 'body' || hookData.column.index !== 2) return

      const score = Number(analytics.criteriaPerformance[hookData.row.index]?.average ?? 0)
      const color = qualityColor(score)
      hookData.cell.styles.fillColor = color
      hookData.cell.styles.textColor = [255, 255, 255]
      hookData.cell.styles.fontStyle = 'normal'
      hookData.cell.styles.halign = 'center'
      hookData.cell.text = [rtlText(doc, hookData.cell.text?.[0] ?? '')]
    },
    margin: { left: 40, right: 40 },
  })

  addPageHeaderFooter(doc, generatedAtText, assets)

  const exportDate = formatExportDate(generatedAt)
  const fileName = `NHC-Visits-Analytics-Report-${exportDate}.pdf`
  doc.save(fileName)
}
