import html2canvas from "html2canvas"
import { jsPDF } from "jspdf"

export async function createFinancialStatementsPdf(container: HTMLElement): Promise<Blob> {
  const pages = Array.from(container.querySelectorAll<HTMLElement>("[data-financial-statement-page]"))
  if (pages.length === 0) throw new Error("لا توجد صفحات جاهزة للتصدير")

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true })
  const pageWidth = 210
  const pageHeight = 297
  const margin = 10
  const usableWidth = pageWidth - margin * 2
  const usableHeight = pageHeight - margin * 2 - 6

  for (let index = 0; index < pages.length; index += 1) {
    if (index > 0) pdf.addPage()
    const page = pages[index]
    if (!page) throw new Error("تعذر تجهيز إحدى صفحات PDF")
    const canvas = await html2canvas(page, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      windowWidth: page.scrollWidth,
    })
    const imageHeight = canvas.height * usableWidth / canvas.width
    if (imageHeight > usableHeight) {
      throw new Error("تجاوز محتوى إحدى القوائم مساحة الصفحة. راجع البيانات قبل التصدير.")
    }
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, margin, usableWidth, imageHeight, undefined, "FAST")
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(8)
    pdf.setTextColor(100)
    pdf.text(`${index + 1} / ${pages.length}`, pageWidth / 2, pageHeight - 5, { align: "center" })
  }
  return pdf.output("blob")
}

export function downloadPdf(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.setTimeout(() => { URL.revokeObjectURL(url) }, 1_000)
}
