import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { calculateWeightedScore } from './scoring'

const PURPLE = [124, 58, 237]

function formatArabicDate(value = new Date()) {
  return new Intl.DateTimeFormat('ar-SA', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(value)
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

function addPageHeaderFooter(doc, generatedAtText) {
  const totalPages = doc.getNumberOfPages()
  const width = doc.internal.pageSize.getWidth()
  const height = doc.internal.pageSize.getHeight()

  doc.setR2L(true)

  for (let pageIndex = 1; pageIndex <= totalPages; pageIndex += 1) {
    doc.setPage(pageIndex)

    doc.setFillColor(...PURPLE)
    doc.rect(0, 0, width, 30, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.text('NHC — برنامج المتحري الخفي', width - 24, 20, { align: 'right' })
    doc.text(`صفحة ${pageIndex} من ${totalPages}`, 24, 20, { align: 'left' })

    doc.setTextColor(71, 85, 105)
    doc.setFontSize(10)
    doc.text('سري — Chessboard', width - 24, height - 14, { align: 'right' })
    doc.text(generatedAtText, 24, height - 14, { align: 'left' })
  }
}

export function generateMysteryShopperPdf({
  shoppers,
  visits,
  issues,
  evaluationCriteria,
  generatedAt = new Date(),
}) {
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'pt',
    format: 'a4',
  })

  doc.setR2L(true)

  const width = doc.internal.pageSize.getWidth()
  const generatedAtText = formatArabicDate(generatedAt)

  const completedVisits = visits.filter((visit) => visit.status === 'مكتملة')
  const pendingVisits = visits.filter((visit) => visit.status === 'معلقة')
  const upcomingVisits = visits.filter((visit) => visit.status === 'قادمة')

  const averageRating = completedVisits.length
    ? completedVisits.reduce(
        (sum, visit) => sum + calculateWeightedScore(visit.scores),
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
          (sum, visit) => sum + calculateWeightedScore(visit.scores),
          0,
        ) / shopperCompleted.length
      : 0

    return {
      name: shopper.name,
      city: shopper.city,
      visitsCount: shopperVisits.length,
      avgScore,
      points: shopper.points,
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

  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, width, doc.internal.pageSize.getHeight(), 'F')

  doc.setDrawColor(...PURPLE)
  doc.setFillColor(243, 232, 255)
  doc.roundedRect(width - 170, 52, 130, 58, 8, 8, 'FD')
  doc.setTextColor(...PURPLE)
  doc.setFontSize(24)
  doc.text('NHC', width - 105, 88, { align: 'center' })

  doc.setTextColor(15, 23, 42)
  doc.setFontSize(28)
  doc.text('تقرير برنامج المتحري الخفي', width - 40, 170, { align: 'right' })

  doc.setFontSize(14)
  doc.setTextColor(71, 85, 105)
  doc.text('National Housing Company — Chessboard', width - 40, 205, {
    align: 'right',
  })

  doc.setFontSize(12)
  doc.text(`تاريخ الإنشاء: ${generatedAtText}`, width - 40, 240, { align: 'right' })

  doc.setFillColor(254, 242, 242)
  doc.setDrawColor(244, 63, 94)
  doc.roundedRect(width - 300, 270, 260, 30, 15, 15, 'FD')
  doc.setTextColor(190, 24, 93)
  doc.setFontSize(12)
  doc.text('سري — محمي باتفاقية عدم الإفصاح', width - 170, 290, { align: 'center' })

  doc.addPage()

  doc.setFontSize(22)
  doc.setTextColor(15, 23, 42)
  doc.text('ملخص المؤشرات', width - 40, 70, { align: 'right' })

  const summaryRows = [
    ['إجمالي الزيارات', visits.length],
    ['الزيارات المكتملة', completedVisits.length],
    ['الزيارات المعلقة', pendingVisits.length],
    ['الزيارات القادمة', upcomingVisits.length],
    ['متوسط التقييم', `${averageRating.toFixed(2)} / 5`],
    ['إجمالي المشاكل', issues.length],
    ['مشاكل بسيطة', issueSummary.simple],
    ['مشاكل متوسطة', issueSummary.medium],
    ['مشاكل خطيرة', issueSummary.critical],
    ['إجمالي النقاط الموزعة', totalDistributedPoints],
  ]

  autoTable(doc, {
    startY: 95,
    head: [['المؤشر', 'القيمة']],
    body: summaryRows,
    theme: 'grid',
    styles: {
      halign: 'right',
      fontSize: 11,
      textColor: [30, 41, 59],
      cellPadding: 7,
    },
    headStyles: {
      fillColor: PURPLE,
      textColor: [255, 255, 255],
      halign: 'right',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 40, right: 40 },
  })

  doc.addPage()

  doc.setFontSize(22)
  doc.setTextColor(15, 23, 42)
  doc.text('جدول الزيارات', width - 40, 70, { align: 'right' })

  autoTable(doc, {
    startY: 95,
    head: [['المنشأة', 'المدينة', 'التاريخ', 'المتسوق', 'التقييم', 'الحالة', 'النقاط']],
    body: visits.map((visit) => {
      const shopper = shoppers.find((item) => item.id === visit.assignedShopperId)
      return [
        visit.officeName,
        visit.city,
        visit.date,
        shopper?.name ?? '-',
        calculateWeightedScore(visit.scores).toFixed(2),
        visit.status,
        Number(visit.pointsEarned ?? 0),
      ]
    }),
    theme: 'grid',
    styles: {
      halign: 'right',
      fontSize: 9,
      textColor: [30, 41, 59],
      cellPadding: 5,
    },
    headStyles: {
      fillColor: PURPLE,
      textColor: [255, 255, 255],
      halign: 'right',
      fontSize: 9,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 30, right: 30 },
  })

  doc.addPage()

  doc.setFontSize(22)
  doc.setTextColor(15, 23, 42)
  doc.text('جدول المتسوقين', width - 40, 70, { align: 'right' })

  autoTable(doc, {
    startY: 95,
    head: [['المتسوق', 'المدينة', 'الزيارات', 'متوسط التقييم', 'النقاط', 'الحالة']],
    body: shopperRows.map((row) => [
      row.name,
      row.city,
      row.visitsCount,
      row.avgScore.toFixed(2),
      row.points,
      row.status,
    ]),
    theme: 'grid',
    styles: {
      halign: 'right',
      fontSize: 10,
      textColor: [30, 41, 59],
      cellPadding: 6,
    },
    headStyles: {
      fillColor: PURPLE,
      textColor: [255, 255, 255],
      halign: 'right',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 40, right: 40 },
  })

  doc.addPage()

  doc.setFontSize(22)
  doc.setTextColor(15, 23, 42)
  doc.text('متوسط درجات المعايير', width - 40, 70, { align: 'right' })

  autoTable(doc, {
    startY: 95,
    head: [['المعيار', 'متوسط الدرجة', 'مؤشر الجودة']],
    body: criteriaRows.map((row) => [
      row.label,
      `${row.average.toFixed(2)} / 5`,
      row.level,
    ]),
    theme: 'grid',
    styles: {
      halign: 'right',
      fontSize: 11,
      textColor: [30, 41, 59],
      cellPadding: 7,
    },
    headStyles: {
      fillColor: PURPLE,
      textColor: [255, 255, 255],
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
      hookData.cell.styles.fontStyle = 'bold'
      hookData.cell.styles.halign = 'center'
    },
    margin: { left: 40, right: 40 },
  })

  addPageHeaderFooter(doc, generatedAtText)

  const exportDate = new Intl.DateTimeFormat('en-CA').format(generatedAt)
  const fileName = `NHC-Mystery-Shopper-Report-${exportDate}.pdf`
  doc.save(fileName)
}
