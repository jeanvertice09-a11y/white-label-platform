import { EmptyState } from "../../admin/ui/EmptyState.tsx";
import { Skeleton } from "../../admin/ui/Skeleton.tsx";

export function AdminRoutePending(): React.JSX.Element { return <div aria-label="Carregando dados da loja"><Skeleton height={18} /><Skeleton height={72} /><Skeleton height={72} /></div>; }
export function AdminRouteError(props: Readonly<{ error: unknown }>): React.JSX.Element { const message = props.error instanceof Error ? props.error.message : "Não foi possível carregar esta área."; return <EmptyState title="Área indisponível" description={message} />; }
export function AdminFeatureUnavailable(props: Readonly<{ title: string; description: string }>): React.JSX.Element { return <EmptyState title={props.title} description={props.description} />; }
