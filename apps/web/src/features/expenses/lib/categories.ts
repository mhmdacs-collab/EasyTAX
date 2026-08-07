import type { ExpenseCategory, FinancialClass } from "@/lib/platform/api"

export const expenseCategories: Array<{value:ExpenseCategory;label:string;description:string;financialClass:FinancialClass}> = [
  { value:"work_costs", label:"تكاليف الأعمال والمشاريع", description:"مواد، مقاول باطن، نقل أو معدات مستأجرة للعمل", financialClass:"direct_cost" },
  { value:"payroll", label:"الرواتب والموظفون", description:"رواتب شهرية، بدلات وتأمينات ومصروفات الموظفين", financialClass:"employee_expense" },
  { value:"rent_utilities", label:"الإيجار والخدمات", description:"إيجار، كهرباء، مياه، اتصالات وإنترنت", financialClass:"operating_expense" },
  { value:"vehicles_transport", label:"المركبات والتنقل", description:"وقود، صيانة، تأمين، نقل وسفر", financialClass:"operating_expense" },
  { value:"admin_marketing_professional", label:"الإدارة والتسويق والخدمات المهنية", description:"مكتب، برامج، إعلان، محاسبة واستشارات", financialClass:"operating_expense" },
  { value:"asset_equipment", label:"شراء أصل أو معدة", description:"سيارة، آلة، جهاز أو أثاث يُستخدم لأكثر من فترة", financialClass:"fixed_asset" },
  { value:"other", label:"مصروفات أخرى", description:"عملية لا تنطبق عليها التصنيفات السابقة", financialClass:"other_expense" },
]

export const categoryByValue = new Map(expenseCategories.map((category) => [category.value, category]))

export function financialClassForCategory(category: ExpenseCategory): FinancialClass {
  return categoryByValue.get(category)?.financialClass ?? "other_expense"
}
