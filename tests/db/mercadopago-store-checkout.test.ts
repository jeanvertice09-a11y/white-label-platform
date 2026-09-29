import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { setupDatabase, expectReject, type Harness } from "./harness.ts";
import { seedIds, seedSql } from "./seed.ts";
let h: Harness; const ids=seedIds();
beforeAll(async()=>{h=await setupDatabase();await h.db.execScript(seedSql());});
afterAll(async()=>{await h.db.close();});
describe("Mercado Pago store checkout invariants",()=>{
 test("uma loja possui uma única conexão Mercado Pago store_checkout",async()=>{
  await h.db.query(`insert into public.gateway_accounts(level,tenant_id,store_id,provider,label,status)
   values ('store_checkout',$1::uuid,$2::uuid,'mercadopago','MP','active')`,[ids.tenantA,ids.storeA]);
  await expectReject(h.db.query(`insert into public.gateway_accounts(level,tenant_id,store_id,provider,label,status)
   values ('store_checkout',$1::uuid,$2::uuid,'mercadopago','MP duplicado','active')`,[ids.tenantA,ids.storeA]),"gateway");
 });
 test("um pedido online não recebe dois payments store_checkout",async()=>{
  const gateway=await h.db.query(`select id::text from public.gateway_accounts where tenant_id=$1::uuid and store_id=$2::uuid and provider='mercadopago'`,[ids.tenantA,ids.storeA]);
  const gatewayId=String(gateway.at(0)?.["id"]);const order=await h.db.query(`insert into public.orders(tenant_id,store_id,total_cents,origin) values($1::uuid,$2::uuid,1000,'online') returning id::text`,[ids.tenantA,ids.storeA]);
  const orderId=String(order.at(0)?.["id"]);
  await h.db.query(`insert into public.payments(level,tenant_id,store_id,gateway_account_id,provider_payment_id,amount_cents,order_id)
   values('store_checkout',$1::uuid,$2::uuid,$3::uuid,'ORD-A',1000,$4::uuid)`,[ids.tenantA,ids.storeA,gatewayId,orderId]);
  await expectReject(h.db.query(`insert into public.payments(level,tenant_id,store_id,gateway_account_id,provider_payment_id,amount_cents,order_id)
   values('store_checkout',$1::uuid,$2::uuid,$3::uuid,'ORD-B',1000,$4::uuid)`,[ids.tenantA,ids.storeA,gatewayId,orderId]),"payments");
  const rows=await h.db.query("select count(*)::int total from public.payments where order_id=$1::uuid",[orderId]);expect(rows.at(0)?.["total"]).toBe(1);
 });
});
