interface LoginResponse { accessToken: string }
interface Collection<T> { data: T[] }

export interface TelegramLead { id: string; companyName: string; status: string }
export interface TelegramOffer { id: string; status: string; currency: string; totalMinor: number }
export interface TelegramTask { id: string; type: string; status: string; dueAt: string }

export class PhoenixApiClient {
  private accessToken: string | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly email: string,
    private readonly password: string,
  ) {}

  async health(): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(10_000) });
    return response.ok;
  }

  async listLeads(): Promise<TelegramLead[]> {
    return (await this.request<Collection<TelegramLead>>("/api/leads")).data;
  }

  async listOffers(): Promise<TelegramOffer[]> {
    return (await this.request<Collection<TelegramOffer>>("/api/commercial-offers")).data;
  }

  async listTasks(): Promise<TelegramTask[]> {
    return (await this.request<Collection<TelegramTask>>("/api/tasks")).data;
  }

  async createLead(companyName: string, idempotencyKey: string): Promise<TelegramLead> {
    return this.request<TelegramLead>("/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
      body: JSON.stringify({ companyName }),
    });
  }

  async recordTelegramCommand(updateId: number, telegramUserId: string, command: string, allowed: boolean): Promise<void> {
    await this.request("/api/integrations/telegram/audit", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": `telegram-${updateId}-${command}` },
      body: JSON.stringify({ updateId, telegramUserId, command, allowed }),
    });
  }

  private async login(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: this.email, password: this.password }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("Phoenix API service authentication failed");
    const body = await response.json() as LoginResponse;
    this.accessToken = body.accessToken;
  }

  private async request<T = unknown>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
    if (!this.accessToken) await this.login();
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${this.accessToken}`);
    const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers, signal: AbortSignal.timeout(10_000) });
    if (response.status === 401 && !retried) {
      this.accessToken = null;
      return this.request<T>(path, init, true);
    }
    if (!response.ok) throw new Error(`Phoenix API request failed with status ${response.status}`);
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }
}

export function telegramIdempotencyKey(updateId: number): string {
  return `telegram-lead-${updateId}`;
}
