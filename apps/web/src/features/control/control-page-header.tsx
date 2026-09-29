import type { ReactNode } from "react";

export function ControlPageHeader(props: Readonly<{
  kicker: string;
  title: string;
  description: string;
  aside?: ReactNode;
}>): React.JSX.Element {
  return <div className="control-page-header">
    <div><span className="console-page-kicker">{props.kicker}</span><h1>{props.title}</h1><p>{props.description}</p></div>
    {props.aside ? <div className="control-page-context">{props.aside}</div> : null}
  </div>;
}
