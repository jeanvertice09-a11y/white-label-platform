import { createFileRoute } from "@tanstack/react-router";
import { loadMasterContext } from "../../lib/client-guard.ts";
import { AccessDenied } from "../-access-denied.tsx";
import { PageHeader } from "@white-label/ui";
import { SectionHeader } from "@white-label/ui";
import { Card } from "@white-label/ui";
import { Button } from "@white-label/ui";
import { Input } from "@white-label/ui";
import { Label } from "@white-label/ui";
import { Divider } from "@white-label/ui";

const settingsCategories = [
  { id: "general", label: "Geral", icon: SettingsIcon },
  { id: "security", label: "Segurança", icon: SecurityIcon },
  { id: "domains", label: "Domínios", icon: DomainsIcon },
  { id: "integrations", label: "Integrações", icon: IntegrationsIcon },
  { id: "communication", label: "Comunicação", icon: CommunicationIcon },
  { id: "billing", label: "Billing interno", icon: BillingIcon },
];

function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83 2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06-.06a1.65 1.65 0 0 0 1.82-.33 1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06.06a1.65 1.65 0 0 0-1.82.33 1.65 1.65 0 0 0-1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06.06a1.65 1.65 0 0 0-1.82.33 1.65 1.65 0 0 0-1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06.06a1.65 1.65 0 0 0-1.82.33 1.65 1.65 0 0 0-1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06.06a1.65 1.65 0 0 0-1.82.33 1.65 1.65 0 0 0-1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06.06a1.65 1.65 0 0 0-1.82.33 1.65 1.65 0 0 0-1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06.06a1.65 1.65 0 0 0-1.82.33 1.65 1.65 0 0 0-1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06.06a1.65 1.65 0 0 0-1.82.33 1.65 1.65 0 0 0-1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51" />
    </svg>
  );
}

function SecurityIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
    </svg>
  );
}

function DomainsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function IntegrationsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <path d="M22 9V3a2 2 0 0 0-2-2h-6" />
    </svg>
  );
}

function CommunicationIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function BillingIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

export const Route = createFileRoute("/master/settings")({
  loader: () => loadMasterContext(),
  errorComponent: AccessDenied,
  component: () => (
    <>
      <PageHeader
        title="Configurações"
        description="Gerencie as configurações globais da plataforma Kataluu."
      />
      <div className="grid-auto-fit">
        {settingsCategories.map((category) => (
          <Card key={category.id} padding="md" className="h-full hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--color-primary-muted)] text-[var(--color-primary)]">
                {category.icon}
              </div>
              <div>
                <h3 className="font-semibold text-[var(--color-foreground)]">
                  {category.label}
                </h3>
                <p className="text-sm text-[var(--color-foreground-muted)]">
                  Configurar {category.label.toLowerCase()}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Divider className="my-8" />

      <SectionHeader
        title="Geral"
        description="Configurações básicas da plataforma"
        action={<Button variant="secondary">Salvar alterações</Button>}
      />

      <Card padding="md">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="platform-name">Nome da plataforma</Label>
              <Input id="platform-name" placeholder="Kataluu" defaultValue="Kataluu" />
            </div>
            <div>
              <Label htmlFor="platform-url">URL base</Label>
              <Input id="platform-url" type="url" placeholder="https://kataluu.com.br" defaultValue="https://kataluu.com.br" />
            </div>
          </div>

          <div>
            <Label htmlFor="support-email">E-mail de suporte</Label>
            <Input id="support-email" type="email" placeholder="suporte@kataluu.com.br" defaultValue="suporte@kataluu.com.br" />
          </div>

          <div>
            <Label htmlFor="default-language">Idioma padrão</Label>
            <Input id="default-language" placeholder="pt-BR" defaultValue="pt-BR" />
          </div>

          <div>
            <Label htmlFor="timezone">Fuso horário</Label>
            <Input id="timezone" placeholder="America/Sao_Paulo" defaultValue="America/Sao_Paulo" />
          </div>
        </div>
      </Card>

      <Divider className="my-8" />

      <SectionHeader
        title="Segurança"
        description="Configurações de autenticação e acesso"
      />

      <Card padding="md">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-[var(--color-foreground)]">Autenticação de dois fatores (2FA)</h4>
              <p className="text-sm text-[var(--color-foreground-muted)]">
                Exigir 2FA para todos os administradores da plataforma
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-[var(--color-neutral-300)] peer-focus:ring-2 peer-focus:ring-[var(--color-primary)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-[var(--color-foreground)]">Expiração de sessão</h4>
              <p className="text-sm text-[var(--color-foreground-muted)]">
                Tempo de inatividade antes do logout automático
              </p>
            </div>
            <Input type="number" placeholder="30" defaultValue="30" className="w-24" />
            <span className="text-sm text-[var(--color-foreground-muted)]">minutos</span>
          </div>
        </div>
      </Card>
    </>
  ),
});