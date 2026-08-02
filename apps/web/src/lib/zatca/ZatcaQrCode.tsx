import QRCodeLib from "react-qr-code"
import type { FC, SVGProps } from "react"
import { generateZatcaQrString, type ZatcaQrInput } from "./qr"

// react-qr-code@2.2.0 declares QRCode as a class inside an ambient module,
// which causes @types/react@18 JSX checking to fail (the class instance is
// not assignable to React.Component because the module-scoped React import
// creates a separate type identity). The actual runtime implementation is a
// functional component, so we cast to FC here.
const QRCode = QRCodeLib as unknown as FC<SVGProps<SVGSVGElement> & { value: string; size?: number }>

interface Props extends ZatcaQrInput {
  size?: number
}

export function ZatcaQrCode({ size = 120, ...input }: Props) {
  const value = generateZatcaQrString(input)
  return (
    <div className="flex flex-col items-center gap-1">
      <QRCode value={value} size={size} />
      <p className="text-xs text-muted-foreground">QR فاتورة ضريبية</p>
    </div>
  )
}
