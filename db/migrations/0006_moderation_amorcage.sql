-- Compléments de modération et de démarrage (docs/05, docs/07, D18).
-- Migration additive : contraintes élargies, colonnes et tables nouvelles.

-- Signalement et décision visant une question (et non un texte) -----------------

alter table report alter column text_id drop not null;
alter table report alter column version drop not null;
alter table report add column question_id uuid references question (id);
alter table report add constraint report_target_check
	check ((text_id is not null) <> (question_id is not null));

alter table moderation_decision alter column text_id drop not null;
alter table moderation_decision add column question_id uuid references question (id);
alter table moderation_decision add constraint moderation_decision_target_check
	check ((text_id is not null) <> (question_id is not null));

-- Recours de l'auteur contre une décision -------------------------------------

alter table moderation_decision drop constraint moderation_decision_origin_check;
alter table moderation_decision add constraint moderation_decision_origin_check
	check (origin in ('report', 'jury', 'referent', 'authority', 'appeal'));

create table appeal (
	id            uuid primary key,
	decision_id   uuid not null references moderation_decision (id),
	author_key    bytea not null references pseudonym (public_key),
	justification text not null check (char_length(justification) between 1 and 2000),
	envelope      jsonb not null,
	status        text not null default 'open' check (status in ('open', 'decided')),
	created_on    date not null default utc_today()
);

-- Un seul recours en cours par décision.
create unique index appeal_open_idx on appeal (decision_id) where status = 'open';
alter table moderation_decision add column appeal_id uuid references appeal (id);

-- Vivier du jury figé à l'avance (D16, limite connue) ------------------------

create table jury_pool (
	day   date primary key,
	keys  text[] not null,
	hash  text not null check (hash ~ '^[0-9a-f]{64}$')
);

-- Démarrage à froid : invitations facultatives (docs/07) ----------------------
-- Seule l'empreinte du code est conservée, et rien ne relie un code au pseudonyme créé.

create table invitation (
	code_hash  text primary key check (code_hash ~ '^[0-9a-f]{64}$'),
	created_on date not null default utc_today(),
	used_on    date
);
