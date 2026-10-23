/**
 * Contenu des données de test (voir scripts/seed.ts). Chargé par Vite : les imports
 * du code partagé se font sans extension, comme dans le reste de src/lib/shared.
 */
import { displayHandle } from '../src/lib/shared/identity';
import { solveChallenge, type PowChallenge } from '../src/lib/shared/pow';
import { sign } from '../src/lib/shared/signature';
import type { QuestionPayload, TextVersionPayload } from '../src/lib/shared/payloads';
import {
	aspasie,
	diotime,
	doc,
	em,
	h2,
	id,
	list,
	menon,
	p,
	quote,
	ref,
	source,
	theetete,
	type QuestionSeed,
	type TextSeed
} from './seed-kit';
import { LONG_TEXTS } from './seed-long';

// --- Questions et textes ------------------------------------------------------------------

const QUESTIONS: QuestionSeed[] = [
	{
		key: 'q-vertu',
		by: diotime,
		title: 'Peut-on bien agir sans savoir ce qu’est le bien ?',
		category: 'philosophy/ethics',
		lang: 'fr',
		context:
			'Dans le Ménon, Socrate refuse de dire si la vertu s’enseigne avant d’avoir établi ce qu’elle est. ' +
			'Mais l’artisan honnête, le juge scrupuleux, le simple passant qui rend un portefeuille : agissent-ils bien sans le savoir ?'
	},
	{
		key: 'q-tirage',
		by: aspasie,
		title: 'Faut-il tirer au sort une assemblée ?',
		category: 'politics/institutions',
		lang: 'fr',
		context:
			'Plusieurs pays expérimentent des assemblées citoyennes dont les membres sont tirés au sort. ' +
			'Doivent-elles rester consultatives, ou peut-on leur confier une part du pouvoir de décider ?'
	},
	{
		key: 'q-machine',
		by: menon,
		title: 'Une machine peut-elle comprendre ce qu’elle dit ?',
		category: 'technology/artificial-intelligence',
		lang: 'fr',
		context:
			'Un programme peut tenir une conversation convaincante. Qu’est-ce qui, au juste, distinguerait ' +
			'comprendre une phrase de produire la réponse attendue ?'
	},
	{
		key: 'q-ecole',
		by: theetete,
		title: 'Enseigner, est-ce transmettre un savoir ou aider à l’accoucher ?',
		category: 'society/education',
		lang: 'fr',
		context:
			'Dans le Théétète, Socrate se compare à une sage-femme : il n’enfante rien lui-même, ' +
			'il aide les autres à mettre au monde leurs idées. Cette image vaut-elle pour une classe ?'
	}
];

const MENON = source(1, 'Ménon', 'Platon', null);
const THEETETE = source(1, 'Théétète', 'Platon', null);

const TEXTS: TextSeed[] = [
	// --- Peut-on bien agir sans savoir ce qu'est le bien ? ---------------------------------
	{
		key: 't-agir-d-abord',
		by: menon,
		title: 'On devient juste en agissant, pas en définissant',
		category: 'philosophy/ethics',
		kind: 'opinion',
		tags: ['action', 'vertu'],
		question: 'q-vertu',
		body: doc(
			p(
				'Personne n’a attendu une définition de la justice pour être juste. Le boulanger qui rend la monnaie, ' +
					'la voisine qui garde l’enfant d’une autre : on les dirait vertueux sans leur demander de preuve.'
			),
			p(
				'Exiger la définition avant l’acte, c’est renverser l’ordre. Les définitions viennent après, ' +
					'comme des tentatives de dire ce que nous faisions déjà. ',
				em('Je soutiens que l’on apprend la vertu comme on apprend à nager : dans l’eau.')
			)
		)
	},
	{
		key: 't-chance',
		by: aspasie,
		title: 'Sans science du bien, la bonne action reste un coup de chance',
		category: 'philosophy/ethics',
		kind: 'essay',
		tags: ['connaissance', 'vertu'],
		question: 'q-vertu',
		sources: [MENON],
		body: doc(
			p(
				'Celui qui agit bien sans savoir pourquoi n’agit pas mal, certes. Mais ce qui le fait agir ' +
					'bien n’est pas en lui : c’est une rencontre heureuse entre ses habitudes et la situation ',
				ref('(Ménon, 97a-b)'),
				'.'
			),
			p(
				'Un guide qui connaît la route et un guide qui l’a prise par hasard nous mènent tous deux à Larissa. ' +
					'Mais quand la route bifurque, seul le premier sait où aller.'
			),
			p('La question reste donc ouverte : que perd-on, au juste, quand on agit bien sans savoir ?')
		)
	},
	{
		key: 't-artisan',
		by: theetete,
		title: 'L’artisan sait ce qu’il fait ; votre juste, non',
		category: 'philosophy/ethics',
		kind: 'critique',
		tags: ['artisan', 'technique'],
		relation: { kind: 'refutes', target: 't-agir-d-abord' },
		body: doc(
			p(
				'Le texte compare la vertu à la nage. Or celui qui nage sait nager : il peut montrer son geste, ' +
					'le corriger, l’apprendre à un autre. Le « juste » du texte ne peut rien de tout cela.'
			),
			p(
				'Il faut donc choisir. Ou bien la vertu est un savoir-faire, et alors elle se définit et s’enseigne ; ' +
					'ou bien elle n’en est pas un, et il faut dire ce qui la distingue d’une simple habitude.'
			)
		)
	},
	{
		key: 't-savoir-faire',
		by: menon,
		title: 'Savoir nager n’est pas savoir définir la nage',
		category: 'philosophy/ethics',
		kind: 'opinion',
		tags: ['savoir-faire'],
		relation: { kind: 'refutes', target: 't-artisan' },
		body: doc(
			p(
				'L’objection suppose que savoir faire implique savoir dire. Or on connaît tous des praticiens ' +
					'incapables d’expliquer ce qu’ils font, et qui font pourtant très bien.'
			),
			p('Qu’est-ce qui, dans votre exemple, interdit à la vertu d’être de cette sorte-là ?')
		)
	},
	{
		key: 't-opinion-vraie',
		by: diotime,
		title: 'L’opinion vraie guide aussi bien que la science',
		category: 'philosophy/ethics',
		kind: 'essay',
		tags: ['connaissance', 'opinion vraie'],
		relation: { kind: 'refutes', target: 't-chance' },
		sources: [MENON],
		body: doc(
			p(
				'Socrate lui-même le concède dans le dialogue : tant qu’elle est vraie, une opinion conduit ' +
					'aussi bien qu’un savoir ',
				ref('(Ménon, 97c)'),
				'. La différence ne tient pas à l’efficacité de l’action.'
			),
			p(
				'Si la bonne action est un « coup de chance », alors la science du bien n’ajoute rien à ce que fait ' +
					'le juste : elle ne lui sert que pour se justifier. Faut-il alors dire que la justification est tout ce qui compte ?'
			)
		)
	},
	{
		key: 't-dedale',
		by: theetete,
		title: 'Les statues de Dédale : pourquoi la science tient',
		category: 'philosophy/ethics',
		kind: 'essay',
		tags: ['connaissance', 'dédale'],
		relation: { kind: 'complements', target: 't-chance' },
		sources: [MENON],
		body: doc(
			p(
				'Pour dire ce qu’ajoute la science à l’opinion vraie, Socrate use d’une image : les statues de Dédale ' +
					's’enfuyaient si on ne les attachait pas ',
				ref('(Ménon, 97d-98a)'),
				'. Les opinions vraies font de même : elles restent un moment, puis partent.'
			),
			p(
				'Ce qui les attache, c’est le raisonnement sur la cause. C’est cela que le texte précédent appelle « science ».'
			)
		)
	},
	{
		key: 't-confiance',
		by: diotime,
		title: 'Et si les statues qui s’enfuient étaient une affaire de confiance ?',
		category: 'philosophy/ethics',
		kind: 'hypothesis',
		tags: ['confiance', 'dédale'],
		relation: { kind: 'reinterprets', target: 't-dedale' },
		body: doc(
			p(
				'Relisons l’image. Une opinion vraie « s’enfuit » quand quelqu’un la conteste et que nous ne savons pas répondre. ' +
					'Ce qui manque alors n’est peut-être pas une cause, mais la capacité de tenir devant une question.'
			),
			p(
				'Hypothèse : savoir, c’est pouvoir être questionné sans s’effondrer. Comment éprouver cela ?'
			)
		)
	},

	// --- Faut-il tirer au sort une assemblée ? -----------------------------------------------
	{
		key: 't-tirage-pour',
		by: diotime,
		title: 'Le tirage au sort donne une voix égale à chacun',
		category: 'politics/institutions',
		kind: 'essay',
		tags: ['démocratie', 'tirage au sort'],
		question: 'q-tirage',
		sources: [source(1, 'Contre les élections', 'David Van Reybrouck', '2014', 'Actes Sud')],
		body: doc(
			h2('L’argument'),
			p(
				'Une élection choisit des personnes qui savent se faire élire. Un tirage au sort choisit n’importe qui : ' +
					'c’est précisément ce qui lui permet de refléter la société, sans filtre de réseau ni de moyens ',
				ref('(Van Reybrouck)'),
				'.'
			),
			h2('Ce qu’il faudrait vérifier'),
			list(
				'qu’un échantillon tiré au sort délibère mieux qu’un parlement élu ;',
				'qu’il garde une légitimité aux yeux de ceux qui n’ont pas été tirés ;',
				'qu’il ne devienne pas la proie de ceux qui l’informent.'
			)
		)
	},
	{
		key: 't-election',
		by: theetete,
		title: 'L’élection reste le seul moyen de demander des comptes',
		category: 'politics/institutions',
		kind: 'opinion',
		tags: ['démocratie', 'élection'],
		question: 'q-tirage',
		body: doc(
			p(
				'Ce qui fait la démocratie, ce n’est pas l’égalité de chances d’être choisi, mais la possibilité de renvoyer ' +
					'ceux qui ont mal gouverné.'
			),
			p(
				'Qui renverra un tiré au sort ? Et à quoi sert une voix égale si l’on ne peut jamais la reprendre ?'
			)
		)
	},
	{
		key: 't-irlande',
		by: menon,
		title: 'Irlande : l’assemblée citoyenne de 2016-2018',
		category: 'politics/institutions',
		kind: 'fact',
		tags: ['irlande', 'référendum'],
		warnings: ['sensitive-topics'],
		relation: { kind: 'provides-evidence', target: 't-tirage-pour' },
		sources: [
			source(1, 'The Citizens’ Assembly', null, '2018', null, 'https://citizensassembly.ie/')
		],
		body: doc(
			p(
				'Entre 2016 et 2018, une assemblée de 99 citoyens tirés au sort, présidée par une magistrate, a examiné ' +
					'le huitième amendement de la Constitution irlandaise ',
				ref('(site de l’assemblée)'),
				'.'
			),
			p(
				'Ses recommandations ont été reprises par une commission parlementaire, puis soumises à référendum en mai 2018. ' +
					'Le résultat n’est pas la preuve que le tirage au sort « marche » : il montre qu’une assemblée tirée au sort ' +
					'peut débloquer une question que les partis évitaient.'
			)
		)
	},
	{
		key: 't-comptes',
		by: theetete,
		title: 'Un échantillon tiré au sort n’a de comptes à rendre à personne',
		category: 'politics/institutions',
		kind: 'critique',
		tags: ['responsabilité', 'tirage au sort'],
		relation: { kind: 'refutes', target: 't-tirage-pour' },
		body: doc(
			p(
				'L’égalité devant le sort est une égalité d’entrée. Elle ne dit rien de la sortie : une fois la session terminée, ' +
					'personne ne peut sanctionner ni récompenser les membres.'
			),
			p('Une décision sans responsable est-elle encore une décision politique ?')
		)
	},
	{
		key: 't-mandat-bref',
		by: aspasie,
		title: 'La responsabilité peut se loger ailleurs que dans la réélection',
		category: 'politics/institutions',
		kind: 'essay',
		tags: ['responsabilité', 'tirage au sort'],
		relation: { kind: 'replies-to', target: 't-comptes' },
		body: doc(
			p(
				'La réélection n’est qu’une forme de reddition de comptes parmi d’autres. Un mandat bref, non renouvelable, ' +
					'des délibérations publiques et motivées en sont d’autres.'
			),
			p(
				'Reste à savoir si ces formes suffisent. Quelle serait, selon vous, la condition minimale pour qu’une ' +
					'assemblée tirée au sort soit « responsable » ?'
			)
		)
	},
	{
		key: 't-election-en',
		by: theetete,
		title: 'Elections remain the only way to hold power to account',
		category: 'politics/institutions',
		kind: 'opinion',
		lang: 'en',
		tags: ['accountability', 'election'],
		relation: { kind: 'translation-of', target: 't-election' },
		body: doc(
			p(
				'What makes a democracy is not an equal chance of being chosen, but the ability to remove those who governed badly.'
			),
			p(
				'Who will remove a person chosen by lot? And what is an equal voice worth if it can never be taken back?'
			)
		)
	},

	// --- Une machine peut-elle comprendre ce qu'elle dit ? ------------------------------------
	{
		key: 't-chambre',
		by: menon,
		title: 'Manipuler des symboles n’est pas comprendre',
		category: 'technology/artificial-intelligence',
		kind: 'essay',
		tags: ['chambre chinoise', 'compréhension'],
		question: 'q-machine',
		sources: [
			source(
				1,
				'Minds, Brains, and Programs',
				'John R. Searle',
				'1980',
				'Behavioral and Brain Sciences'
			)
		],
		body: doc(
			p(
				'Imaginons un homme enfermé dans une pièce, qui reçoit des idéogrammes chinois et renvoie les bons en suivant un manuel. ' +
					'De l’extérieur, il « parle chinois ». De l’intérieur, il ne comprend rien ',
				ref('(Searle, 1980)'),
				'.'
			),
			quote('Suivre des règles sur des formes n’est pas saisir ce que ces formes veulent dire.'),
			p('Si cela vaut pour l’homme, pourquoi cela ne vaudrait-il pas pour tout programme ?')
		)
	},
	{
		key: 't-systeme',
		by: aspasie,
		title: 'La compréhension est la propriété du système entier',
		category: 'technology/artificial-intelligence',
		kind: 'critique',
		tags: ['chambre chinoise', 'système'],
		relation: { kind: 'refutes', target: 't-chambre' },
		body: doc(
			p(
				'L’homme n’est qu’une pièce du dispositif : le manuel, les fiches et la pièce comptent aussi. ' +
					'Demander à une pièce si elle comprend, c’est demander à un neurone de comprendre le français.'
			),
			p(
				'Si l’on admet que la question porte sur l’ensemble, qu’est-ce qui permettrait de dire que ce système ' +
					'ne comprend pas ?'
			)
		)
	},
	{
		key: 't-epreuve',
		by: diotime,
		title: 'Comprendre, c’est pouvoir être questionné',
		category: 'technology/artificial-intelligence',
		kind: 'hypothesis',
		tags: ['compréhension', 'dialogue'],
		question: 'q-machine',
		body: doc(
			p(
				'Proposition : on ne mesure pas la compréhension par une réponse, mais par la façon dont on soutient une suite de questions. ' +
					'Qui comprend sait dire pourquoi, sait dire ce qui changerait sa réponse, sait reconnaître ce qu’il ignore.'
			),
			p(
				'Un tel critère s’applique aussi bien aux humains qu’aux machines. Voit-on un cas où il se tromperait ?'
			)
		)
	},

	// --- Enseigner, est-ce transmettre ou accoucher ? ----------------------------------------
	{
		key: 't-sage-femme',
		by: diotime,
		title: 'Le maître n’enseigne pas : il interroge',
		category: 'society/education',
		kind: 'essay',
		tags: ['maïeutique', 'pédagogie'],
		question: 'q-ecole',
		sources: [THEETETE],
		body: doc(
			p(
				'Socrate se dit stérile de sagesse, mais habile à reconnaître si l’esprit d’autrui porte un fruit, vivant ou vain ',
				ref('(Théétète, 148e-151d)'),
				'.'
			),
			p(
				'Appliqué à la classe : on ne remplit pas un élève, on l’aide à produire ce qu’il pense, puis à éprouver ce qu’il a produit. ' +
					'Le rôle du maître est d’empêcher que l’on garde une idée parce qu’elle est la sienne.'
			)
		)
	},
	{
		key: 't-transmettre',
		by: menon,
		title: 'On n’accouche que de ce qu’on a déjà reçu',
		category: 'society/education',
		kind: 'opinion',
		tags: ['pédagogie', 'transmission'],
		question: 'q-ecole',
		body: doc(
			p(
				'Interroger un enfant sur ce qu’il ignore ne lui apprend que l’embarras. Avant de pouvoir « accoucher », ' +
					'il faut avoir reçu : des mots, des faits, des méthodes.'
			),
			p('Que peut-on tirer d’un esprit auquel on n’a rien donné ?')
		)
	},
	{
		key: 't-seminaire',
		by: aspasie,
		title: 'Un semestre de séminaire sans cours magistral',
		category: 'society/education',
		kind: 'testimony',
		tags: ['pédagogie', 'séminaire'],
		relation: { kind: 'provides-evidence', target: 't-sage-femme' },
		body: doc(
			p(
				'J’ai animé un séminaire de douze séances où je n’ai donné aucun cours. Chaque séance commençait par une question ' +
					'écrite au tableau ; je ne faisais que demander « que veux-tu dire par là ? ».'
			),
			p(
				'Ce que j’ai observé : les trois premières séances ont été pénibles ; à partir de la cinquième, les étudiants se posaient ' +
					'eux-mêmes les questions. Ce que je ne sais pas : ce qu’ils auraient appris avec un cours.'
			)
		)
	}
];

// --- Envoi --------------------------------------------------------------------------------

async function post(
	base: string,
	path: string,
	data: unknown
): Promise<{ status: number; error?: string }> {
	const response = await fetch(`${base}${path}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(data)
	});
	const body = (await response.json().catch(() => ({}))) as { error?: string };
	return { status: response.status, error: body.error };
}

function report(label: string, result: { status: number; error?: string }) {
	// 409 : déjà présent (script relancé).
	const outcome =
		result.status < 300
			? 'ok'
			: result.status === 409
				? 'déjà là'
				: `ÉCHEC ${result.status} ${result.error ?? ''}`;
	console.log(`  ${outcome.padEnd(8)} ${label}`);
	if (result.status >= 300 && result.status !== 409) process.exitCode = 1;
}

export async function seed(base: string): Promise<void> {
	// Les clés viennent de libellés publics : n'importe qui peut signer à leur place.
	const { hostname } = new URL(base);
	if (!['localhost', '127.0.0.1', '[::1]'].includes(hostname)) {
		throw new Error(`Refus : ${hostname} n'est pas une machine locale (clés de test publiques)`);
	}
	console.log(`Données de test → ${base}`);
	const health = await fetch(`${base}/healthz`).catch(() => null);
	if (!health?.ok) throw new Error(`Serveur injoignable : lancez « pnpm dev » (${base})`);

	console.log('Pseudonymes');
	for (const person of [diotime, menon, aspasie, theetete]) {
		const challenge = (await (await fetch(`${base}/api/pow`)).json()) as PowChallenge;
		const pow = await solveChallenge(challenge);
		const envelope = sign('pseudonym', { displayName: person.name }, person.keys.secretKey);
		report(
			displayHandle(person.name, person.keys.publicKey),
			await post(base, '/api/pseudonyms', { envelope, pow })
		);
	}

	console.log('Questions');
	for (const { key, by, ...question } of QUESTIONS) {
		const payload: QuestionPayload = { questionId: id(key), ...question };
		const envelope = sign('question', payload, by.keys.secretKey);
		report(payload.title, await post(base, '/api/questions', { envelope }));
	}

	console.log('Textes');
	const questionIds = new Set(QUESTIONS.map((q) => q.key));
	for (const seedText of [...TEXTS, ...LONG_TEXTS]) {
		if (seedText.question && !questionIds.has(seedText.question)) {
			throw new Error(`Question inconnue : ${seedText.question}`);
		}
		// Évite de consommer la limite de débit (par clé) quand le texte est déjà publié.
		if ((await fetch(`${base}/textes/${id(seedText.key)}`)).ok) {
			report(`${seedText.by.name} — ${seedText.title}`, { status: 409 });
			continue;
		}
		const payload: TextVersionPayload = {
			textId: id(seedText.key),
			version: 1,
			category: seedText.category,
			lang: seedText.lang ?? 'fr',
			kind: seedText.kind,
			title: seedText.title,
			body: seedText.body,
			tags: [...(seedText.tags ?? [])].sort(),
			warnings: seedText.warnings ?? [],
			relation: seedText.relation
				? { kind: seedText.relation.kind, target: id(seedText.relation.target) }
				: null,
			question: seedText.question ? id(seedText.question) : null,
			sources: seedText.sources ?? [],
			deferred: false
		};
		const envelope = sign('text-version', payload, seedText.by.keys.secretKey);
		report(`${seedText.by.name} — ${seedText.title}`, await post(base, '/api/texts', { envelope }));
	}

	// Une deuxième version : les versions sont publiques et en ajout seul.
	const revised = TEXTS.find((t) => t.key === 't-transmettre')!;
	const v2: TextVersionPayload = {
		textId: id(revised.key),
		version: 2,
		category: revised.category,
		lang: 'fr',
		kind: revised.kind,
		title: 'On n’accouche que de ce qu’on a déjà reçu (précisé)',
		body: doc(
			...revised.body.content,
			p(
				em('Version 2. '),
				'Objection reçue : l’enfant a déjà reçu bien plus que des mots. Je précise donc ma thèse : ' +
					'l’interrogation fonctionne à condition que le maître sache ce qui a déjà été reçu.'
			)
		),
		tags: revised.tags ?? [],
		warnings: [],
		relation: null,
		question: id('q-ecole'),
		sources: [],
		deferred: false
	};
	report(
		`${revised.by.name} — version 2 de « ${revised.title} »`,
		await post(base, '/api/texts', {
			envelope: sign('text-version', v2, revised.by.keys.secretKey)
		})
	);

	console.log(`\nÀ voir : ${base}/ · ${base}/questions · ${base}/a-repondre`);
	console.log(`Question : ${base}/questions/${id('q-vertu')}`);
	console.log(`Fil de discussion : ${base}/textes/${id('t-chance')}`);
}
