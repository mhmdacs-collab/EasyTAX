export function dateWithinPeriod(date:string,startsOn:string,endsOn:string){
  const normalized=date.slice(0,10)
  return normalized>=startsOn&&normalized<=endsOn
}
