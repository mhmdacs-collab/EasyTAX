import { BrowserQRCodeReader } from "@zxing/browser"

type Crop = { x:number; y:number; width:number; height:number }

export function createQrCropPlan(width:number,height:number):Crop[] {
  const crops:Crop[]=[{x:0,y:0,width,height}]
  for(const [columns,rows] of [[2,3],[3,4]] as const){
    const cropWidth=Math.min(width,Math.ceil((width/columns)*1.35))
    const cropHeight=Math.min(height,Math.ceil((height/rows)*1.35))
    const stepX=(width-cropWidth)/(columns-1)
    const stepY=(height-cropHeight)/(rows-1)
    for(let row=0;row<rows;row++)for(let column=0;column<columns;column++)crops.push({x:Math.round(column*stepX),y:Math.round(row*stepY),width:cropWidth,height:cropHeight})
  }
  return crops
}

function renderCrop(source:ImageBitmap,crop:Crop,threshold?:number){
  const scale=Math.min(5,Math.max(1,1000/Math.min(crop.width,crop.height)))
  const canvas=document.createElement("canvas")
  canvas.width=Math.round(crop.width*scale)
  canvas.height=Math.round(crop.height*scale)
  const context=canvas.getContext("2d",{willReadFrequently:threshold!==undefined})
  if(!context)throw new Error("CANVAS_UNAVAILABLE")
  context.imageSmoothingEnabled=false
  context.drawImage(source,crop.x,crop.y,crop.width,crop.height,0,0,canvas.width,canvas.height)
  if(threshold!==undefined){
    const image=context.getImageData(0,0,canvas.width,canvas.height)
    for(let index=0;index<image.data.length;index+=4){
      const gray=(image.data[index]??0)*0.299+(image.data[index+1]??0)*0.587+(image.data[index+2]??0)*0.114
      const value=gray>=threshold?255:0
      image.data[index]=value;image.data[index+1]=value;image.data[index+2]=value
    }
    context.putImageData(image,0,0)
  }
  return canvas
}

async function tryNativeDetector(canvas:HTMLCanvasElement){
  type BarcodeDetectorConstructor = new (options:{formats:string[]}) => {detect(source:CanvasImageSource):Promise<Array<{rawValue:string}>>}
  const Detector=(globalThis as typeof globalThis & {BarcodeDetector?:BarcodeDetectorConstructor}).BarcodeDetector
  if(!Detector)return null
  try{return (await new Detector({formats:["qr_code"]}).detect(canvas))[0]?.rawValue??null}catch{return null}
}

export async function readQrFromInvoiceImage(file:File){
  const bitmap=await createImageBitmap(file)
  const reader=new BrowserQRCodeReader()
  try{
    for(const crop of createQrCropPlan(bitmap.width,bitmap.height)){
      const normal=renderCrop(bitmap,crop)
      const native=await tryNativeDetector(normal)
      if(native)return native
      try{return reader.decodeFromCanvas(normal).getText()}catch{
        for(const threshold of [145,175,205]){
          try{return reader.decodeFromCanvas(renderCrop(bitmap,crop,threshold)).getText()}catch{continue}
        }
      }
    }
  }finally{bitmap.close()}
  throw new Error("QR_NOT_FOUND")
}
