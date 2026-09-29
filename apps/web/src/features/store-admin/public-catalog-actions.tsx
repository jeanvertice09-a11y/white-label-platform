import { useState } from "react";

type ShareCapableNavigator = Omit<Navigator, "share"> & {
  share?: Navigator["share"];
};

export function PublicCatalogActions(props: Readonly<{ url: string; storeName: string }>): React.JSX.Element {
  const [status, setStatus] = useState("");

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(props.url);
      setStatus("Link copiado.");
    } catch {
      setStatus("Não foi possível copiar o link.");
    }
  }

  async function share(): Promise<void> {
    const shareFn = (navigator as ShareCapableNavigator).share;
    if (typeof shareFn !== "function") {
      await copy();
      return;
    }
    try {
      await shareFn.call(navigator, { title: props.storeName, url: props.url });
      setStatus("Compartilhamento aberto.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      await copy();
    }
  }

  return (
    <div className="k-actions">
      {status ? <span className="k-status" role="status">{status}</span> : null}
      <button className="k-button" type="button" onClick={() => { void copy(); }}>Copiar URL</button>
      <button className="k-button k-button--primary" type="button" onClick={() => { void share(); }}>Compartilhar catálogo</button>
    </div>
  );
}
