// Fixtures fictícias e determinísticas p/ testes REAL DATABASE.
// Nenhum dado pessoal/real: UUIDs fixos, emails @example.test.
export const U = {
  platformOwner: "00000000-0000-4000-8000-000000000001",
  tenantA: "00000000-0000-4000-8000-000000000002",
  tenantB: "00000000-0000-4000-8000-000000000003",
  storeA: "00000000-0000-4000-8000-000000000004",
  storeB: "00000000-0000-4000-8000-000000000005",
} as const;

export const T = {
  a: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  b: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
} as const;

export const S = {
  a: "aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa",
  b: "bbbbbbbb-0000-4000-8000-bbbbbbbbbbbb",
} as const;

export interface DbSeed {
  tenantA: string;
  tenantB: string;
  storeA: string;
  storeB: string;
  users: typeof U;
}

/** Inserts idempotentes (PKs fixas + on conflict do nothing). */
export function seedSql(): string {
  return `
insert into public.tenants (id, slug, name, status) values
  ('${T.a}', 'tenant-a', 'Tenant A (teste)', 'active'),
  ('${T.b}', 'tenant-b', 'Tenant B (teste)', 'active')
on conflict (id) do nothing;

insert into public.platform_members (user_id, role) values
  ('${U.platformOwner}', 'platform_owner')
on conflict (user_id) do nothing;

insert into public.tenant_members (tenant_id, user_id, role) values
  ('${T.a}', '${U.tenantA}', 'tenant_owner'),
  ('${T.b}', '${U.tenantB}', 'tenant_support')
on conflict (tenant_id, user_id) do nothing;

insert into public.stores (id, tenant_id, slug, name, status) values
  ('${S.a}', '${T.a}', 'loja-a', 'Loja A (teste)', 'active'),
  ('${S.b}', '${T.b}', 'loja-b', 'Loja B (teste)', 'active')
on conflict (id) do nothing;

insert into public.store_members (tenant_id, store_id, user_id, role) values
  ('${T.a}', '${S.a}', '${U.storeA}', 'store_admin'),
  ('${T.b}', '${S.b}', '${U.storeB}', 'store_manager')
on conflict (store_id, user_id) do nothing;
`;
}

export function seedIds(): DbSeed {
  return { tenantA: T.a, tenantB: T.b, storeA: S.a, storeB: S.b, users: U };
}
