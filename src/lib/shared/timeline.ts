/**
 * Frise chronologique : saisie sous forme de texte (un événement par ligne) et conversion
 * vers les attributs du bloc `timeline` (src/lib/shared/blocks.ts, D17).
 *
 * Format d'une ligne : `date | titre | description` (la description est facultative).
 */
import { LIMITS, hasControl, type TimelineEvent } from './blocks';

export type TimelineErrorCode =
	'missing-title' | 'missing-date' | 'too-long' | 'control' | 'too-many' | 'empty';

export type TimelineParse = {
	events: TimelineEvent[];
	/** Première erreur rencontrée ; `line` vaut 0 pour une erreur qui ne vise pas une ligne. */
	error: { line: number; code: TimelineErrorCode } | null;
};

export function parseTimeline(text: string): TimelineParse {
	const events: TimelineEvent[] = [];
	const lines = text.split('\n');
	for (let i = 0; i < lines.length; i++) {
		const raw = lines[i].trim();
		if (raw === '') continue;
		const line = i + 1;
		const [date = '', title = '', ...rest] = raw.split('|').map((part) => part.trim());
		const description = rest.join(' | ');
		if (raw.indexOf('|') === -1) return { events, error: { line, code: 'missing-title' } };
		if (date === '') return { events, error: { line, code: 'missing-date' } };
		if (title === '') return { events, error: { line, code: 'missing-title' } };
		if (
			date.length > LIMITS.maxTimelineDate ||
			title.length > LIMITS.maxTimelineTitle ||
			description.length > LIMITS.maxTimelineText
		) {
			return { events, error: { line, code: 'too-long' } };
		}
		if (hasControl(raw, false)) return { events, error: { line, code: 'control' } };
		events.push({ date, title, text: description });
	}
	if (events.length === 0) return { events, error: { line: 0, code: 'empty' } };
	if (events.length > LIMITS.maxTimelineEvents) {
		return { events, error: { line: 0, code: 'too-many' } };
	}
	return { events, error: null };
}

export function serializeTimeline(events: readonly TimelineEvent[]): string {
	return events
		.map((event) => [event.date, event.title, event.text].filter((part) => part !== '').join(' | '))
		.join('\n');
}
