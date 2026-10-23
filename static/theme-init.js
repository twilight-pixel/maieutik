// Applique les réglages d'affichage avant le premier affichage (évite un flash de thème et un
// saut de mise en page). Script externe : la CSP n'autorise aucun script inline. Sans choix
// enregistré ou sans JavaScript, le thème du système (prefers-color-scheme) et les tailles par
// défaut s'appliquent. Les valeurs acceptées sont les mêmes que dans
// src/lib/client/theme.svelte.ts et reading-view.svelte.ts.
try {
	var theme = localStorage.getItem('maieutik-theme');
	if (theme === 'light' || theme === 'sepia' || theme === 'dark') {
		document.documentElement.dataset.theme = theme;
	}
	var view = JSON.parse(localStorage.getItem('maieutik-view') || '{}');
	var allowed = {
		size: ['s', 'l', 'xl'],
		measure: ['narrow', 'wide'],
		leading: ['tight', 'loose']
	};
	var attribute = { size: 'textSize', measure: 'measure', leading: 'leading' };
	for (var field in allowed) {
		if (allowed[field].indexOf(view[field]) !== -1) {
			document.documentElement.dataset[attribute[field]] = view[field];
		}
	}
} catch {
	// Stockage indisponible (Tor Browser) ou valeur illisible : réglages par défaut.
}
