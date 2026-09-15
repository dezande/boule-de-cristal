/* Accès au DOM partagé par tous les modules de l'app ($ vient du kit). */

import { $ } from '../kit/web/dom.ts';

export { $ };

/** La scène : surface plein écran qui reçoit les touchers. */
export const stage = $('#stage');
