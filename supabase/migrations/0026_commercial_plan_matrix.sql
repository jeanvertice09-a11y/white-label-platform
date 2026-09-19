-- 0026_commercial_plan_matrix.sql
-- Matriz comercial oficial Kataluu para White Label -> lojista.
-- Preço, trial e billing interval continuam pertencendo a public.tenant_plans.
-- Ausência de max_products representa ausência de teto comercial de produtos;
-- não há sentinela numérica de "ilimitado".

-- Preserva os IDs existentes dos quatro templates legados e usa code como
-- identidade comercial estável. Os dois templates novos recebem ID uma única
-- vez e passam a ser preservados pelos reruns via ON CONFLICT(code).
insert into public.plan_templates (code,name,description,active,sort_order) values
  ('free','Grátis','Até 20 produtos, catálogo Classic, pedidos e CRM básico.',true,0),
  ('monthly_entry','Plano 1','Até 100 produtos, Modern, branding básico, cupons e estoque.',true,10),
  ('monthly_intermediate','Plano 2','Até 300 produtos, domínio próprio, campanhas, fornecedores e compras.',true,20),
  ('monthly_complete','Plano 3','Até 1.000 produtos, incluindo financeiro. Tarefas seguem o boundary de assinatura/RBAC.',true,30),
  ('complete','Completo','Sem teto comercial de produtos. Relatórios avançados permanecem desabilitados até existir produto real.',true,40),
  ('complete_ecommerce','Completo + E-commerce','Base Completo. Pagamento online permanece desabilitado até existir checkout online end-to-end.',true,50)
on conflict (code) do update set
  name=excluded.name,
  description=excluded.description,
  active=excluded.active,
  sort_order=excluded.sort_order,
  updated_at=now();

-- Cada feature real do registro central é explicitamente configurada nos seis
-- templates. null::integer em min_tier significa capacidade existente no
-- schema, porém ainda não entregue/selecionada para esta matriz comercial.
with template_tiers(code,tier) as (
  values
    ('free',0),
    ('monthly_entry',1),
    ('monthly_intermediate',2),
    ('monthly_complete',3),
    ('complete',4),
    ('complete_ecommerce',5)
), feature_rules(entitlement_key,min_tier) as (
  values
    ('products',0),
    ('variants',0),
    ('orders',0),
    ('customers',0),
    ('inventory',1),
    ('finance',3),
    ('purchases',2),
    ('suppliers',2),
    ('coupons',1),
    ('campaigns',2),
    ('reports',null::integer),
    ('custom_domain',2),
    ('banners',1),
    ('layouts',1),
    ('meta_pixel',null::integer),
    ('online_payments',null::integer),
    ('mercadopago',null::integer),
    ('shipping',null::integer),
    ('melhor_envio',null::integer),
    ('team_users',null::integer),
    ('automations',null::integer),
    ('integrations',null::integer)
)
insert into public.plan_template_entitlements(template_id,entitlement_key,enabled,limit_value)
select t.id,r.entitlement_key,
  case when r.min_tier is null then false else tt.tier>=r.min_tier end,
  null
from template_tiers tt
join public.plan_templates t on t.code=tt.code
cross join feature_rules r
join public.entitlement_definitions d
  on d.key=r.entitlement_key and d.kind='feature' and d.active=true
on conflict (template_id,entitlement_key) do update set
  enabled=excluded.enabled,
  limit_value=null,
  updated_at=now();

-- Limites comerciais de produtos dos quatro níveis limitados.
with product_limits(code,limit_value) as (
  values
    ('free',20::bigint),
    ('monthly_entry',100::bigint),
    ('monthly_intermediate',300::bigint),
    ('monthly_complete',1000::bigint)
)
insert into public.plan_template_entitlements(template_id,entitlement_key,enabled,limit_value)
select t.id,'max_products',null,l.limit_value
from product_limits l
join public.plan_templates t on t.code=l.code
join public.entitlement_definitions d
  on d.key='max_products' and d.kind='limit' and d.active=true
on conflict (template_id,entitlement_key) do update set
  enabled=null,
  limit_value=excluded.limit_value,
  updated_at=now();

-- Completo e Completo + E-commerce não usam número mágico para "ilimitado".
delete from public.plan_template_entitlements e
using public.plan_templates t
where e.template_id=t.id
  and t.code in ('complete','complete_ecommerce')
  and e.entitlement_key='max_products';
