# Admin inventory mutation integrity

Stock mutations in the merchant admin follow a strict feedback contract:

1. Disable conflicting form actions while the mutation is running.
2. Apply the server-side stock mutation with an idempotent operation ID.
3. Refresh the inventory and history views before publishing success.
4. Reset the form only after the refresh completes.
5. Keep mutation/refresh failures visible as errors and preserve the entered form values for retry.

This prevents the UI from claiming success while still showing stale stock data and avoids discarding operator input when reconciliation fails.
