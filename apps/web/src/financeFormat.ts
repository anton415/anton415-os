export function formatRussianMoneyAmount(value: string): string {
  return formatRussianDecimal(value);
}

export function formatRussianDecimal(value: string): string {
  const minorUnits = decimalInputToMinorUnits(value);
  return minorUnits === undefined ? value : formatRussianMinorUnits(minorUnits);
}

export function normalizeDecimalInput(value: string): string | undefined {
  const minorUnits = decimalInputToMinorUnits(value);
  return minorUnits === undefined ? undefined : formatApiMinorUnits(minorUnits);
}

export function normalizeDecimalInputOrRaw(value: string): string {
  return normalizeDecimalInput(value) ?? value.trim();
}

export function calculateIncomeAmount(salaryAmount: string, bonusPercent: string): string {
  return calculatePercentAdditionAmount(salaryAmount, bonusPercent);
}

export function calculatePercentAdditionAmount(baseAmount: string, percent: string): string {
  const baseKopecks = decimalInputToMinorUnits(baseAmount);
  const percentBasisPoints = decimalInputToMinorUnits(percent);
  if (baseKopecks === undefined || percentBasisPoints === undefined) {
    return "0.00";
  }

  const additionKopecks = roundDivide(baseKopecks * percentBasisPoints, 10000n);
  return formatApiMinorUnits(baseKopecks + additionKopecks);
}

export function calculatePercentAmount(baseAmount: string, percent: string): string {
  const baseKopecks = decimalInputToMinorUnits(baseAmount);
  const percentBasisPoints = decimalInputToMinorUnits(percent);
  if (baseKopecks === undefined || percentBasisPoints === undefined) {
    return "0.00";
  }

  return formatApiMinorUnits(roundDivide(baseKopecks * percentBasisPoints, 10000n));
}

export type ExpenseLimitStatus = "none" | "safe" | "near" | "over";

export function expenseLimitStatus(amount: string, limit: string): ExpenseLimitStatus {
  const amountKopecks = decimalInputToMinorUnits(amount);
  const limitKopecks = decimalInputToMinorUnits(limit);
  if (amountKopecks === undefined || limitKopecks === undefined || amountKopecks === 0n || limitKopecks === 0n) {
    return "none";
  }
  if (amountKopecks > limitKopecks) {
    return "over";
  }
  if (amountKopecks * 100n >= limitKopecks * 80n) {
    return "near";
  }

  return "safe";
}

export function divideDecimalAmount(value: string, divisor: number): string {
  const minorUnits = decimalInputToMinorUnits(value);
  if (minorUnits === undefined || divisor <= 0 || !Number.isInteger(divisor)) {
    return "0.00";
  }

  return formatApiMinorUnits(roundDivide(minorUnits, BigInt(divisor)));
}

export function currencyLabel(currency: string): string {
  return currency === "RUB" ? "₽" : currency;
}

function decimalInputToMinorUnits(value: string): bigint | undefined {
  const normalized = value.trim().replace(/[\s\u00a0\u202f]/g, "").replace(",", ".");
  const match = /^([0-9]+)(?:\.([0-9]{0,2}))?$/.exec(normalized);
  if (!match) {
    return undefined;
  }

  const whole = BigInt(match[1]);
  const fraction = (match[2] ?? "").padEnd(2, "0");
  return whole * 100n + BigInt(fraction);
}

function roundDivide(value: bigint, divisor: bigint): bigint {
  return (value + divisor / 2n) / divisor;
}

function formatApiMinorUnits(value: bigint): string {
  const whole = value / 100n;
  const fraction = (value % 100n).toString().padStart(2, "0");
  return `${whole}.${fraction}`;
}

function formatRussianMinorUnits(value: bigint): string {
  const whole = (value / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const fraction = (value % 100n).toString().padStart(2, "0");
  return `${whole},${fraction}`;
}
