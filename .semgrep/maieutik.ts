// Cas de test des règles .semgrep/maieutik.yml (semgrep --test .semgrep/).

export function ip(event: any, req: any) {
	// ruleid: maieutik-no-client-address
	const a = event.getClientAddress();
	// ruleid: maieutik-no-client-address
	const b = req.socket.remoteAddress;
	// ruleid: maieutik-no-client-address
	const c = event.request.headers.get('X-Forwarded-For');
	// ruleid: maieutik-no-client-address
	const d = req.headers['x-real-ip'];
	// ok: maieutik-no-client-address
	const e = event.request.headers.get('accept-language');
	return [a, b, c, d, e];
}

export function html(el: HTMLElement, s: string) {
	// ruleid: maieutik-no-raw-html-dom
	el.innerHTML = s;
	// ruleid: maieutik-no-raw-html-dom
	el.insertAdjacentHTML('beforeend', s);
	// ok: maieutik-no-raw-html-dom
	el.textContent = s;
}

export function dynamic(s: string) {
	// ruleid: maieutik-no-dynamic-code
	eval(s);
	// ruleid: maieutik-no-dynamic-code
	new Function(s);
	// ok: maieutik-no-dynamic-code
	setTimeout(() => s, 10);
}

export function random() {
	// ruleid: maieutik-no-math-random
	const delay = Math.random() * 86400;
	// ok: maieutik-no-math-random
	const safe = crypto.getRandomValues(new Uint32Array(1))[0];
	return delay + safe;
}

// ruleid: maieutik-crypto-boundary
import { ed25519 } from '@noble/curves/ed25519';
// ruleid: maieutik-crypto-boundary
import * as bip39 from '@scure/bip39';
// ok: maieutik-crypto-boundary
import { signText } from '#lib/shared/signature';

export async function network() {
	// ruleid: maieutik-no-external-fetch
	await fetch('https://cdn.example.com/x.json');
	// ruleid: maieutik-no-external-fetch
	await fetch('//cdn.example.com/x.json');
	// ruleid: maieutik-no-external-fetch
	navigator.sendBeacon('/stats', '');
	// ok: maieutik-no-external-fetch
	await fetch('/api/texts');
	return [ed25519, bip39, signText];
}

export function dates(d: Date) {
	// ruleid: maieutik-no-time-display
	d.toLocaleTimeString('fr');
	// ruleid: maieutik-no-time-display
	new Intl.DateTimeFormat('fr', { day: 'numeric', hour: '2-digit' });
	// ruleid: maieutik-no-time-display
	d.toLocaleString('en', { dateStyle: 'long', timeStyle: 'short' });
	// ok: maieutik-no-time-display
	new Intl.DateTimeFormat('fr', { dateStyle: 'long' });
	// ok: maieutik-no-time-display
	d.toLocaleDateString('fr');
}

export function logs(event: any, logger: any, middleware: any, expect: any) {
	// ruleid: maieutik-no-request-logging
	console.log('requête', event.request);
	// ruleid: maieutik-no-request-logging
	logger.warn({ h: event.request.headers });
	// ok: maieutik-no-request-logging
	logger.error('signature invalide', { code: 'E_SIG' });
	// ok: maieutik-no-request-logging
	middleware(event.request, () => null);
	// ok: maieutik-no-request-logging
	expect(event.request.headers).toBeDefined();
}

// ruleid: maieutik-no-address-header-config
const env = { ADDRESS_HEADER: 'x-forwarded-for' };
export { env };
