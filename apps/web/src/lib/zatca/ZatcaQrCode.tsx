import QRCode from "react-qr-code"
import { generateZatcaQrString, type ZatcaQrInput } from "./qr"

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
