import type { ReactNode } from "react";

export function PageHead({ title, description, action }: Readonly<{ title: string; description: string; action?: ReactNode }>): React.JSX.Element {
  return <header className="k-page__head">
    <div className="k-page__head-copy">
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
    {action ? <div className="k-page__head-action">{action}</div> : null}
  </header>;
}
