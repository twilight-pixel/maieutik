-- Phase 3 : jury tiré au sort, rotation de clé (docs/03, docs/05, D16).
-- Migration additive uniquement (docs/10 §6).

-- Rotation de clé : déclaration signée par l'ancienne clé et acceptation par la nouvelle.
alter table pseudonym add column rotation jsonb;

-- Volontariat pour les jurys.
alter table pseudonym add column jury_volunteer boolean not null default false;

-- Graines quotidiennes du tirage : l'engagement est public dès la création,
-- la graine seulement une fois le jour écoulé (src/lib/shared/jury.ts).
create table jury_seed (
	day        date primary key,
	commitment text not null check (commitment ~ '^[0-9a-f]{64}$'),
	seed       text not null check (seed ~ '^[0-9a-f]{64}$')
);

create table jury (
	id             uuid primary key default gen_random_uuid(),
	report_id      uuid not null unique references report (id),
	text_id        uuid not null references text (id),
	seed_day       date not null references jury_seed (day),
	-- Vivier au moment du tirage : nombre et empreinte publics, liste réservée au référent.
	eligible_count integer not null,
	eligible_hash  text not null check (eligible_hash ~ '^[0-9a-f]{64}$'),
	eligible_keys  text[] not null,
	created_on     date not null default utc_today(),
	deadline       date not null,
	status         text not null default 'open' check (status in ('open', 'decided', 'escalated')),
	outcome        text check (outcome in ('illegal', 'legal')),
	votes_illegal  integer,
	votes_legal    integer,
	closed_on      date
);

create index jury_open_idx on jury (deadline) where status = 'open';

create table jury_member (
	jury_id   uuid not null references jury (id),
	juror_key bytea not null references pseudonym (public_key),
	primary key (jury_id, juror_key)
);

create index jury_member_juror_idx on jury_member (juror_key);

-- Vote à l'aveugle : jamais publié individuellement, seuls les totaux le sont à la clôture.
create table jury_vote (
	jury_id       uuid not null,
	juror_key     bytea not null,
	verdict       text not null check (verdict in ('illegal', 'legal')),
	justification text not null,
	envelope      jsonb not null,
	voted_on      date not null default utc_today(),
	primary key (jury_id, juror_key),
	foreign key (jury_id, juror_key) references jury_member (jury_id, juror_key)
);
