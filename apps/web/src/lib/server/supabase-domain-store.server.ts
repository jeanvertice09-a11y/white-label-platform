// SERVER-ONLY: adapter da fonte autoritativa `domains` para o DomainResolver.
// O client administrativo é criado somente quando há resolução dinâmica de host.
import type { DomainRecord, DomainStore } from "@white-label/domains";
import { createServiceSupabaseClient } from "./supabase-service.server.ts";

type Row = Record<string, unknown>;

function requiredString(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Domínio inválido: ${key}`);
  }
  return value;
}

function nullableString(row: Row, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error(`Domínio inválido: ${key}`);
  return value;
}

function firstRow(value: unknown): Row | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const first: unknown = value[0];
  if (typeof first !== "object" || first === null) throw new Error("Resposta de domínio inválida");
  return first as Row;
}

function mapDomain(row: Row): DomainRecord {
  return {
    id: requiredString(row, "id"),
    tenantId: requiredString(row, "tenant_id"),
    storeId: nullableString(row, "store_id"),
    hostname: requiredString(row, "hostname"),
    type: requiredString(row, "type") as DomainRecord["type"],
    status: requiredString(row, "status") as DomainRecord["status"],
    verifiedAt: nullableString(row, "verified_at"),
  };
}

export function createServiceDomainStore(): DomainStore {
  return {
    async findByHostname(hostname: string): Promise<DomainRecord | null> {
      const client = createServiceSupabaseClient();
      const result = await client
        .from("domains")
        .select("id,tenant_id,store_id,hostname,type,status,verified_at")
        .eq("hostname", hostname)
        .eq("status", "active")
        .not("verified_at", "is", null)
        .limit(1);
      if (result.error) throw new Error(`Falha ao resolver domínio: ${result.error.message}`);
      const row = firstRow(result.data);
      return row ? mapDomain(row) : null;
    },
  };
}
