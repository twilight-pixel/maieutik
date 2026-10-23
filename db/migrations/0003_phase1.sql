-- Phase 1 : preuves signées conservées, modération par le référent (docs/05, D03, D05).
-- Migration additive uniquement (docs/10 §6).

-- Déclaration signée de création du pseudonyme.
alter table pseudonym add column registration jsonb;

-- Retrait par l'auteur : déclaration signée conservée comme preuve (D05).
alter table text add column withdrawal jsonb;

-- Avertissements ajoutés par le référent (« avertissement manquant », docs/06),
-- en plus de ceux déclarés par l'auteur dans la version signée.
alter table text add column moderation_warnings text[] not null default '{}';

create index text_visible_idx on text (published_on desc) where status = 'published';

-- Signalement signé par son auteur.
alter table report add column envelope jsonb;

alter table moderation_decision add column report_id uuid references report (id);
alter table moderation_decision add column referent_key bytea;
-- Décision signée par le référent juridique.
alter table moderation_decision add column envelope jsonb;
-- Avertissement ajouté quand l'issue est « warning_added ».
alter table moderation_decision add column warning text;

create index moderation_decision_date_idx on moderation_decision (decided_on desc);
