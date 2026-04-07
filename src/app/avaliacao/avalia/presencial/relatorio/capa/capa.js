import capaPadrao from '../../../../files/capa.png';
import capaAvalia20242 from '../../../../files/capa_avalia_2024-2.png';
import capaAvalia20244 from '../../../../files/capa_avalia_2024-4.png';
import capaAvalia20252 from '../../../../files/capa_avalia_2025-2.png';
import capaAvalia20254 from '../../../../files/capa_avalia_2025-4.png';

export const COVER_BY_YEAR = {
	'2024-2': capaAvalia20242,
	'2024-4': capaAvalia20244,
	'2025-2': capaAvalia20252,
	'2025-4': capaAvalia20254,
};

export function normalizeYearKey(year) {
	return String(year ?? '')
		.trim()
		.replace(/\s+/g, '')
		.replace(/[_.]/g, '-')
		.toLowerCase();
}

export function getCoverImageForYear(year) {
	const key = normalizeYearKey(year);
	if (COVER_BY_YEAR[key]) return COVER_BY_YEAR[key];
	return capaPadrao;
}

