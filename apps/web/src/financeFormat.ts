export function formatRussianMoneyAmount(value: string): string {
  const minorUnits = decimalInputToMinorUnits(value);
  return minorUnits === undefined ? value : formatRussianWholeRubles(minorUnits);
}

export function formatRussianMoneyInput(value: string): string {
  const minorUnits = decimalInputToMinorUnits(value);
  if (minorUnits === undefined) {
    return value;
  }
  if (minorUnits === 0n) {
    return "";
  }
  return formatRussianMinorUnitsValue(minorUnits, { hideZeroFraction: true });
}

export function formatRussianDecimalInput(value: string): string {
  const minorUnits = decimalInputToMinorUnits(value);
  if (minorUnits === undefined) {
    return value;
  }
  if (minorUnits === 0n) {
    return "";
  }
  return formatRussianMinorUnitsValue(minorUnits, { hideZeroFraction: true });
}

export function formatRussianDecimal(value: string): string {
  const minorUnits = decimalInputToMinorUnits(value);
  return minorUnits === undefined ? value : formatRussianMinorUnitsValue(minorUnits, { hideZeroFraction: false });
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

export function targetProgressStatus(amount: string, target: string): ExpenseLimitStatus {
  const amountKopecks = decimalInputToMinorUnits(amount);
  const targetKopecks = decimalInputToMinorUnits(target);
  if (amountKopecks === undefined || targetKopecks === undefined || amountKopecks === 0n || targetKopecks === 0n) {
    return "none";
  }
  if (amountKopecks >= targetKopecks) {
    return "safe";
  }
  if (amountKopecks * 100n >= targetKopecks * 80n) {
    return "near";
  }

  return "over";
}

export function limitAllocationPercent(values: Iterable<string | undefined>): string {
  let total = 0n;
  for (const value of values) {
    if (!value) {
      continue;
    }
    const percentBasisPoints = decimalInputToMinorUnits(value);
    if (percentBasisPoints !== undefined) {
      total += percentBasisPoints;
    }
  }
  return formatApiMinorUnits(total);
}

export function isLimitAllocationValid(totalPercent: string): boolean {
  const basisPoints = decimalInputToMinorUnits(totalPercent);
  return basisPoints === 0n || basisPoints === 10000n;
}

export function divideDecimalAmount(value: string, divisor: number): string {
  const minorUnits = decimalInputToMinorUnits(value);
  if (minorUnits === undefined || divisor <= 0 || !Number.isInteger(divisor)) {
    return "0.00";
  }

  return formatApiMinorUnits(roundDivide(minorUnits, BigInt(divisor)));
}

export function multiplyDecimalAmount(value: string, multiplier: number): string {
  const minorUnits = decimalInputToMinorUnits(value);
  if (minorUnits === undefined || multiplier < 0 || !Number.isInteger(multiplier)) {
    return "0.00";
  }

  return formatApiMinorUnits(minorUnits * BigInt(multiplier));
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

function formatRussianMinorUnitsValue(value: bigint, options: { hideZeroFraction: boolean }): string {
  const whole = (value / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const fraction = (value % 100n).toString().padStart(2, "0");
  if (options.hideZeroFraction && fraction === "00") {
    return whole;
  }
  return `${whole},${fraction}`;
}

function formatRussianWholeRubles(value: bigint): string {
  const wholeRubles = ((value + 50n) / 100n).toString();
  return wholeRubles.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
