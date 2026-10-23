-- Schéma initial (docs/03, 04, 05).
-- Règles : aucune donnée d'identification (ni IP, ni e-mail, ni heure de publication) ;
-- dates publiques au jour près ; versions en ajout seul.

-- Les dates « du jour » sont calculées en UTC, quel que soit le fuseau du serveur.
create function utc_today() returns date
	language sql stable
	as $$ select (now() at time zone 'utc')::date $$;

-- Pseudonymes ---------------------------------------------------------------

create table pseudonym (
	public_key   bytea primary key check (octet_length(public_key) = 32),
	display_name text not null check (char_length(display_name) between 1 and 40),
	-- Suffixe d'empreinte dérivé de la clé (src/lib/shared/identity.ts), immuable.
	fingerprint  text not null check (fingerprint ~ '^[0-9a-f]{4,}$'),
	created_on   date not null default utc_today(),
	-- Pseudonyme d'équipe identifié comme tel (contenus d'amorçage, docs/07).
	is_team      boolean not null default false,
	-- Rotation de clé : déclaration signée par l'ancienne clé (phase 3).
	moved_to     bytea references pseudonym (public_key),
	unique (display_name, fingerprint)
);

-- Taxonomie -----------------------------------------------------------------
-- Identifiants stables (src/lib/shared/content.ts) ; les libellés vivent dans messages/.

create table category (
	id        text primary key,
	parent_id text references category (id),
	position  integer not null default 0
);

-- Textes --------------------------------------------------------------------

create type text_kind as enum ('opinion', 'essay', 'fact', 'hypothesis', 'testimony', 'critique');

create type text_status as enum (
	'scheduled',             -- publication différée (D09)
	'published',
	'withdrawn_by_author',   -- retrait par l'auteur, trace conservée (D05)
	'under_review',          -- masqué en attente d'examen (docs/05)
	'removed'                -- retrait légal motivé
);

create table text (
	id           uuid primary key,  -- généré par le client, inclus dans le contenu signé
	author_key   bytea not null references pseudonym (public_key),
	category_id  text not null references category (id),
	lang         text not null check (lang in ('fr', 'en')),
	kind         text_kind not null,
	status       text_status not null,
	created_on   date not null default utc_today(),
	published_on date,
	-- Texte de type « fait » sans source : étiqueté, jamais bloqué (D04).
	unsourced    boolean not null default false
);

create index text_category_idx on text (category_id, published_on desc);
create index text_author_idx on text (author_key);

create table text_tag (
	text_id uuid not null references text (id),
	tag     text not null check (char_length(tag) between 1 and 40),
	primary key (text_id, tag)
);

-- Versions signées : ajout seul, toutes publiques (D05).
create table text_version (
	text_id        uuid not null references text (id),
	version        integer not null check (version >= 1),
	-- Enveloppe signée complète (src/lib/shared/signature.ts), à revérifier à volonté.
	-- NULL uniquement après effacement du corps (retrait par l'auteur ou retrait légal).
	envelope       jsonb,
	title          text,
	-- Texte brut extrait des blocs, pour la recherche plein texte.
	plain_text     text,
	search         tsvector,
	created_on     date not null default utc_today(),
	primary key (text_id, version)
);

create index text_version_search_idx on text_version using gin (search);

-- Interdit toute réécriture d'une version ; seul l'effacement du corps est permis.
create function text_version_append_only() returns trigger
	language plpgsql
	as $$
begin
	if tg_op = 'DELETE' then
		raise exception 'text_version est en ajout seul';
	end if;
	if new.text_id <> old.text_id or new.version <> old.version or new.created_on <> old.created_on
		or new.envelope is not null or new.title is not null or new.plain_text is not null then
		raise exception 'text_version : seule la suppression du corps est autorisée';
	end if;
	new.search := null;
	return new;
end
$$;

create trigger text_version_append_only
	before update or delete on text_version
	for each row execute function text_version_append_only();

-- Relations argumentatives --------------------------------------------------

create type relation_kind as enum (
	'replies-to', 'refutes', 'complements', 'provides-evidence', 'reinterprets', 'translation-of'
);

create table text_relation (
	source_id  uuid not null references text (id),
	target_id  uuid not null references text (id),
	kind       relation_kind not null,
	created_on date not null default utc_today(),
	primary key (source_id, target_id, kind),
	check (source_id <> target_id)
);

create index text_relation_target_idx on text_relation (target_id);

-- Modération (docs/05) ------------------------------------------------------

create type report_status as enum ('open', 'jury', 'decided', 'dismissed');

create table report (
	id            uuid primary key default gen_random_uuid(),
	text_id       uuid not null references text (id),
	version       integer not null,
	reporter_key  bytea not null references pseudonym (public_key),
	-- Catégorie légale issue d'une liste fermée (à finaliser avec l'avocat).
	legal_category text not null,
	-- Passage désigné : position dans les blocs.
	passage       jsonb not null,
	justification text not null check (char_length(justification) between 1 and 2000),
	status        report_status not null default 'open',
	created_on    date not null default utc_today()
);

create index report_open_idx on report (status) where status in ('open', 'jury');

create type decision_outcome as enum ('maintained', 'hidden', 'removed', 'warning_added');

-- Journal public des retraits : le contenu n'y est jamais reproduit.
create table moderation_decision (
	id             uuid primary key default gen_random_uuid(),
	text_id        uuid not null references text (id),
	legal_category text not null,
	legal_basis    text not null,
	-- Motivation (DSA art. 17).
	reasoning      text not null,
	outcome        decision_outcome not null,
	-- Origine : signalement communautaire, jury, référent, injonction officielle.
	origin         text not null check (origin in ('report', 'jury', 'referent', 'authority')),
	decided_on     date not null default utc_today()
);

create index moderation_decision_text_idx on moderation_decision (text_id);

-- Vecteur de recherche calculé à l'insertion, selon la langue du texte.
create function text_version_search() returns trigger
	language plpgsql
	as $$
declare
	config regconfig;
begin
	select case t.lang when 'fr' then 'french'::regconfig else 'english'::regconfig end
		into config from text t where t.id = new.text_id;
	new.search := setweight(to_tsvector(config, coalesce(new.title, '')), 'A')
		|| setweight(to_tsvector(config, coalesce(new.plain_text, '')), 'B');
	return new;
end
$$;

create trigger text_version_search
	before insert on text_version
	for each row execute function text_version_search();
