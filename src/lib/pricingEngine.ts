export type PricingInput = {
  quantity: number; unitCost: number; targetMarginPercent: number;
  safetyReservePercent?: number; packagingUnitCost?: number; operationalCost?: number;
  taxPercent?: number; commissionPercent?: number; additionalCommissionPercent?: number;
  fixedFee?: number; freightValue?: number; discountPercent?: number;
  additionalFixedCost?: number; otherCosts?: number;
};

export type PricingResult = PricingInput & { originalCost:number; targetResult:number; adjustedCost:number; announcedPrice:number; effectivePrice:number; calculatedResult:number; converged:boolean };

export class PricingUnavailableError extends Error {
  constructor(public readonly missing: string[]) {
    super(`Preço não gerado: faltam premissas obrigatórias (${missing.join(', ')}).`);
    this.name = 'PricingUnavailableError';
  }
}

export function validatePricingInput(input: PricingInput, options: { requiresFreight?: boolean } = {}) {
  const missing:string[]=[];
  for (const [key,label] of [['unitCost','custo original'],['targetMarginPercent','margem desejada'],['taxPercent','imposto'],['safetyReservePercent','reserva de segurança'],['operationalCost','custo operacional'],['commissionPercent','comissão']] as const) {
    if (input[key] === undefined || input[key] === null || !Number.isFinite(Number(input[key]))) missing.push(label);
  }
  if (options.requiresFreight && (input.freightValue === undefined || input.freightValue === null || !Number.isFinite(Number(input.freightValue)))) missing.push('frete Mercado Livre');
  if (missing.length) throw new PricingUnavailableError(missing);
  return true;
}

/** Deterministic local solver. Percentages use 0..100; prices use cents. */
export function solvePricing(input: PricingInput): PricingResult {
  validatePricingInput(input);
  const q=Math.max(1,Math.trunc(input.quantity)); const n=(v:number|undefined)=>Number.isFinite(v)?Number(v):0;
  const originalCost=n(input.unitCost)*q; const targetResult=originalCost*n(input.targetMarginPercent)/100;
  const adjustedCost=originalCost*(1+n(input.safetyReservePercent)/100);
  const fixed= n(input.fixedFee)+n(input.freightValue)+n(input.additionalFixedCost)+n(input.otherCosts)+n(input.packagingUnitCost)*q+n(input.operationalCost);
  const variable=(n(input.taxPercent)+n(input.commissionPercent)+n(input.additionalCommissionPercent))/100;
  const netFactor=Math.max(0.0001,(1-variable)*(1-n(input.discountPercent)/100));
  let announced=Math.max(0,(targetResult+adjustedCost+fixed)/netFactor);
  // Cent rounding can move the result below target; raise by one cent until safe.
  let effective=Number((announced*(1-n(input.discountPercent)/100)).toFixed(2));
  let result=effective*(1-variable)-adjustedCost-fixed;
  while(result+1e-9<targetResult && announced<1e9){ announced=Number((announced+0.01).toFixed(2)); effective=Number((announced*(1-n(input.discountPercent)/100)).toFixed(2)); result=effective*(1-variable)-adjustedCost-fixed; }
  return {...input,quantity:q,originalCost,targetResult,adjustedCost,announcedPrice:announced,effectivePrice:effective,calculatedResult:Number(result.toFixed(4)),converged:result+1e-9>=targetResult};
}

export function dimensionsForMercadoLivre(weightKg:number,widthCm:number,lengthCm:number,heightCm:number) {
  const grams=Math.max(1,Math.round(weightKg*1000));
  return `${Math.max(1,Math.round(heightCm))}x${Math.max(1,Math.round(widthCm))}x${Math.max(1,Math.round(lengthCm))},${grams}`;
}
