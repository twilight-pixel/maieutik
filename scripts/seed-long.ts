/**
 * Textes longs des données de test : de vrais articles rédigés (titres, citations, listes,
 * notes de source, bloc de code), pour essayer la lecture, la table des sources et la mise en
 * page sur des textes qui ne tiennent pas en deux paragraphes. Voir scripts/seed.ts.
 */
import {
	aspasie,
	code,
	diotime,
	doc,
	em,
	h2,
	h3,
	hr,
	link,
	list,
	menon,
	ol,
	p,
	quote,
	ref,
	source,
	strong,
	theetete,
	type TextSeed
} from './seed-kit';

export const LONG_TEXTS: TextSeed[] = [
	// ------------------------------------------------------------------------------------------
	{
		key: 'l-sort-et-choix',
		by: aspasie,
		title: 'Le sort et le choix : deux principes, une longue histoire',
		category: 'politics/institutions',
		kind: 'essay',
		tags: ['athènes', 'démocratie', 'représentation', 'tirage au sort'],
		question: 'q-tirage',
		sources: [
			source(1, 'Politique, livre IV', 'Aristote', null),
			source(2, 'De l’esprit des lois, livre II', 'Montesquieu', '1748'),
			source(3, 'Principes du gouvernement représentatif', 'Bernard Manin', '1995', 'Calmann-Lévy'),
			source(
				4,
				'Convention citoyenne pour le climat : rapport final',
				null,
				'2020',
				'Convention citoyenne pour le climat',
				'https://www.conventioncitoyennepourleclimat.fr/'
			)
		],
		body: doc(
			p(
				'Quand on demande s’il faut tirer au sort une assemblée, on traite presque toujours la question comme neuve, ' +
					'une audace d’ingénieurs de la participation. C’est le contraire : le tirage au sort est le plus vieux procédé ' +
					'démocratique que nous connaissions, et c’est l’élection qui, pendant longtemps, a passé pour son opposé. ' +
					'Avant de trancher, il vaut la peine de regarder ce que chacun des deux principes promettait, et pourquoi l’un ' +
					'a fini par chasser l’autre de nos habitudes.'
			),
			h2('Deux manières de désigner'),
			p(
				'Il y a deux façons simples de choisir ceux qui exerceront un pouvoir au nom des autres. On peut ',
				em('choisir'),
				', c’est-à-dire comparer des personnes, en préférer une et la désigner pour ce qu’on croit qu’elle vaut. ' +
					'Ou l’on peut ',
				em('tirer au sort'),
				', c’est-à-dire renoncer à comparer : toute personne qualifiée a la même chance, et le hasard décide.'
			),
			p(
				'Aristote tenait la distinction pour constitutive des régimes. Dans la ',
				em('Politique'),
				', il observe que faire désigner les magistrats par le sort passe pour démocratique, et qu’en faire élire passe ' +
					'pour oligarchique ',
				ref('(Politique, IV, 1294b)', 1),
				'. Montesquieu reprendra la même idée vingt-deux siècles plus tard, presque dans les mêmes termes :'
			),
			quote(
				'Le suffrage par le sort est de la nature de la démocratie ; le suffrage par choix est de celle de l’aristocratie. ',
				ref('(De l’esprit des lois, II, 2)', 2)
			),
			p(
				'Ce que nous appelons aujourd’hui « démocratie représentative » repose donc sur le principe que ces deux auteurs ' +
					'rangeaient du côté aristocratique. Ce n’est pas un reproche : c’est une donnée historique qu’on oublie ' +
					'dès qu’on discute du tirage au sort comme d’une fantaisie.'
			),
			h2('Athènes : un système plein de sort, mais pas naïf'),
			p(
				'À Athènes, au Ve siècle avant notre ère, la plupart des charges étaient attribuées par tirage. Le Conseil, ' +
					'la boulè, comptait cinq cents membres tirés chaque année parmi les citoyens volontaires de plus de trente ans, ' +
					'et nul ne pouvait y siéger plus de deux fois dans sa vie. Les jurys populaires, eux aussi, étaient formés par ' +
					'tirage, au moyen d’une machine, le kléroterion, conçue pour qu’on ne puisse pas tricher.'
			),
			p(
				'Mais les Athéniens n’étaient pas des enthousiastes du hasard. Ils élisaient les stratèges, c’est-à-dire les généraux : ' +
					'là où une erreur de compétence coûtait des vies, ils choisissaient. Leur système distinguait donc les fonctions ' +
					'où l’on veut ',
				em('n’importe quel citoyen'),
				' et celles où l’on veut ',
				em('le meilleur'),
				'. C’est une leçon qu’on perd quand on pose la question sous la forme « tirage au sort contre élection » : ' +
					'la bonne question est presque toujours « pour quelle fonction ? ».'
			),
			hr,
			h2('Pourquoi l’élection l’a emporté'),
			p(
				'Bernard Manin a montré que les fondateurs des régimes représentatifs modernes — en Angleterre, aux États-Unis, ' +
					'en France — ne cherchaient pas à instaurer la démocratie au sens des Anciens. Ils voulaient un gouvernement ' +
					'consenti par le peuple mais exercé par des gens distingués par lui ',
				ref('(Manin, 1995)', 3),
				'. L’élection répondait à cette exigence : elle permet le consentement, et elle sélectionne.'
			),
			p(
				'À cela se sont ajoutées des raisons plus pratiques, que l’on peut énumérer sans les juger :'
			),
			list(
				'les États modernes sont grands : on ne peut plus réunir tous les citoyens, ni même une grande part d’entre eux ;',
				'l’idée que les gouvernants doivent répondre de leurs actes devant ceux qui les ont choisis s’est attachée à l’élection ;',
				'les partis politiques ont fourni, à l’élection, une machinerie que le tirage au sort ne possède pas.'
			),
			h2('Ce que les expériences récentes montrent — et ne montrent pas'),
			p(
				'Depuis une vingtaine d’années, des assemblées tirées au sort sont de nouveau réunies : en Colombie-Britannique, ' +
					'en Irlande, en France. La Convention citoyenne pour le climat a rassemblé cent cinquante personnes en 2019 et 2020 ' +
					'et remis cent quarante-neuf propositions ',
				ref('(rapport final)', 4),
				'. Les observateurs relèvent des délibérations de bonne tenue, un rapport au savoir plus calme que dans les arènes ' +
					'partisanes, une capacité à traiter des sujets longs.'
			),
			p('Il faut pourtant être honnête sur ce qu’on ne peut pas conclure de ces expériences :'),
			list(
				'elles étaient consultatives : la décision restait à d’autres, et la « suite donnée » a fait l’objet de vives controverses ;',
				'elles étaient courtes et encadrées par des organisateurs, des experts, des animateurs : ce qu’on a observé, c’est un dispositif entier, pas des tirés au sort seuls ;',
				'le tirage au sort ne dit rien de l’acceptation : les citoyens non tirés ne se sentent pas automatiquement représentés.'
			),
			h3('Ce qui reste fort dans l’argument du tirage'),
			p(
				'Le tirage au sort garantit une chose que l’élection ne peut garantir : qu’aucun filtre de réseau, d’argent ou de ' +
					'visibilité n’a joué dans la composition du groupe. Si l’on tient la ressemblance à la société pour une vertu, ' +
					'c’est un avantage réel. Mais cela ne fait pas, à soi seul, une raison de confier la décision à un échantillon : ' +
					'il faut ajouter que la ressemblance suffit à rendre sa décision légitime.'
			),
			h2('Les questions qui restent'),
			p(
				'Je ne conclus pas, volontairement. Il me semble que le débat avance mieux quand on remplace la dispute des principes ' +
					'par une suite de questions précises, auxquelles chacun peut répondre dans ses propres termes :'
			),
			ol(
				'Pour quelles fonctions préférons-nous que le pouvoir soit confié à n’importe quel citoyen, et pour lesquelles à un citoyen choisi ?',
				'Qu’est-ce qui, dans l’élection, nous paraît indispensable : le choix d’une personne, ou la possibilité de la renvoyer ?',
				'Une assemblée tirée au sort peut-elle être rendue responsable sans être réélue ? Par quel autre moyen ?',
				'Si une telle assemblée décide, qui l’informe, et comment éviter que l’information ne devienne la vraie décision ?',
				'Qu’est-ce qui nous ferait changer d’avis dans un sens ou dans l’autre ?'
			),
			p(
				strong('Appel à réponses. '),
				'Si vous défendez l’une des thèses, je vous demande de répondre à la question 4. ' +
					'C’est celle qui me paraît la plus difficile pour les deux camps.'
			)
		)
	},

	// ------------------------------------------------------------------------------------------
	{
		key: 'l-chambre-chinoise',
		by: theetete,
		title: 'Ce que la chambre chinoise démontre, et ce qu’elle suppose',
		category: 'technology/artificial-intelligence',
		kind: 'essay',
		tags: ['chambre chinoise', 'compréhension', 'sémantique', 'turing'],
		relation: { kind: 'refutes', target: 't-chambre' },
		sources: [
			source(
				1,
				'Minds, Brains, and Programs',
				'John R. Searle',
				'1980',
				'Behavioral and Brain Sciences'
			),
			source(
				2,
				'Is the Brain’s Mind a Computer Program?',
				'John R. Searle',
				'1990',
				'Scientific American'
			),
			source(3, 'Computing Machinery and Intelligence', 'Alan M. Turing', '1950', 'Mind'),
			source(
				4,
				'Intuition Pumps and Other Tools for Thinking',
				'Daniel C. Dennett',
				'2013',
				'W. W. Norton'
			)
		],
		body: doc(
			p(
				'L’expérience de pensée de la chambre chinoise est devenue un réflexe : dès qu’un programme dialogue de façon convaincante, ' +
					'quelqu’un la sort pour dire qu’il « ne comprend rien ». J’aimerais ici la prendre au sérieux, c’est-à-dire ' +
					'la lire lentement, voir ce qu’elle établit solidement, et marquer l’endroit précis où elle cesse d’établir et commence à ' +
					'supposer. Je ne crois pas qu’elle soit fausse. Je crois qu’on lui fait dire plus qu’elle ne dit.'
			),
			h2('Ce que dit l’argument'),
			p(
				'Searle imagine un homme enfermé dans une pièce, ne lisant pas le chinois. On lui passe des feuilles couvertes ' +
					'd’idéogrammes ; il dispose d’un manuel, en anglais, qui lui indique, pour chaque suite de signes reçue, la suite ' +
					'à renvoyer. De l’extérieur, ses réponses sont indiscernables de celles d’un locuteur. De l’intérieur, dit Searle, ' +
					'il ne comprend rien ',
				ref('(Searle, 1980)', 1),
				'. Le scénario sert donc à séparer deux choses que l’on confond volontiers : ',
				em('produire'),
				' des réponses adéquates et ',
				em('comprendre'),
				' ce que l’on dit.'
			),
			p(
				'Dans une version plus tardive, Searle donne à l’argument une forme explicite, que je recopie telle quelle :'
			),
			code(
				'1. Les programmes sont formels (syntaxiques).\n' +
					'2. Les esprits ont des contenus (de la sémantique).\n' +
					'3. La syntaxe ne suffit pas à constituer la sémantique.\n' +
					'—————————————————————————————————————————————\n' +
					'C. Les programmes ne suffisent pas à constituer des esprits.'
			),
			p(
				'Cette présentation ',
				ref('(Searle, 1990)', 2),
				' a l’avantage d’être honnête : elle montre où se trouve le poids. Les prémisses 1 et 2 sont à peu près ' +
					'consensuelles. Tout porte sur la prémisse 3, et c’est elle que la chambre est chargée de rendre évidente.'
			),
			h2('Ce que l’expérience établit bien'),
			p('Il me semble qu’elle établit au moins deux choses, et qu’elles ne sont pas minces.'),
			list(
				'qu’un critère purement comportemental est insuffisant en droit : rien ne garantit qu’un système qui répond bien ait compris, et il est facile d’imaginer des cas (tables de correspondance, scripts) où il n’a rien compris ;',
				'que la question « comprend-il ? » n’est pas la même que « répond-il bien ? », ce qui interdit de la trancher par un simple test d’imitation.'
			),
			p(
				'Turing lui-même avait d’ailleurs proposé de remplacer la question « les machines peuvent-elles penser ? » par un jeu ' +
					'd’imitation, en reconnaissant qu’elle lui paraissait trop mal définie pour mériter discussion ',
				ref('(Turing, 1950)', 3),
				'. La chambre chinoise peut se lire comme une réponse à ce déplacement : on ne peut pas le faire sans perte.'
			),
			hr,
			h2('Où l’argument cesse de démontrer'),
			p(
				'La prémisse 3 n’est pas démontrée par la chambre : elle est ',
				em('illustrée'),
				' par elle. L’homme dans la pièce ne comprend pas le chinois ; cela nous est donné comme évident parce que ' +
					'nous nous mettons à sa place. Or c’est là le ressort de l’expérience, et c’est aussi sa fragilité : ' +
					'elle demande d’accepter que ce qu’on éprouverait à la première personne est la mesure de ce que le système ' +
					'entier peut faire.'
			),
			h3('La réponse du système'),
			p(
				'C’est la plus ancienne des objections, et Searle la discute dès 1980 : l’homme n’est qu’une pièce de la pièce. ' +
					'Le manuel, les fiches, la procédure, tout cela compte. Si compréhension il y a, elle n’appartiendrait pas à l’homme ' +
					'mais au dispositif. Searle répond que l’homme pourrait mémoriser le manuel et tout faire de tête : ' +
					'il continuerait à ne rien comprendre. Mais cette réponse déplace seulement la difficulté ; elle suppose ' +
					'que ce qui se passerait dans sa tête serait entièrement accessible à son « je » qui répond en anglais, ' +
					'et rien ne l’assure.'
			),
			h3('L’intuition comme pompe'),
			p(
				'Dennett a parlé à ce propos d’une « pompe à intuition » : un dispositif conçu pour faire sortir la réponse ' +
					'voulue, en cachant les paramètres qui comptent. Les programmes que la chambre est censée représenter ' +
					'sont immensément plus complexes que le petit manuel qu’on nous montre, et notre intuition, formée sur ' +
					'le manuel, ne nous dit rien de ce qui se passerait à cette échelle ',
				ref('(Dennett, 2013)', 4),
				'. Je ne tire pas de là que la machine comprend ; je tire que l’expérience ne peut pas, seule, décider.'
			),
			p(
				em(
					'Ce qu’on ne peut pas imaginer n’est pas, pour cette seule raison, impossible ; ' +
						'ce qu’on imagine facilement n’est pas, pour cette seule raison, établi.'
				)
			),
			h2('Une conclusion en forme de questions'),
			p(
				'Je tiens donc la chambre chinoise pour un excellent outil de clarification et un mauvais outil de réfutation. ' +
					'Pour ceux qui voudraient poursuivre, voici les questions que je me pose, et que je pose à qui voudra répondre :'
			),
			ol(
				'Que faudrait-il observer, chez un système, pour que nous disions qu’il comprend — et ce critère s’applique-t-il aussi aux humains ?',
				'Si la compréhension est une propriété du système entier, qu’est-ce qui permet de dire qu’il ne l’a pas ?',
				'La prémisse 3 est-elle une vérité conceptuelle ou un énoncé empirique ? Selon la réponse, la démonstration change de nature.',
				'Si l’on découvrait qu’un cerveau humain procède, à un niveau, par manipulation de formes, devrait-on conclure que nous ne comprenons pas non plus ?'
			)
		)
	},

	// ------------------------------------------------------------------------------------------
	{
		key: 'l-proces-socrate',
		by: menon,
		title: 'Le procès de Socrate, ou comment un débat peut mal finir',
		category: 'history/civilizations',
		kind: 'essay',
		tags: ['athènes', 'procès', 'socrate'],
		sources: [
			source(1, 'Apologie de Socrate', 'Platon', null),
			source(2, 'Mémorables, livre I', 'Xénophon', null),
			source(3, 'Phédon', 'Platon', null),
			source(4, 'Socrate', null, null, 'Wikipédia', 'https://fr.wikipedia.org/wiki/Socrate')
		],
		body: doc(
			p(
				'En 399 avant notre ère, un homme de soixante-dix ans comparaît devant un tribunal d’Athènes. Il est accusé de ne pas ' +
					'honorer les dieux de la cité, d’introduire de nouvelles divinités, et de corrompre la jeunesse. Il va être condamné ' +
					'à mort, et boire la ciguë. Cet homme, c’est Socrate, et l’on a tort de ne retenir de son procès que la fin : ' +
					'il est d’abord un document sur ce qui arrive quand une manière de débattre rencontre un régime qui ne la supporte plus.'
			),
			h2('Une accusation, trois accusateurs'),
			p(
				'L’accusation est portée par Mélétos, un poète peu connu, soutenu par Anytos, un homme politique influent, et par ' +
					'l’orateur Lycon ',
				ref('(Apologie, 23e-24b)', 1),
				'. Xénophon, qui écrit pour défendre la mémoire de son maître, énumère les chefs d’accusation dès le début de ' +
					'ses ',
				em('Mémorables'),
				' et y répond point par point ',
				ref('(Mémorables, I, 1)', 2),
				'. Le jury est composé de citoyens tirés au sort ; la tradition parle de cinq cent un jurés, nombre impair pour éviter ' +
					'l’égalité.'
			),
			p(
				'Ce qu’on reproche formellement à Socrate est vague. Ce qu’on lui reproche réellement est plus précis, et Socrate ' +
					'le dit d’emblée : il a, depuis des années, mauvaise réputation, celle de quelqu’un qui met les gens en difficulté ' +
					'en public. Il rappelle l’épisode de l’oracle de Delphes qui l’aurait désigné comme le plus sage des hommes, et ' +
					'son enquête auprès des politiques, des poètes et des artisans, pour vérifier la réponse :'
			),
			quote(
				'Je suis plus sage que cet homme ; il se peut que ni l’un ni l’autre nous ne sachions rien de beau ni de bon, ' +
					'mais lui croit savoir alors qu’il ne sait pas, tandis que moi, si je ne sais pas, je ne crois pas non plus savoir. ',
				ref('(Apologie, 21d, adapté)', 1)
			),
			h2('Un débat dans le débat'),
			p(
				'Au milieu de sa défense, Socrate fait quelque chose d’inouï : il interroge son accusateur. Il demande à Mélétos ' +
					'qui, à Athènes, rend les jeunes meilleurs, et obtient successivement que ce sont les juges, puis les membres du Conseil, ' +
					'puis tout le monde, sauf lui seul. Il fait remarquer que ce serait une chance exceptionnelle pour la cité si ' +
					'un seul homme gâtait la jeunesse pendant que tous les autres la formaient ',
				ref('(Apologie, 24c-26a)', 1),
				'.'
			),
			p(
				'Pour qui a lu les dialogues, le procédé est familier : une question simple, une réponse que l’autre croit sans danger, ' +
					'puis une conséquence qu’il n’avait pas vue. La différence, ici, est qu’il y a un public, et que ce public a ' +
					'un vote. Une méthode qui, entre amis, fait naître des idées, fait, devant cinq cents citoyens, des ennemis.'
			),
			hr,
			h2('Les deux votes'),
			p(
				'Le premier vote déclare Socrate coupable. Il reste alors à fixer la peine : l’accusation réclame la mort, ' +
					'et la coutume voulait que l’accusé propose lui-même une peine alternative. Socrate commence par proposer d’être ' +
					'nourri aux frais de la cité, au Prytanée, comme on le fait pour les bienfaiteurs publics. Puis, sur l’insistance ' +
					'de ses amis, dont Platon, il offre une amende, qu’ils garantiraient ',
				ref('(Apologie, 36d-38b)', 1),
				'. Le jury choisit la mort. Le ',
				em('Phédon'),
				' raconte la dernière journée : les conversations, le bain, la coupe de ciguë, et la dernière phrase, qui est une ' +
					'dette envers Asclépios ',
				ref('(Phédon, 118a)', 3),
				'.'
			),
			h2('Pourquoi ce procès nous intéresse ici'),
			p(
				'Il serait commode d’en faire une fable : le sage contre la foule. Je n’y crois pas, et je crois qu’il vaut mieux ' +
					'poser, à propos de ce procès, quelques questions ouvertes. Les voici, avec ce que chacune met en jeu :'
			),
			list(
				'Le contexte. Athènes sortait à peine de la tyrannie des Trente (404-403), dont deux chefs, Critias et Charmide, avaient fréquenté Socrate. Une amnistie interdisait de poursuivre les actes de cette période : le procès a-t-il servi à contourner l’amnistie, sous un autre nom ?',
				'La méthode. Interroger en public quelqu’un qui exerce un pouvoir, c’est le mettre en difficulté devant ceux qui l’ont choisi. À partir de quand une pratique de la question devient-elle, pour l’interrogé, une atteinte ?',
				'La procédure. Le jury décide sans délibérer : chaque juré vote seul, après avoir entendu les deux parties. Que perd-on, et que gagne-t-on, quand le verdict est rendu sans discussion entre ceux qui le rendent ?'
			),
			p(
				'Pour une plateforme comme celle-ci, la leçon me paraît être celle-là : la discussion écrite a une propriété que ' +
					'le procès n’avait pas, celle de laisser une trace et de rendre la réplique possible. Ce que Socrate n’a pas eu : ' +
					'quelqu’un qui, après le verdict, aurait pu écrire sous son texte « voici ce que vous n’avez pas répondu ». ',
				link('Une notice plus générale se trouve ici', 'https://fr.wikipedia.org/wiki/Socrate'),
				' ',
				ref('(Wikipédia)', 4),
				'.'
			)
		)
	},

	// ------------------------------------------------------------------------------------------
	{
		key: 'l-question-bien-posee',
		by: diotime,
		title: 'Petit traité de la question bien posée',
		category: 'philosophy/logic',
		kind: 'essay',
		tags: ['dialogue', 'élenchos', 'maïeutique', 'méthode'],
		relation: { kind: 'complements', target: 't-sage-femme' },
		sources: [
			source(1, 'Théétète', 'Platon', null),
			source(2, 'Ménon', 'Platon', null),
			source(
				3,
				'The Socratic Elenchus',
				'Gregory Vlastos',
				'1983',
				'Oxford Studies in Ancient Philosophy'
			),
			source(4, 'Plato’s Earlier Dialectic', 'Richard Robinson', '1941', 'Cornell University Press')
		],
		body: doc(
			p(
				'On parle beaucoup de la maïeutique, bien moins de ce qui la fait marcher : la question. Or il y a des questions qui ' +
					'accouchent et des questions qui étouffent, et la différence ne tient ni au ton, ni à la gentillesse. ' +
					'Ce texte est une tentative de décrire, à partir de ce que les dialogues de Platon montrent et de ce que ' +
					'j’ai pu en faire dans des ateliers de lecture, ce qui sépare les unes des autres. C’est volontairement un petit traité : ' +
					'des règles courtes, chacune accompagnée de ce qu’elle évite.'
			),
			h2('Ce que fait une question'),
			p(
				'Dans le ',
				em('Théétète'),
				', Socrate se compare à sa mère, sage-femme : il n’a lui-même aucune idée à donner, mais il sait reconnaître ' +
					'si ce que l’autre porte est un fruit viable ou un « œuf du vent » ',
				ref('(Théétète, 148e-151d)', 1),
				'. Cette image fait de la question une opération en deux temps : elle ',
				em('fait sortir'),
				' quelque chose, puis elle ',
				em('l’éprouve'),
				'. Une question qui ne fait que l’un des deux est incomplète. Celle qui fait seulement sortir, ' +
					'c’est le bavardage ; celle qui ne fait qu’éprouver, c’est le contrôle.'
			),
			h2('Sept règles'),
			h3('1. Demander ce que l’autre veut dire avant de dire ce qu’on en pense'),
			p(
				'La plupart des désaccords commencent par un malentendu sur un mot. « Que veux-tu dire par là ? » n’est pas ' +
					'une politesse ; c’est une vraie question, qui ne se pose que si l’on est prêt à entendre une réponse inattendue.'
			),
			h3('2. Poser des questions auxquelles on ne connaît pas déjà la réponse'),
			p(
				'Le risque du maître est de poser des questions-pièges, dont la réponse attendue est déjà dans sa poche. L’élève ' +
					'le sent tout de suite, et la conversation devient un jeu de devinette. On reconnaît une vraie question ' +
					'au fait que sa réponse peut nous surprendre.'
			),
			h3('3. Une question à la fois'),
			p(
				'Ce qui paraît un détail est une condition : quand deux questions sont posées ensemble, l’interlocuteur répond ' +
					'à la plus facile. L’autre disparaît sans qu’on s’en aperçoive.'
			),
			h3('4. Faire écrire la réponse'),
			p(
				'Une idée qu’on dit n’est pas celle qu’on écrit. Dès qu’on écrit, on découvre que la phrase ne dit pas ce qu’on voulait ' +
					'dire. C’est pour cela que ce lieu est écrit : la distance entre la pensée et la phrase est la matière même du travail.'
			),
			h3('5. Tirer une conséquence, pas un jugement'),
			p(
				'Dire « c’est faux » ferme. Dire « si c’est vrai, alors il faut aussi que ceci le soit » ouvre : ' +
					'l’interlocuteur peut accepter la conséquence, la refuser, ou revenir sur sa première réponse. ' +
					'C’est, dans les dialogues, la forme courante de l’épreuve, que la tradition appelle ',
				em('élenchos'),
				' ',
				ref('(Vlastos, 1983)', 3),
				'.'
			),
			h3('6. Laisser l’embarras durer'),
			p(
				'Dans le ',
				em('Ménon'),
				', Socrate interroge un jeune esclave sur la manière de doubler l’aire d’un carré. Le garçon répond d’abord avec ' +
					'assurance, et se trompe ; Socrate lui montre son erreur, et le garçon se trouve embarrassé. Puis, une fois ' +
					'l’embarras traversé, il trouve la solution lui-même ',
				ref('(Ménon, 82b-85b)', 2),
				'. L’embarras n’est pas un échec de la méthode : c’en est le moment utile.'
			),
			h3('7. Savoir arrêter'),
			p(
				'Certains dialogues se terminent sur une impasse (c’est le mot grec ',
				em('aporia'),
				'). Ce n’est pas toujours un défaut. Mais il faut que l’impasse soit dite : quand on a fini sans conclure, ' +
					'on le déclare, au lieu de faire semblant d’avoir trouvé.'
			),
			hr,
			h2('Un exemple, pour voir à quoi cela ressemble'),
			p(
				'Voici, reconstitué de mémoire et simplifié, un échange d’atelier. Il s’agissait de savoir si l’on peut ' +
					'mentir par bonté.'
			),
			code(
				'— Mentir par bonté, c’est quand même du mensonge, non ?\n' +
					'— Tu veux dire : le mensonge reste mauvais même quand l’intention est bonne ?\n' +
					'— Oui.\n' +
					'— Alors si un ami cherche un homme qui veut le tuer, et que tu dis ne pas savoir où il se cache, tu agis mal ?\n' +
					'— Non, là c’est différent.\n' +
					'— Qu’est-ce qui est différent ?\n' +
					'— Dans ce cas-là, la vérité servirait à faire du mal.\n' +
					'— Donc ce n’est pas le mensonge qui est mauvais en soi, c’est ce qu’il permet ?\n' +
					'— … Je ne sais plus.'
			),
			p(
				'La dernière réplique est la bonne. L’interlocuteur n’a pas perdu : il a déplacé sa thèse, de « le mensonge est mauvais » ' +
					'vers « le mensonge est mauvais à cause de ce qu’il permet ». Reste à voir si cette seconde thèse tient, ' +
					'et c’est ce que la séance suivante a examiné.'
			),
			h2('Les limites de la méthode'),
			p(
				'Il faut le dire pour que ce petit traité ne soit pas une publicité. Robinson, dans une étude classique, ' +
					'remarquait déjà que l’élenchos ne produit directement que des réfutations, et non des vérités ',
				ref('(Robinson, 1941)', 4),
				'. On peut s’en servir pour détruire une thèse ; il est moins sûr qu’on puisse s’en servir pour en bâtir une. ' +
					'Et il y a des interlocuteurs que la question fait fuir, pour qui l’embarras est une humiliation. ' +
					'Je n’ai pas de règle contre cela, sinon la patience.'
			),
			p(
				strong('Question ouverte. '),
				'Parmi ces sept règles, laquelle serait la plus difficile à tenir dans un débat écrit entre inconnus ? ' +
					'Je ne suis pas sûre que ce soit la même que dans une salle.'
			)
		)
	}
];
