-- Phase 2 : questions, relations typées, sources archivées (docs/04 §3 à §5, docs/07).
-- Migration additive uniquement (docs/10 §6).

-- Questions -----------------------------------------------------------------

create table question (
	id          uuid primary key,  -- généré par le client, inclus dans le contenu signé
	author_key  bytea not null references pseudonym (public_key),
	title       text not null check (char_length(title) between 1 and 200),
	category_id text not null references category (id),
	lang        text not null check (lang in ('fr', 'en')),
	context     text not null default '',
	status      text not null default 'published' check (status in ('published', 'removed')),
	created_on  date not null default utc_today(),
	-- Déclaration signée de la question.
	envelope    jsonb not null
);

create index question_category_idx on question (category_id, created_on desc);

-- Une position : texte rattaché directement à une question (sans relation à un autre texte).
alter table text add column question_id uuid references question (id);
create index text_question_idx on text (question_id) where question_id is not null;

-- Signaux de découverte : réfutations et réponses par cible.
create index text_relation_kind_idx on text_relation (kind, target_id);

-- Instantanés de sources ----------------------------------------------------
-- Une ligne par adresse citée. L'application n'a aucun accès réseau sortant (docs/10, I13) :
-- l'archivage est fait par un robot isolé, qui récupère les adresses en attente et renvoie
-- un instantané textuel (jamais de HTML servi aux lecteurs).

create table source_snapshot (
	url          text primary key check (char_length(url) <= 2000),
	status       text not null default 'pending'
		check (status in ('pending', 'archived', 'failed', 'refused')),
	requested_on date not null default utc_today(),
	archived_on  date,
	attempts     integer not null default 0,
	content_type text,
	-- Empreinte SHA-256 du contenu brut téléchargé (preuve d'intégrité).
	sha256       text check (sha256 ~ '^[0-9a-f]{64}$'),
	title        text,
	-- Texte extrait, sans balisage.
	text_content text
);

create index source_snapshot_pending_idx on source_snapshot (requested_on) where status = 'pending';
