# Admin rebuild

This directory is the new UI boundary for `/admin`.

- Data, auth, tenant/store isolation and server functions remain outside this directory.
- New UI uses scoped tokens and CSS Modules.
- No `k-*` legacy classes are allowed here.
- No text arrows or emoji are used as icons.
- Product editing is designed as a single reading column with Basic, Photos, Price and stock, Variations and Publication sections.
