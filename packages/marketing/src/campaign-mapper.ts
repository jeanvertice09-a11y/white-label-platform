import type {
  Campaign,
  CampaignHistoryItem,
  CampaignMutationInput,
  CampaignRecipient,
  MarketingScope,
} from "./types.ts";

export const CAMPAIGN_COLUMNS =
  "id,tenant_id,store_id,name,content,status,segment_type,scheduled_at," +
  "prepared_at,cancelled_at,created_at,updated_at";

export function text(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error("Campo inválido: " + key);
  return value;
}

export function dateText(
  row: Record<string, unknown>,
  key: string,
): string | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  throw new Error("Data inválida: " + key);
}

export function assertScope(scope: MarketingScope): void {
  if (!scope.tenantId || !scope.storeId) {
    throw new Error("Escopo de marketing inválido");
  }
}

export function normalizeCampaignInput(
  input: CampaignMutationInput,
): CampaignMutationInput {
  const name = input.name.trim();
  const content = input.content.trim();
  if (!name || name.length > 160) throw new Error("Nome da campanha inválido");
  if (!content || content.length > 5000) {
    throw new Error("Conteúdo da campanha inválido");
  }
  return {
    name,
    content,
    segmentType: input.segmentType,
    scheduledAt: input.scheduledAt,
  };
}

export function mapCampaign(row: Record<string, unknown>): Campaign {
  return {
    id: text(row, "id"),
    tenantId: text(row, "tenant_id"),
    storeId: text(row, "store_id"),
    name: text(row, "name"),
    content: text(row, "content"),
    status: text(row, "status") as Campaign["status"],
    segmentType: text(row, "segment_type") as Campaign["segmentType"],
    scheduledAt: dateText(row, "scheduled_at"),
    preparedAt: dateText(row, "prepared_at"),
    cancelledAt: dateText(row, "cancelled_at"),
    recipientCount: Number(row["recipient_count"] ?? 0),
    createdAt: dateText(row, "created_at") ?? "",
    updatedAt: dateText(row, "updated_at") ?? "",
  };
}

export function mapRecipient(
  row: Record<string, unknown>,
): CampaignRecipient {
  return {
    id: text(row, "id"),
    tenantId: text(row, "tenant_id"),
    storeId: text(row, "store_id"),
    campaignId: text(row, "campaign_id"),
    customerId: text(row, "customer_id"),
    customerName: text(row, "customer_name"),
    status: text(row, "status") as CampaignRecipient["status"],
    availableAt: dateText(row, "available_at") ?? "",
    preparedAt: dateText(row, "prepared_at") ?? "",
    blockedAt: dateText(row, "blocked_at"),
  };
}

export function mapHistory(
  rows: Record<string, unknown>[],
): CampaignHistoryItem[] {
  return rows.map((row) => ({
    action: text(row, "action"),
    createdAt: dateText(row, "created_at") ?? "",
  }));
}
