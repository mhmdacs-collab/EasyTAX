export async function createInvoicePdf(element: HTMLElement): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ])

  const canvas = await html2canvas(element, {
    backgroundColor: "#ffffff",
    height: element.scrollHeight,
    logging: false,
    scale: 2,
    useCORS: true,
    width: element.scrollWidth,
    windowWidth: Math.max(document.documentElement.clientWidth, element.scrollWidth),
  })

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true })
  const margin = 10
  const usableWidth = 210 - margin * 2
  const usableHeight = 297 - margin * 2
  const pageHeightPixels = Math.floor(canvas.width * usableHeight / usableWidth)
  let sourceY = 0
  let pageIndex = 0

  while (sourceY < canvas.height) {
    const sliceHeight = Math.min(pageHeightPixels, canvas.height - sourceY)
    const pageCanvas = document.createElement("canvas")
    pageCanvas.width = canvas.width
    pageCanvas.height = sliceHeight
    const context = pageCanvas.getContext("2d")
    if (!context) throw new Error("تعذر تجهيز صفحة PDF")
    context.fillStyle = "#ffffff"
    context.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
    context.drawImage(canvas, 0, sourceY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight)
    if (pageIndex > 0) pdf.addPage()
    const renderedHeight = sliceHeight * usableWidth / canvas.width
    pdf.addImage(pageCanvas.toDataURL("image/jpeg", 0.96), "JPEG", margin, margin, usableWidth, renderedHeight, undefined, "FAST")
    sourceY += sliceHeight
    pageIndex += 1
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

export async function sharePdf(blob: Blob, fileName: string, title: string, text: string): Promise<boolean> {
  const file = new File([blob], fileName, { type: "application/pdf" })
  const shareData: ShareData = { files: [file], title, text }
  const share = Reflect.get(navigator, "share") as ((data: ShareData) => Promise<void>) | undefined
  const canShare = Reflect.get(navigator, "canShare") as ((data?: ShareData) => boolean) | undefined
  if (typeof share !== "function" || typeof canShare !== "function" || !canShare.call(navigator, { files: [file] })) return false
  await share.call(navigator, shareData)
  return true
}
