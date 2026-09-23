import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createOrderRepository } from "../../packages/orders/src/index.ts";
import { setupDatabase, expectReject, type Harness } from "./harness.ts";
import { seedIds, seedSql } from "./seed.ts";

let h: Harness;
const ids=seedIds();
let gateway="";
const product="43000000-0000-4000-8000-000000000001";

beforeAll(async()=>{
 h=await setupDatabase();await h.db.execScript(seedSql());
 await h.db.query(`insert into public.products(id,tenant_id,store_id,slug,name,price_cents,track_inventory,stock_quantity)
 values($1::uuid,$2::uuid,$3::uuid,'lifecycle','Lifecycle',1000,true,2)`,[product,ids.tenantA,ids.storeA]);
 await h.db.query(`insert into public.stock_movements(tenant_id,store_id,product_id,delta,reason,movement_type)
 values($1::uuid,$2::uuid,$3::uuid,2,'Inicial','initial')`,[ids.tenantA,ids.storeA,product]);
 const rows=await h.db.query(`insert into public.gateway_accounts(level,tenant_id,store_id,provider,label,status)
 values('store_checkout',$1::uuid,$2::uuid,'mercadopago','Lifecycle','active') returning id::text`,[ids.tenantA,ids.storeA]);
 gateway=String(rows[0]?.["id"]);
});
afterAll(async()=>{await h.db.close();});

async function order(key:string){
 return createOrderRepository(h.db).createFromCart({tenantId:ids.tenantA,storeId:ids.storeA},{
  idempotencyKey:key,origin:"online",customerName:null,customerPhone:null,couponCode:null,notes:null,
  shippingCents:0,minimumOrderCents:0,items:[{productId:product,variantId:null,quantity:1}],
 });
}
async function payment(orderId:string,amount=1000){
 const rows=await h.db.query(`insert into public.payments(level,tenant_id,store_id,gateway_account_id,provider_payment_id,amount_cents,status,order_id)
 values('store_checkout',$1::uuid,$2::uuid,$3::uuid,$4,$5,'pending',$6::uuid) returning id::text`,
 [ids.tenantA,ids.storeA,gateway,`pay-${orderId}`,amount,orderId]);
 return String(rows[0]?.["id"]);
}

describe("order/payment lifecycle hardening",()=>{
 test("service role não vincula payment com valor diferente do total server-side",async()=>{
  const o=await order("lifecycle-amount");
  await expectReject(payment(o.id,999),"valor diverge");
 });
 test("pedido pago não pode ser cancelado manualmente e estoque não é restaurado",async()=>{
  const o=await order("lifecycle-paid");const p=await payment(o.id);
  await h.db.query("update public.payments set status='captured' where id=$1::uuid",[p]);
  await h.db.query("update public.orders set payment_status='paid' where id=$1::uuid",[o.id]);
  const repo=createOrderRepository(h.db);await repo.confirm({tenantId:ids.tenantA,storeId:ids.storeA},o.id);
  await expectReject(repo.cancel({tenantId:ids.tenantA,storeId:ids.storeA},o.id),"resolução financeira");
  const row=await h.db.query("select status from public.orders where id=$1::uuid",[o.id]);
  expect(row[0]?.["status"]).toBe("confirmed");
  const movements=await h.db.query(`select count(*)::int n from public.stock_movements where reference_type='order' and reference_id=$1::uuid and movement_type='cancellation'`,[o.id]);
  expect(Number(movements[0]?.["n"])).toBe(0);
 });
 test("pedido pending sem captura continua cancelável sem restauração artificial",async()=>{
  const o=await order("lifecycle-pending");await payment(o.id);
  const cancelled=await createOrderRepository(h.db).cancel({tenantId:ids.tenantA,storeId:ids.storeA},o.id);
  expect(cancelled?.status).toBe("cancelled");
  const movements=await h.db.query(`select count(*)::int n from public.stock_movements where reference_type='order' and reference_id=$1::uuid and movement_type='cancellation'`,[o.id]);
  expect(Number(movements[0]?.["n"])).toBe(0);
 });
});
