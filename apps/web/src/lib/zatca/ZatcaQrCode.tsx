import QRCodeLib from "react-qr-code"
import type { FC, SVGProps } from "react"
import { generateZatcaQrString, type ZatcaQrInput } from "./qr"

// react-qr-code@2.2.0 declares QRCode as a class inside an ambient module,
// which causes @types/react@18 JSX checking to fail (the class instance is
// not assignable to React.Component because the module-scoped React import
// creates a separate type identity). The actual runtime implementation is a
// functional component, so we cast to FC here.
const QRCode = QRCodeLib as unknown as FC<SVGProps<SVGSVGElement> & { value: string; size?: number; level?: "L" | "M" | "Q" | "H"; bgColor?: string; fgColor?: string }>

interface Props extends ZatcaQrInput {
  size?: number
}

export function ZatcaQrCode({ size = 120, ...input }: Props) {
  let value: string
  try {
    value = generateZatcaQrString(input)
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر إنشاء QR"
    return <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{message}</p>
  }
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="inline-flex bg-white p-4" aria-label="رمز QR للفاتورة الضريبية">
        <QRCode value={value} size={size} level="M" bgColor="#ffffff" fgColor="#000000" />
      </div>
      <p className="text-xs text-muted-foreground">QR فاتورة ضريبية</p>
    </div>
  )
}
