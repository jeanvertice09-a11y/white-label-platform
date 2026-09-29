export function Card(props: { title: string; description: string }): string {
  return `<section><h2>${props.title}</h2><p>${props.description}</p></section>`;
}
