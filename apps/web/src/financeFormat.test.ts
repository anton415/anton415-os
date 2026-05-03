import { describe, expect, it } from "vitest";

import {
  calculateIncomeAmount,
  calculatePercentAmount,
  currencyLabel,
  divideDecimalAmount,
  expenseLimitStatus,
  formatRussianDecimalInput,
  formatRussianMoneyAmount,
  formatRussianMoneyInput,
  isLimitAllocationValid,
  limitAllocationPercent,
  multiplyDecimalAmount,
  normalizeDecimalInput,
  targetProgressStatus
} from "./financeFormat";

describe("financeFormat", () => {
  it("formats money summaries as rounded whole rubles", () => {
    expect(formatRussianMoneyAmount("200000.00")).toBe("200 000");
    expect(formatRussianMoneyAmount("2500000.50")).toBe("2 500 001");
    expect(currencyLabel("RUB")).toBe("₽");
  });

  it("formats money and percent inputs without noisy zero fractions", () => {
    expect(formatRussianMoneyInput("0.00")).toBe("");
    expect(formatRussianMoneyInput("200000.00")).toBe("200 000");
    expect(formatRussianMoneyInput("2500000.50")).toBe("2 500 000,50");
    expect(formatRussianDecimalInput("0.00")).toBe("");
    expect(formatRussianDecimalInput("15.50")).toBe("15,50");
    expect(formatRussianDecimalInput("10.00")).toBe("10");
  });

  it("normalizes Russian decimal input for API payloads", () => {
    expect(normalizeDecimalInput("200 000,00")).toBe("200000.00");
    expect(normalizeDecimalInput("15,50")).toBe("15.50");
    expect(normalizeDecimalInput("1500.5")).toBe("1500.50");
  });

  it("calculates income from salary and bonus percent without floats", () => {
    expect(calculateIncomeAmount("200 000,00", "25,00")).toBe("250000.00");
    expect(calculateIncomeAmount("210 000,00", "15,50")).toBe("242550.00");
    expect(calculatePercentAmount("250 000,00", "10,00")).toBe("25000.00");
  });

  it("classifies expense amounts against configured limits", () => {
    expect(expenseLimitStatus("0,00", "100,00")).toBe("none");
    expect(expenseLimitStatus("50,00", "100,00")).toBe("safe");
    expect(expenseLimitStatus("80,00", "100,00")).toBe("near");
    expect(expenseLimitStatus("100,01", "100,00")).toBe("over");
    expect(expenseLimitStatus("1,00", "0,00")).toBe("none");
  });

  it("classifies progress towards income and investment targets", () => {
    expect(targetProgressStatus("0,00", "100,00")).toBe("none");
    expect(targetProgressStatus("50,00", "100,00")).toBe("over");
    expect(targetProgressStatus("80,00", "100,00")).toBe("near");
    expect(targetProgressStatus("100,00", "100,00")).toBe("safe");
  });

  it("checks limit allocation totals", () => {
    expect(limitAllocationPercent(["10", "15,50", undefined])).toBe("25.50");
    expect(isLimitAllocationValid("0.00")).toBe(true);
    expect(isLimitAllocationValid("99.99")).toBe(false);
    expect(isLimitAllocationValid("100.00")).toBe(true);
  });

  it("divides decimal amounts in kopecks", () => {
    expect(divideDecimalAmount("1500.00", 12)).toBe("125.00");
    expect(divideDecimalAmount("2500.00", 12)).toBe("208.33");
  });

  it("multiplies decimal amounts in kopecks", () => {
    expect(multiplyDecimalAmount("250000.00", 12)).toBe("3000000.00");
    expect(multiplyDecimalAmount("bad", 12)).toBe("0.00");
  });
});
