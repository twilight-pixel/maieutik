# Démon Tor du service onion. Paquet Debian signé, base épinglée par digest.
FROM debian:trixie-slim@sha256:62bd423aeee912639ca8ee681c2b762cb3e25137e0a92b20be455898a9f034ad

RUN apt-get update \
 && apt-get install -y --no-install-recommends tor \
 && rm -rf /var/lib/apt/lists/* \
 && install -d -o debian-tor -g debian-tor -m 0700 /var/lib/tor

COPY torrc /etc/tor/torrc

USER debian-tor
ENTRYPOINT ["tor", "-f", "/etc/tor/torrc"]
