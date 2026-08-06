import test from "node:test"
import assert from "node:assert/strict"
import { createQrCropPlan } from "./imageQrReader"

void test("crop plan fully covers a small QR in the lower-left invoice area",()=>{
  const qr={left:190,top:730,right:290,bottom:830}
  const covered=createQrCropPlan(828,1179).some((crop)=>crop.x<=qr.left&&crop.y<=qr.top&&crop.x+crop.width>=qr.right&&crop.y+crop.height>=qr.bottom)
  assert.equal(covered,true)
})
