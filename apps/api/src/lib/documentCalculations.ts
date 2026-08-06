export type CalculationInput={
  prices_include_tax:boolean
  retention_basis?:"before_tax"|"including_tax"|undefined
  discount_amount:number
  items:Array<{description:string;unit?:string|undefined;quantity:number;unit_price:number;discount_percent:number;retention_percent:number}>
}

export function calculateDocument(body:CalculationInput){
  const round=(value:number)=>Math.round(value*100)/100
  const lines=body.items.map((item,index)=>{
    const gross=item.quantity*item.unit_price
    const discount=gross*item.discount_percent/100
    const afterDiscount=gross-discount
    const beforeTax=body.prices_include_tax?afterDiscount/1.15:afterDiscount
    const tax=body.prices_include_tax?afterDiscount-beforeTax:beforeTax*0.15
    const retentionBase=body.retention_basis==="including_tax"?beforeTax+tax:beforeTax
    const retention=retentionBase*item.retention_percent/100
    return{...item,sort_order:index,discount:round(discount),line_subtotal:round(beforeTax),line_tax:round(tax),line_retention:round(retention),line_total:round(beforeTax+tax)}
  })
  const subtotal=round(lines.reduce((sum,line)=>sum+line.line_subtotal,0))
  const rawTaxTotal=lines.reduce((sum,line)=>sum+line.line_tax,0)
  const maxDiscount=body.prices_include_tax?subtotal+rawTaxTotal:subtotal
  const safeDiscount=Math.min(maxDiscount,Math.max(0,body.discount_amount))
  const safeDiscountBeforeTax=body.prices_include_tax?safeDiscount/1.15:safeDiscount
  const discountRatio=subtotal>0?Math.max(0,subtotal-safeDiscountBeforeTax)/subtotal:1
  const taxTotal=round(rawTaxTotal*discountRatio)
  const retentionTotal=round(lines.reduce((sum,line)=>sum+line.line_retention,0)*discountRatio)
  const total=round(Math.max(0,subtotal-safeDiscountBeforeTax+taxTotal))
  const payableTotal=round(Math.max(0,total-retentionTotal))
  return{lines,subtotal,discountTotal:round(safeDiscount),taxTotal,retentionTotal,total,payableTotal}
}
