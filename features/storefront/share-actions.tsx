import { useState } from "react";

async function copyLink(url: string): Promise<void> {
  await navigator.clipboard.writeText(url);
}

export function ShareActions(props: Readonly<{ title: string; url?: string }>): React.JSX.Element {
  const [status, setStatus] = useState("");
  const url = props.url ?? (typeof window === "undefined" ? "" : window.location.href);

  async function copy(): Promise<void> {
    try {
      await copyLink(url);
      setStatus("Link copiado.");
    } catch {
      setStatus("Não foi possível copiar o link.");
    }
  }

  async function share(): Promise<void> {
    try {
      await navigator.share({ title: props.title, url });
      setStatus("");
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
    await copy();
  }

  return <div className="sf__share-actions">
    <button className="sf__text-button" type="button" onClick={() => { void share(); }}>Compartilhar</button>
    <button className="sf__text-button" type="button" onClick={() => { void copy(); }}>Copiar link</button>
    {status ? <span className="sf__meta" role="status">{status}</span> : null}
  </div>;
}
