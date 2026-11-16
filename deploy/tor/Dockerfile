# Démon Tor du service onion. Paquet Debian signé, base épinglée par digest.
FROM debian:trixie-slim@sha256:a72b4433de1cf7d6bae0c4cee74d0547f58601a643b3375f070c51600d63b6b2

RUN apt-get update \
 && apt-get install -y --no-install-recommends tor \
 && rm -rf /var/lib/apt/lists/* \
 && install -d -o debian-tor -g debian-tor -m 0700 /var/lib/tor

COPY torrc /etc/tor/torrc

USER debian-tor
ENTRYPOINT ["tor", "-f", "/etc/tor/torrc"]
