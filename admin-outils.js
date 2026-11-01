// Affiches et rapport : affiches QR par promo, mode évènement, rapport pour l'école, visuels des réussites.
// (Rubrique de la console d'administration ; remplie par le chantier « Animer, Écoles, Partenaires, Outils ».)
import { html } from './vendor/preact-htm.js';
import { addAR } from './i18n.js';

addAR({ 'Cette rubrique arrive bientôt.': 'هذا القسم قادم قريبًا.' });

export function OutilsAdmin() {
  return html`<div class="panel"><p class="small muted">Cette rubrique arrive bientôt.</p></div>`;
}
