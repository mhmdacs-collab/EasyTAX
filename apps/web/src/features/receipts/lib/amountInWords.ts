const ones=["","واحد","اثنان","ثلاثة","أربعة","خمسة","ستة","سبعة","ثمانية","تسعة","عشرة","أحد عشر","اثنا عشر","ثلاثة عشر","أربعة عشر","خمسة عشر","ستة عشر","سبعة عشر","ثمانية عشر","تسعة عشر"]
const tens=["","","عشرون","ثلاثون","أربعون","خمسون","ستون","سبعون","ثمانون","تسعون"]
const hundreds=["","مائة","مائتان","ثلاثمائة","أربعمائة","خمسمائة","ستمائة","سبعمائة","ثمانمائة","تسعمائة"]

function underThousand(value:number){const parts:string[]=[];const h=Math.floor(value/100),rest=value%100;if(h)parts.push(hundreds[h]??"");if(rest){if(rest<20)parts.push(ones[rest]??"");else{const unit=rest%10,ten=Math.floor(rest/10);parts.push(unit?`${ones[unit]} و${tens[ten]}`:tens[ten]??"")}}return parts.filter(Boolean).join(" و")}
function integerWords(value:number){if(value===0)return "صفر";const groups=[{size:1_000_000,singular:"مليون",dual:"مليونان",plural:"ملايين"},{size:1_000,singular:"ألف",dual:"ألفان",plural:"آلاف"}];let remaining=value;const parts:string[]=[];for(const group of groups){const count=Math.floor(remaining/group.size);if(count){parts.push(count===1?group.singular:count===2?group.dual:count<=10?`${underThousand(count)} ${group.plural}`:`${underThousand(count)} ${group.singular}`);remaining%=group.size}}if(remaining)parts.push(underThousand(remaining));return parts.join(" و")}

export function amountInWords(amount:number){const rounded=Math.round(amount*100),riyals=Math.floor(rounded/100),halalas=rounded%100;return `فقط ${integerWords(riyals)} ريال سعودي${halalas?` و${integerWords(halalas)} هللة`:""} لا غير`}

