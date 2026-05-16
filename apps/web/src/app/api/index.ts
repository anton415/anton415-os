import { AuthApi } from "./authApi";
import { TodoApi } from "./todoApi";
import { FinanceApi } from "./financeApi";

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? "http://localhost:8080" : "");

export const authApi = new AuthApi(apiBaseUrl);
export const todoApi = new TodoApi(apiBaseUrl);
export const financeApi = new FinanceApi(apiBaseUrl);

export { AuthApiError } from "./authApi";
export { TodoApiError } from "./todoApi";
export { FinanceApiError } from "./financeApi";
