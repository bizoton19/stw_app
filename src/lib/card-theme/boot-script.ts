import { DAWN_HOUR, DUSK_HOUR } from "./dusk";
import { CARD_THEME_IDS, DEFAULT_CARD_THEME } from "./themes";

/**
 * Runs blocking in `<head>` so `data-card-theme` is set before first paint.
 * React never owns the value — rendering it on the server would guarantee a
 * hydration mismatch, which plans/ui-enhance.guide.md §1 calls out as the thing
 * that breaks the spell.
 *
 * The dusk boundary lives in `dusk.ts` and is interpolated here, so
 * `dusk.test.ts` covers this script's behaviour too.
 */
export const cardThemeBootScript = `(function(){var d=document.documentElement;try{var ok=${JSON.stringify(
  CARD_THEME_IDS,
)};var q=new URLSearchParams(location.search).get("cardTheme");if(ok.indexOf(q)>=0){d.dataset.cardTheme=q;return}var h=new Date().getHours();d.dataset.cardTheme=(h>=${DUSK_HOUR}||h<${DAWN_HOUR})?"candlelight":"linen"}catch(e){d.dataset.cardTheme=${JSON.stringify(
  DEFAULT_CARD_THEME,
)}}})();`;
