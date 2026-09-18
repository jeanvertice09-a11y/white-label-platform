import type {
  Campaign,
  CampaignDetail,
  CampaignMutationInput,
  CampaignSegmentType,
} from "@white-label/marketing";

function field(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function toIso(value: string): string | null {
  const text = value.trim();
  return text ? new Date(text).toISOString() : null;
}

export function readCampaign(form: FormData): CampaignMutationInput {
  const rawSegment = field(form, "segmentType");
  const segmentType: CampaignSegmentType =
    rawSegment === "with_orders" || rawSegment === "without_orders"
      ? rawSegment
      : "all";
  return {
    name: field(form, "name"),
    content: field(form, "content"),
    segmentType,
    scheduledAt: toIso(field(form, "scheduledAt")),
  };
}

export function CampaignFields({
  campaign,
}: Readonly<{ campaign?: Campaign }>): React.JSX.Element {
  return (
    <div className="k-form__grid">
      <div className="k-field">
        <label>Nome</label>
        <input name="name" defaultValue={campaign?.name ?? ""} required />
      </div>
      <div className="k-field">
        <label>Público</label>
        <select
          name="segmentType"
          defaultValue={campaign?.segmentType ?? "all"}
        >
          <option value="all">Todos com opt-in</option>
          <option value="with_orders">Com pedidos</option>
          <option value="without_orders">Sem pedidos</option>
        </select>
      </div>
      <div className="k-field">
        <label>Agendamento</label>
        <input
          name="scheduledAt"
          type="datetime-local"
          defaultValue={campaign?.scheduledAt?.slice(0, 16) ?? ""}
        />
      </div>
      <div className="k-field k-field--full">
        <label>Conteúdo</label>
        <textarea
          name="content"
          defaultValue={campaign?.content ?? ""}
          maxLength={5000}
          required
          rows={5}
        />
      </div>
    </div>
  );
}

export function CampaignComposer({
  busy,
  save,
}: Readonly<{
  busy: boolean;
  save: (event: React.SyntheticEvent<HTMLFormElement>) => Promise<void>;
}>): React.JSX.Element {
  return (
    <form
      className="k-card k-form"
      onSubmit={(event) => {
        void save(event);
      }}
    >
      <h2>Nova campanha</h2>
      <CampaignFields />
      <div className="k-actions">
        <button
          className="k-button k-button--primary"
          disabled={busy}
          type="submit"
        >
          Criar campanha
        </button>
      </div>
    </form>
  );
}

export function CampaignSearch({
  busy,
  search,
  setSearch,
  reload,
}: Readonly<{
  busy: boolean;
  search: string;
  setSearch: (value: string) => void;
  reload: (page?: number) => Promise<void>;
}>): React.JSX.Element {
  return (
    <form
      className="k-card k-actions"
      onSubmit={(event) => {
        event.preventDefault();
        void reload(1);
      }}
    >
      <input
        aria-label="Buscar campanhas"
        onChange={(event) => {
          setSearch(event.currentTarget.value);
        }}
        placeholder="Buscar campanha"
        value={search}
      />
      <button className="k-button" disabled={busy} type="submit">
        Buscar
      </button>
    </form>
  );
}

export function CampaignPagination({
  busy,
  page,
  pageSize,
  total,
  reload,
}: Readonly<{
  busy: boolean;
  page: number;
  pageSize: number;
  total: number;
  reload: (page?: number) => Promise<void>;
}>): React.JSX.Element {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="k-actions">
      <button
        className="k-button"
        disabled={busy || page <= 1}
        onClick={() => {
          void reload(page - 1);
        }}
        type="button"
      >
        Anterior
      </button>
      <span>
        Página {page} de {lastPage}
      </span>
      <button
        className="k-button"
        disabled={busy || page >= lastPage}
        onClick={() => {
          void reload(page + 1);
        }}
        type="button"
      >
        Próxima
      </button>
    </div>
  );
}

export function statusLabel(status: Campaign["status"]): string {
  if (status === "draft") return "Rascunho";
  if (status === "prepared") return "Preparada";
  if (status === "scheduled") return "Agendada";
  return "Cancelada";
}

export function CampaignDetailView({
  detail,
}: Readonly<{ detail: CampaignDetail }>): React.JSX.Element {
  return (
    <div className="k-stack">
      <p>
        <strong>Destinatários:</strong> {detail.recipientCount}
      </p>
      <p>
        <strong>Conteúdo:</strong> {detail.content}
      </p>
      <div>
        <strong>Histórico</strong>
        <ul>
          {detail.history.map((item) => (
            <li key={`${item.action}-${item.createdAt}`}>
              {item.action} · {new Date(item.createdAt).toLocaleString()}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <strong>Fila</strong>
        {detail.recipients.length === 0 ? (
          <p>Nenhum destinatário preparado.</p>
        ) : (
          <ul>
            {detail.recipients.map((recipient) => (
              <li key={recipient.id}>
                {recipient.customerName} · {recipient.status}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
