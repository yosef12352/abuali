# Abu Ali Chat TURN deployment

This is a **self-hosted** TURN service for a Linux VPS with a public IPv4 address and Docker Compose. Vercel and Supabase Edge Functions cannot host this UDP/TCP relay.

1. Provision a VPS with a public IPv4 address. Open inbound **UDP and TCP 3478** and **UDP 49160-49260** in the provider firewall and OS firewall.
2. In this directory create a local `.env` (never commit):
   - `TURN_REALM=turn.example.com`
   - `TURN_PUBLIC_IP=<public IPv4>`
   - `TURN_SHARED_SECRET=<random 32+ byte secret>`
3. Run `docker compose up -d` on that VPS. Check `docker compose logs --tail=100 coturn`.
4. In Supabase Edge Function secrets for project `xgoggkcwmagghkdzvjqz`, set:
   - `CHAT_TURN_URL=turn:<public IPv4>:3478?transport=udp`
   - `CHAT_TURN_SHARED_SECRET=<same secret>`
5. The deployed `chat-turn-credentials` function validates the signed-in user and generates 1-hour TURN credentials; it does not store credentials in browser code.
6. Test on two separate networks (e.g. Wi-Fi and mobile data), verify `relay` candidate pairs in WebRTC diagnostics, and test group calls. Until then do not mark TURN as operational.

**Security:** rotate the shared secret if leaked. Restrict SSH, keep the OS updated, and do not expose TURN management CLI. For production, add TLS/TURNS on TCP 5349 with a valid certificate and extend the endpoint to return the secure URL.

**Cost:** a VPS is not necessarily free and can incur bandwidth charges. Do not provision paid infrastructure without reviewing the price.
