import type { PublicStoreProfile } from "@white-label/catalog";

function phoneHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function StorefrontFooter(props: Readonly<{ storeName: string; profile?: PublicStoreProfile }>): React.JSX.Element {
  const profile = props.profile;
  return (
    <footer className="sf__footer">
      <strong>{props.storeName}</strong>
      {profile?.description ? <span>{profile.description}</span> : <span>Catálogo e pedidos online</span>}
      {profile?.phone ? <a href={phoneHref(profile.phone)}>{profile.phone}</a> : null}
      {profile?.publicEmail ? <a href={`mailto:${profile.publicEmail}`}>{profile.publicEmail}</a> : null}
      {profile?.address ? <span>{profile.address}</span> : null}
      {profile?.instagram ? <a href={`https://www.instagram.com/${profile.instagram}/`} target="_blank" rel="noreferrer">@{profile.instagram}</a> : null}
    </footer>
  );
}
