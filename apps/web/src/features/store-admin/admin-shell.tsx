import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { DashboardIcon, type DashboardIconName } from "../../components/dashboard/DashboardIcon.tsx";
import "../../styles/panel-navigation-lot1.css";

interface NavItem { to:string; label:string; exact:boolean; icon:DashboardIconName; description?:string; }
interface NavGroup { label:string; items:readonly NavItem[]; }

const navigation:readonly NavGroup[]=[
 {label:"Dia a dia",items:[
  {to:"/admin",label:"Início",exact:true,icon:"home"},
  {to:"/admin/orders",label:"Pedidos",exact:false,icon:"orders"},
  {to:"/admin/products",label:"Produtos",exact:false,icon:"products"},
  {to:"/admin/store",label:"Minha loja",exact:false,icon:"store"},
 ]},
];
const moreNavigation:readonly NavGroup[]=[
 {label:"Produtos e vendas",items:[
  {to:"/admin/categories",label:"Categorias",exact:true,icon:"categories"},
  {to:"/admin/inventory",label:"Estoque",exact:true,icon:"inventory"},
  {to:"/admin/customers",label:"Clientes",exact:false,icon:"customers"},
  {to:"/admin/coupons",label:"Cupons",exact:true,icon:"marketing"},
 ]},
 {label:"Personalizar catálogo",items:[
  {to:"/admin/store/catalog",label:"Configurar catálogo",exact:true,icon:"settings"},
  {to:"/admin/store/appearance",label:"Visual da loja",exact:true,icon:"palette"},
  {to:"/admin/store/banners",label:"Banners",exact:true,icon:"marketing"},
 ]},
 {label:"Gestão",items:[
  {to:"/admin/finance",label:"Financeiro",exact:false,icon:"revenue"},
  {to:"/admin/marketing",label:"Divulgação",exact:false,icon:"marketing"},
  {to:"/admin/purchases",label:"Compras e despesas",exact:true,icon:"orders"},
  {to:"/admin/suppliers",label:"Fornecedores",exact:true,icon:"store"},
  {to:"/admin/operations",label:"Relatórios e histórico",exact:true,icon:"activity"},
  {to:"/admin/settings",label:"Configurações",exact:true,icon:"settings"},
 ]},
];
const FOCUSABLE='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function NavigationGroups({groups,onClose}:Readonly<{groups:readonly NavGroup[];onClose:()=>void}>):React.JSX.Element{return <>{groups.map((group)=><div className="k-admin__nav-group" key={group.label}><span className="k-admin__nav-label">{group.label}</span>{group.items.map((item)=><Link key={item.to} to={item.to} activeOptions={{exact:item.exact}} activeProps={{"data-status":"active"}} onClick={onClose}><DashboardIcon name={item.icon}/><span>{item.label}</span></Link>)}</div>)}</>;}

function AdminSidebar(props:Readonly<{open:boolean;onClose:()=>void;storefrontUrl:string|null}>):React.JSX.Element{return <><button type="button" className={props.open?"k-admin__overlay is-open":"k-admin__overlay"} onClick={props.onClose} aria-label="Fechar menu" tabIndex={props.open?0:-1}/><aside id="merchant-navigation" className={props.open?"k-admin__sidebar is-open":"k-admin__sidebar"} aria-label="Navegação da loja"><Link to="/admin" className="k-admin__brand" onClick={props.onClose}><span className="k-admin__brand-mark" aria-hidden="true">k.</span><span className="k-admin__brand-copy"><strong>kataluu</strong><small>Painel da sua loja</small></span></Link><nav className="k-admin__nav" aria-label="Administração da loja"><NavigationGroups groups={navigation} onClose={props.onClose}/><Link to="/admin/store/catalog" className="k-admin__setup-link" onClick={props.onClose}><DashboardIcon name="check"/><span><strong>Configurar catálogo</strong><small>Deixe sua loja pronta para vender</small></span></Link><details className="k-admin__more"><summary>Mais opções <span aria-hidden="true">⌄</span></summary><NavigationGroups groups={moreNavigation} onClose={props.onClose}/></details></nav><div className="k-admin__sidebar-foot">{props.storefrontUrl?<a className="k-admin__store-link" href={props.storefrontUrl} target="_blank" rel="noreferrer">Ver meu catálogo <span aria-hidden="true">↗</span></a>:<Link className="k-admin__store-link" to="/admin/store/catalog" onClick={props.onClose}>Configurar catálogo <span aria-hidden="true">→</span></Link>}<div className="k-admin__account"><span className="k-admin__avatar" aria-hidden="true">K</span><div><strong>Minha conta</strong><small>Administração</small></div></div></div></aside></>;}

function MobileNavigation({open,onMenu}:Readonly<{open:boolean;onMenu:()=>void}>):React.JSX.Element{return <nav className="k-admin__mobile-nav" aria-label="Atalhos do painel"><Link to="/admin" activeOptions={{exact:true}} activeProps={{"data-status":"active"}}><DashboardIcon name="home"/><span>Início</span></Link><Link to="/admin/orders" activeOptions={{exact:false}} activeProps={{"data-status":"active"}}><DashboardIcon name="orders"/><span>Pedidos</span></Link><Link to="/admin/products" activeOptions={{exact:false}} activeProps={{"data-status":"active"}}><DashboardIcon name="products"/><span>Produtos</span></Link><Link to="/admin/store" activeOptions={{exact:false}} activeProps={{"data-status":"active"}}><DashboardIcon name="store"/><span>Loja</span></Link><button type="button" onClick={onMenu} aria-controls="merchant-navigation" aria-expanded={open}><DashboardIcon name="menu"/><span>Menu</span></button></nav>;}

export function AdminShell({children,storefrontUrl}:Readonly<{children:ReactNode;storefrontUrl:string|null}>):React.JSX.Element{const[mobileOpen,setMobileOpen]=useState(false);const openerRef=useRef<HTMLElement|null>(null);function openMenu():void{openerRef.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setMobileOpen(true);}useEffect(()=>{if(!mobileOpen)return undefined;const previous=document.body.style.overflow;const drawer=document.getElementById("merchant-navigation");const firstFocusable=drawer?.querySelector<HTMLElement>(FOCUSABLE);if(firstFocusable)firstFocusable.focus();function onKeyDown(event:KeyboardEvent):void{if(event.key==="Escape"){event.preventDefault();setMobileOpen(false);return;}if(event.key!=="Tab"||!drawer)return;const items=[...drawer.querySelectorAll<HTMLElement>(FOCUSABLE)];if(!items.length)return;const first=items[0];const last=items.at(-1);if(event.shiftKey&&(document.activeElement===first||!drawer.contains(document.activeElement))){event.preventDefault();if(last)last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}document.body.style.overflow="hidden";window.addEventListener("keydown",onKeyDown);return()=>{document.body.style.overflow=previous;window.removeEventListener("keydown",onKeyDown);if(openerRef.current)openerRef.current.focus();};},[mobileOpen]);return <section className="k-admin"><a className="k-skip" href="#merchant-content">Ir para o conteúdo</a><AdminSidebar open={mobileOpen} storefrontUrl={storefrontUrl} onClose={()=>{setMobileOpen(false);}}/><div className="k-admin__main"><header className="k-admin__topbar"><button className="k-admin__menu" type="button" onClick={openMenu} aria-label="Abrir menu" aria-expanded={mobileOpen} aria-controls="merchant-navigation"><DashboardIcon name="menu"/></button><div className="k-admin__topbar-title"><span>MINHA LOJA</span><strong>Venda sem complicação.</strong></div><div className="k-admin__topbar-actions"><Link to="/admin/products/new" className="k-admin__topbar-create">+ Novo produto</Link>{storefrontUrl?<a href={storefrontUrl} target="_blank" rel="noreferrer">Ver catálogo ↗</a>:<Link to="/admin/store/catalog">Configurar catálogo →</Link>}</div></header><main className="k-admin__content" id="merchant-content">{children}</main></div><MobileNavigation open={mobileOpen} onMenu={openMenu}/></section>;}

export function PageHead(props:Readonly<{title:string;description:string;action?:ReactNode}>):React.JSX.Element{return <header className="k-page__head"><div className="k-page__head-copy"><span className="k-section-kicker">MINHA LOJA / {props.title}</span><h1>{props.title}</h1><p>{props.description}</p></div>{props.action?<div className="k-page__head-action">{props.action}</div>:null}</header>;}
